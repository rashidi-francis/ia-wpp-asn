// ============================================================================
// telegram-webhook — Recebe updates do Telegram (multi-tenant, 1 bot por agente)
// ----------------------------------------------------------------------------
// Identifica o agente pelo path ?agent_id=... e valida o segredo do webhook.
// Normaliza para o inbox unificado e encaminha pro n8n (provider: 'telegram').
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, buildAgentN8nExtras, saveIncomingMessage, forwardToN8n,
  sendTelegramReply, saveOutgoingMessage,
} from "../_shared/channel.ts";


const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agent_id');
    const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');

    if (!agentId) return ok();

    const { data: inst } = await supabase
      .from('telegram_instances').select('*').eq('agent_id', agentId).maybeSingle();
    if (!inst) { console.log('Telegram instance not found for agent', agentId); return ok(); }
    if (inst.webhook_secret && secret !== inst.webhook_secret) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const bodyText = await req.text();
    if (!bodyText.trim()) return ok();
    const update = JSON.parse(bodyText);
    const message = update.message ?? update.edited_message;
    const chat = message?.chat;
    if (!chat?.id) return ok();

    // Extrai conteúdo
    let content = '';
    let messageType = 'text';
    if (message.text) { content = message.text; }
    else if (message.caption) { content = message.caption; }
    else if (message.photo) { content = '[Imagem enviada]'; messageType = 'image'; }
    else if (message.voice || message.audio) { content = '[Áudio]'; messageType = 'audio'; }
    else if (message.document) { content = `[Documento] ${message.document.file_name || 'arquivo'}`; messageType = 'document'; }
    else if (message.sticker) { content = '[Sticker]'; }
    else if (message.location) { content = '[Localização]'; }
    else { content = '[Mensagem]'; }

    const remoteJid = `tg:${chat.id}`;
    const contactName = [chat.first_name, chat.last_name].filter(Boolean).join(' ')
      || chat.username || chat.title || null;

    const saved = await saveIncomingMessage(supabase, {
      agentId, provider: 'telegram', remoteJid,
      contactName, contactPhone: null, content,
      messageId: message.message_id ? String(message.message_id) : null,
      messageType,
    });
    if (!saved) return ok();
    if (!saved.agentEnabled) { console.log('Agent disabled, not forwarding'); return ok(); }
    if (messageType !== 'text') {
      // v1: mídia entra como marcador; só encaminhamos texto pro n8n
      console.log('Telegram non-text message saved as placeholder; skipping n8n text flow');
      return ok();
    }

    const extras = await buildAgentN8nExtras(supabase, agentId);
    const n8nBody: Record<string, any> = {
      provider: 'telegram',
      event: 'messages.upsert',
      instance: `telegram_${agentId}`,
      instance_name: `telegram_${agentId}`,
      instancia: `telegram_${agentId}`,
      agent_id: agentId,
      remoteJid,
      chat_id: String(chat.id),
      message: content,
      mensagem: content,
      mensage: content,
      messageType: 'conversation',
      prompt: extras.prompt,
      agent_photos: extras.photosJson,
      agent_pdfs: extras.pdfsJson,
      fotos: extras.photosJson,
      pdfs: extras.pdfsJson,
      calendar_enabled: extras.calendar_enabled,
      calendar_refresh_token: extras.calendar_refresh_token,
      calendar_id: extras.calendar_id,
      data: {
        key: { remoteJid },
        remoteJid,
        messageType: 'conversation',
        message: { conversation: content },
      },
    };
    const replyText = await forwardToN8n(n8nBody);
    if (replyText) {
      const sent = await sendTelegramReply(inst.bot_token, String(chat.id), replyText);
      await saveOutgoingMessage(supabase, saved.conversationId, replyText, sent.messageId, 'ai');
    }

    }

    return ok();
  } catch (error: unknown) {
    console.error('telegram-webhook error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
