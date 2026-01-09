import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

// Convert delay_type to milliseconds
function getDelayMs(delayType: string): number {
  switch (delayType) {
    case '30min': return 30 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '3d': return 3 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

// Default follow-up messages (human-like, short and natural)
const DEFAULT_FOLLOWUP_MESSAGES = [
  "Oi 😊 Só passando pra ver se posso te ajudar em algo.",
  "Fico por aqui caso tenha ficado alguma dúvida 👍",
  "Olá! Tudo bem? Ainda posso te ajudar com algo?",
  "Ei! Qualquer dúvida, estou à disposição 😊",
];

function getRandomDefaultMessage(): string {
  return DEFAULT_FOLLOWUP_MESSAGES[Math.floor(Math.random() * DEFAULT_FOLLOWUP_MESSAGES.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const now = new Date();
    
    console.log('=== FOLLOW-UP JOB STARTED ===');
    console.log('Current time:', now.toISOString());

    // Find all conversations eligible for follow-up
    // Criteria:
    // 1. followup_due_at <= now (time has passed)
    // 2. followup_sent = false (not already sent)
    // 3. status = 'open' (conversation still active)
    // 4. last_message_from = 'ai' (waiting for lead response)
    // 5. followup_count = 0 (only send once)
    const { data: eligibleConversations, error: queryError } = await supabase
      .from('whatsapp_conversations')
      .select(`
        id,
        remote_jid,
        contact_name,
        agent_id,
        followup_due_at,
        last_message_at
      `)
      .lte('followup_due_at', now.toISOString())
      .eq('followup_sent', false)
      .eq('status', 'open')
      .eq('last_message_from', 'ai')
      .eq('followup_count', 0)
      .eq('agent_enabled', true);

    if (queryError) {
      console.error('Error querying eligible conversations:', queryError);
      throw queryError;
    }

    console.log(`Found ${eligibleConversations?.length || 0} eligible conversations for follow-up`);

    if (!eligibleConversations || eligibleConversations.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No eligible conversations for follow-up',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const conversation of eligibleConversations) {
      try {
        console.log(`Processing conversation ${conversation.id} (${conversation.remote_jid})`);

        // Get agent and follow-up settings
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('id, nome, user_id')
          .eq('id', conversation.agent_id)
          .single();

        if (agentError || !agent) {
          console.error(`Agent not found for conversation ${conversation.id}:`, agentError);
          continue;
        }

        // Get follow-up settings for this agent
        const { data: followupSettings } = await supabase
          .from('agent_followup_settings')
          .select('enabled, delay_type, custom_message')
          .eq('agent_id', agent.id)
          .maybeSingle();

        // IMPORTANT: if settings row doesn't exist yet, default to enabled (prevents silent "no follow-up" failures)
        const followupEnabled = followupSettings?.enabled ?? true;

        // Skip if follow-up is disabled for this agent
        if (!followupEnabled) {
          console.log(`Follow-up disabled for agent ${agent.id}, skipping conversation ${conversation.id}`);
          
          // Clear the followup_due_at to avoid rechecking
          await supabase
            .from('whatsapp_conversations')
            .update({ followup_due_at: null })
            .eq('id', conversation.id);
          
          continue;
        }

        // Get WhatsApp instance
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('instance_name, status')
          .eq('agent_id', agent.id)
          .maybeSingle();

        if (instanceError || !instance || instance.status !== 'connected') {
          console.error(`WhatsApp instance not connected for agent ${agent.id}:`, instanceError);
          continue;
        }

        // Double-check: verify the last message is still from AI
        // This prevents sending follow-up if the lead responded while we were processing
        const { data: lastMessage } = await supabase
          .from('whatsapp_messages')
          .select('is_from_me, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMessage && !lastMessage.is_from_me) {
          console.log(`Lead already responded in conversation ${conversation.id}, skipping follow-up`);
          
          // Reset follow-up state since lead responded
          await supabase
            .from('whatsapp_conversations')
            .update({ 
              followup_due_at: null,
              followup_sent: false,
              last_message_from: 'lead'
            })
            .eq('id', conversation.id);
          
          continue;
        }

        // Determine follow-up message
        const followupMessage = followupSettings.custom_message?.trim() || getRandomDefaultMessage();
        
        console.log(`Sending follow-up to ${conversation.remote_jid}: "${followupMessage.substring(0, 50)}..."`);

        // Send message via Evolution API
        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          console.error('EVOLUTION_API_URL or EVOLUTION_API_KEY not configured');
          continue;
        }

        const phoneNumber = conversation.remote_jid.split('@')[0];
        
        const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: followupMessage,
            options: {
              presence: 'composing',
              linkPreview: true,
            },
          }),
        });

        const sendResult = await sendResponse.text();

        if (!sendResponse.ok) {
          console.error(`Error sending follow-up to ${conversation.remote_jid}:`, sendResponse.status, sendResult);
          errorCount++;
          continue;
        }

        console.log(`Follow-up sent successfully to ${conversation.remote_jid}`);

        // Update conversation state
        await supabase
          .from('whatsapp_conversations')
          .update({
            followup_sent: true,
            followup_count: 1,
            followup_due_at: null,
            last_message_at: new Date().toISOString(),
            last_message: followupMessage,
            last_message_from: 'ai',
          })
          .eq('id', conversation.id);

        // Save follow-up message to database
        await supabase
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation.id,
            content: followupMessage,
            is_from_me: true,
            message_type: 'text',
            sender_type: 'ai',
          });

        processedCount++;

      } catch (convError) {
        console.error(`Error processing conversation ${conversation.id}:`, convError);
        errorCount++;
      }
    }

    console.log('=== FOLLOW-UP JOB COMPLETED ===');
    console.log(`Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount,
      errors: errorCount,
      total: eligibleConversations.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Follow-up job error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
