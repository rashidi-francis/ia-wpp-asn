import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Evolution API (used to send replies back to WhatsApp)
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

// n8n webhook URL for forwarding WhatsApp messages
// IMPORTANT: keep this in sync with your n8n Webhook node "Production URL".
const N8N_MESSAGES_WEBHOOK_URL = "https://motionlesstern-n8n.cloudfy.live/webhook/5ca49874-447c-46fc-9e4a-3a2bc8f98afd";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const payload = await req.json();
    
    console.log('Webhook received:', JSON.stringify(payload));

    const { event, instance, data } = payload;

    if (!instance) {
      console.log('No instance in webhook payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the instance in database
    const { data: whatsappInstance, error: findError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instance)
      .maybeSingle();

    if (findError || !whatsappInstance) {
      console.log('Instance not found in database:', instance);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize event name (Evolution API uses different formats)
    const normalizedEvent = event.toLowerCase().replace(/_/g, '.');
    console.log(`Processing event: ${event} (normalized: ${normalizedEvent})`);

    // Handle different events
    switch (normalizedEvent) {
      case 'connection.update':
        await handleConnectionUpdate(supabase, whatsappInstance, data);
        break;
      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, whatsappInstance, data);
        break;
      case 'messages.upsert':
        console.log('Message received for instance:', instance);
        // Save message to database and get conversation info
        const conversationInfo = await saveMessageToDatabase(supabase, whatsappInstance, data);
        // Only forward to n8n if agent is enabled for this conversation and message is from user
        if (conversationInfo?.shouldForward && conversationInfo?.agentEnabled) {
          await forwardMessageToN8N(supabase, whatsappInstance, payload);
        } else if (conversationInfo?.shouldForward && !conversationInfo?.agentEnabled) {
          console.log('Agent is disabled for this conversation, not forwarding to n8n');
        }
        break;
      default:
        console.log('Unhandled event:', event);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleConnectionUpdate(supabase: any, instance: any, data: any) {
  console.log('Connection update:', JSON.stringify(data));
  
  const state = data.state?.toLowerCase();
  const currentStatus = instance.status;
  
  // IGNORE statusReason 405 completely - this is a temporary reconnection cycle
  // Evolution API sends these constantly even when connection is active
  if (data.statusReason === 405) {
    console.log('Ignoring 405 status - temporary reconnection cycle, keeping current status:', currentStatus);
    return;
  }
  
  // IGNORE 'connecting' events if we're already connected or were recently connected
  // Evolution API sends these in loops even when connection is stable
  if (state === 'connecting' && (currentStatus === 'connected' || currentStatus === 'connecting')) {
    console.log('Ignoring connecting event - already in stable state:', currentStatus);
    return;
  }
  
  let status: 'disconnected' | 'connecting' | 'connected' | 'qr_pending' = currentStatus || 'disconnected';
  
  // Only update status for definitive state changes
  if (state === 'open' || state === 'connected') {
    status = 'connected';
  } else if (state === 'qrcode') {
    status = 'qr_pending';
  } else if (state === 'connecting' && currentStatus === 'disconnected') {
    // Only set to connecting if we were truly disconnected
    status = 'connecting';
  }
  // Note: We NO LONGER set to 'disconnected' from webhook events
  // The only way to disconnect should be explicit user action or QR timeout
  
  // Don't update if status hasn't changed
  if (status === currentStatus) {
    console.log('Status unchanged, skipping update:', status);
    return;
  }

  const updateData: any = { status };
  
  // Clear QR code when connected
  if (status === 'connected') {
    updateData.qr_code = null;
    updateData.qr_code_expires_at = null;
  }

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('id', instance.id);

  console.log(`Updated instance ${instance.instance_name} status to: ${status}`);
}

async function handleQRCodeUpdate(supabase: any, instance: any, data: any) {
  console.log('QR Code update received:', JSON.stringify(data));
  
  // Try multiple possible paths for base64 QR code
  const base64 = data.qrcode?.base64 || data.base64 || data.qr?.base64 || data.code;
  
  if (base64) {
    await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: base64,
        qr_code_expires_at: new Date(Date.now() + 45000).toISOString(),
        status: 'qr_pending',
      })
      .eq('id', instance.id);

    console.log('Updated QR code for instance:', instance.instance_name);
  } else {
    console.log('No base64 QR code found in data');
  }
}

async function saveMessageToDatabase(supabase: any, instance: any, data: any): Promise<{ shouldForward: boolean; agentEnabled: boolean } | null> {
  try {
    // Evolution API can send messages in different formats
    const messages = data.messages || [data];
    let result: { shouldForward: boolean; agentEnabled: boolean } | null = null;
    
    for (const message of messages) {
      const key = message.key || {};
      const remoteJid = key.remoteJid || message.remoteJid;
      const messageId = key.id || message.id;
      const isFromMe = key.fromMe || message.fromMe || false;
      
      if (!remoteJid) {
        console.log('No remoteJid found in message, skipping');
        continue;
      }
      
      // Skip status messages (broadcasts)
      if (remoteJid === 'status@broadcast') {
        console.log('Skipping status broadcast message');
        continue;
      }
      
      // Extract message content
      let content = '';
      const messageData = message.message || message;
      
      if (messageData.conversation) {
        content = messageData.conversation;
      } else if (messageData.extendedTextMessage?.text) {
        content = messageData.extendedTextMessage.text;
      } else if (messageData.imageMessage?.caption) {
        content = '[Imagem] ' + (messageData.imageMessage.caption || '');
      } else if (messageData.videoMessage?.caption) {
        content = '[Vídeo] ' + (messageData.videoMessage.caption || '');
      } else if (messageData.audioMessage) {
        content = '[Áudio]';
      } else if (messageData.documentMessage?.fileName) {
        content = '[Documento] ' + messageData.documentMessage.fileName;
      } else if (messageData.stickerMessage) {
        content = '[Sticker]';
      } else if (messageData.contactMessage) {
        content = '[Contato]';
      } else if (messageData.locationMessage) {
        content = '[Localização]';
      } else {
        content = '[Mensagem]';
      }
      
      // Extract contact info
      const pushName = message.pushName || message.verifiedBizName || null;
      const contactPhone = remoteJid.split('@')[0];
      
      console.log(`Processing message from ${remoteJid} (${pushName}): ${content.substring(0, 50)}...`);
      
      // Find or create conversation
      const { data: existingConversation, error: findError } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('agent_id', instance.agent_id)
        .eq('remote_jid', remoteJid)
        .maybeSingle();
      
      if (findError) {
        console.error('Error finding conversation:', findError);
        continue;
      }
      
      let conversationId: string;
      
      if (existingConversation) {
        // Update existing conversation
        conversationId = existingConversation.id;
        
        const updateData: any = {
          last_message: content,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // Update contact name if we have it and it's different
        if (pushName && pushName !== existingConversation.contact_name) {
          updateData.contact_name = pushName;
        }
        
        // Increment unread count if message is not from me
        if (!isFromMe) {
          updateData.unread_count = (existingConversation.unread_count || 0) + 1;
        }
        
        await supabase
          .from('whatsapp_conversations')
          .update(updateData)
          .eq('id', conversationId);
        
        console.log('Updated conversation:', conversationId);
      } else {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            agent_id: instance.agent_id,
            remote_jid: remoteJid,
            contact_name: pushName,
            contact_phone: contactPhone,
            last_message: content,
            last_message_at: new Date().toISOString(),
            unread_count: isFromMe ? 0 : 1,
            agent_enabled: true,
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating conversation:', createError);
          continue;
        }
        
        conversationId = newConversation.id;
        console.log('Created new conversation:', conversationId);
      }
      
      // Save the message with sender_type
      // sender_type: 'client' = customer message, 'ai' = AI response, 'human' = human operator
      const { error: messageError } = await supabase
        .from('whatsapp_messages')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          content: content,
          is_from_me: isFromMe,
          message_type: 'text',
          sender_type: isFromMe ? 'ai' : 'client',
        });
      
      if (messageError) {
        console.error('Error saving message:', messageError);
      } else {
        console.log('Message saved successfully with sender_type:', isFromMe ? 'ai' : 'client');
      }
      
      // Get agent_enabled status for this conversation
      const { data: convData } = await supabase
        .from('whatsapp_conversations')
        .select('agent_enabled')
        .eq('id', conversationId)
        .single();
      
      // Only forward if message is from user (not from agent/me)
      result = {
        shouldForward: !isFromMe,
        agentEnabled: convData?.agent_enabled ?? true
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in saveMessageToDatabase:', error);
    return null;
  }
}

// Build concatenated prompt from all agent instruction fields
function buildSystemMessage(agent: any): string {
  const sections: string[] = [];

  if (agent.nome) {
    sections.push(`## Nome do Agente\n${agent.nome}`);
  }

  if (agent.quem_eh) {
    sections.push(`## Quem é o Agente\n${agent.quem_eh}`);
  }

  if (agent.o_que_faz) {
    sections.push(`## O que o Agente Faz\n${agent.o_que_faz}`);
  }

  if (agent.objetivo) {
    sections.push(`## Objetivo do Agente\n${agent.objetivo}`);
  }

  if (agent.como_deve_responder) {
    sections.push(`## Como Deve Responder\n${agent.como_deve_responder}`);
  }

  if (agent.instrucoes_agente) {
    sections.push(`## Instruções do Agente\n${agent.instrucoes_agente}`);
  }

  if (agent.topicos_evitar) {
    sections.push(`## Tópicos a Evitar\n${agent.topicos_evitar}`);
  }

  if (agent.palavras_evitar) {
    sections.push(`## Palavras a Evitar\n${agent.palavras_evitar}`);
  }

  if (agent.links_permitidos) {
    sections.push(`## Links Permitidos\n${agent.links_permitidos}`);
  }

  if (agent.regras_personalizadas) {
    sections.push(`## Regras Personalizadas\n${agent.regras_personalizadas}`);
  }

  if (agent.resposta_padrao_erro) {
    sections.push(`## Resposta Padrão de Erro\n${agent.resposta_padrao_erro}`);
  }

  if (agent.resposta_secundaria_erro) {
    sections.push(`## Resposta Secundária de Erro\n${agent.resposta_secundaria_erro}`);
  }

  return sections.join('\n\n');
}

async function forwardMessageToN8N(supabase: any, instance: any, payload: any) {
  try {
    console.log('Forwarding message to n8n webhook...');
    console.log('Instance:', instance.instance_name);

    // Fetch agent data to get the prompt
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', instance.agent_id)
      .single();

    if (agentError) {
      console.error('Error fetching agent for prompt:', agentError);
    }

    // Fetch follow-up settings for this agent
    const { data: followupSettings, error: followupError } = await supabase
      .from('agent_followup_settings')
      .select('*')
      .eq('agent_id', instance.agent_id)
      .maybeSingle();

    if (followupError) {
      console.error('Error fetching follow-up settings:', followupError);
    }

    console.log('Follow-up settings:', JSON.stringify(followupSettings));

    // Build the concatenated prompt from all agent instruction fields
    const prompt = agent ? buildSystemMessage(agent) : '';

    console.log('Prompt length:', prompt.length);

    // Extract the message text + remoteJid from payload
    const messages = payload.data?.messages || [payload.data];
    let messageText = '';
    let remoteJid: string | null = null;

    for (const message of messages) {
      const key = message?.key || {};
      const maybeRemoteJid = key.remoteJid || message.remoteJid;
      if (!remoteJid && typeof maybeRemoteJid === 'string') remoteJid = maybeRemoteJid;

      const messageData = message?.message || message;
      if (messageData?.conversation) {
        messageText = messageData.conversation;
      } else if (messageData?.extendedTextMessage?.text) {
        messageText = messageData.extendedTextMessage.text;
      }

      if (messageText) break;
    }

    const toNumber = remoteJid ? remoteJid.split('@')[0] : null;

    const response = await fetch(N8N_MESSAGES_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        instance_name: instance.instance_name,
        instance_id: instance.id,
        agent_id: instance.agent_id,
        phone_number: instance.phone_number,
        message: messageText,
        prompt: prompt,
        // Follow-up settings for n8n workflow
        followup_enabled: followupSettings?.enabled ?? false,
        followup_delay: followupSettings?.delay_type ?? '24h',
        followup_message: followupSettings?.custom_message ?? '',
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      console.error('n8n webhook error:', response.status, raw);
      return;
    }

    console.log('Message forwarded to n8n successfully with prompt');

    // If n8n returns a reply in the HTTP response, send it back to WhatsApp via Evolution
    // Expected response examples:
    // - plain text: "Olá! ..."
    // - JSON: { "reply": "Olá! ..." } or { "text": "Olá! ..." } or { "message": "Olá! ..." }
    let replyText: string | null = null;
    const trimmed = raw?.trim?.() ?? '';

    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        replyText =
          (typeof parsed?.reply === 'string' && parsed.reply) ||
          (typeof parsed?.text === 'string' && parsed.text) ||
          (typeof parsed?.message === 'string' && parsed.message) ||
          null;
      } catch {
        // Not JSON, treat as plain text
        replyText = trimmed;
      }
    }

    if (!replyText) {
      console.log('n8n did not return a reply in the HTTP response; nothing to send back.');
      return;
    }

    if (!toNumber) {
      console.log('Could not determine recipient number (remoteJid missing); cannot send reply.');
      return;
    }

    await sendTextMessageToEvolution(instance.instance_name, toNumber, replyText);
  } catch (error) {
    console.error('Error forwarding message to n8n:', error);
  }
}

async function sendTextMessageToEvolution(instanceName: string, number: string, text: string) {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.log('EVOLUTION_API_URL/EVOLUTION_API_KEY not configured; cannot send reply.');
      return;
    }

    console.log(`Sending reply via Evolution API to ${number} (instance: ${instanceName})`);

    const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number,
        text,
        options: {
          presence: 'composing',
          linkPreview: true,
        },
      }),
    });

    const body = await resp.text();

    if (!resp.ok) {
      console.error('Evolution sendText error:', resp.status, body);
      return;
    }

    console.log('Reply sent successfully');
  } catch (e) {
    console.error('Error sending reply via Evolution API:', e);
  }
}