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
  getTelegramFileUrl, transcribeAudioFromUrl, appendCatalogMediaMarkerIfClearlyPromised,
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

    const isAudio = messageType === 'audio';

    // Mídia que não seja áudio (imagem/documento/sticker/etc) continua só como placeholder.
    if (messageType !== 'text' && !isAudio) {
      console.log('Telegram non-text/non-audio message saved as placeholder; skipping n8n flow');
      return ok();
    }

    // Para áudio: transcrevemos AQUI no backend (Groq Whisper) e enviamos o
    // texto transcrito ao n8n como mensagem normal. Assim não dependemos do nó
    // "Download Audio" do n8n, que é específico do fluxo Evolution/WhatsApp.
    let messageForN8n = content;
    if (isAudio) {
      const fileId = message.voice?.file_id || message.audio?.file_id || null;
      const audioUrl = fileId ? await getTelegramFileUrl(inst.bot_token, fileId) : null;
      if (!audioUrl) {
        console.error('Telegram audio: could not resolve file URL; skipping');
        return ok();
      }
      const transcript = await transcribeAudioFromUrl(audioUrl);
      if (!transcript) {
        console.error('Telegram audio: transcription failed; skipping n8n flow');
        return ok();
      }
      console.log('Telegram audio transcribed:', transcript.substring(0, 120));
      messageForN8n = transcript;
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
      message: messageForN8n,
      mensagem: messageForN8n,
      mensage: messageForN8n,
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
        message: { conversation: messageForN8n },
      },
    };



    // IMPORTANT: mídia deve vir por marcador [[ENVIAR_MIDIA:url]]. Se a IA
    // prometeu explicitamente imagem/PDF e esqueceu o marcador, fazemos um
    // resgate estrito: só anexa quando o catálogo do agente aponta para UMA
    // mídia claramente relacionada. Sem correspondência clara, não envia nada.
    const n8nReplyText = await forwardToN8n(n8nBody);
    if (n8nReplyText) {
      const replyText = appendCatalogMediaMarkerIfClearlyPromised(
        n8nReplyText,
        messageForN8n,
        extras.photosJson,
        extras.pdfsJson,
      );
      const sent = await sendTelegramReply(inst.bot_token, String(chat.id), replyText);
      await saveOutgoingMessage(supabase, saved.conversationId, replyText, sent.messageId, 'ai');
    }


    return ok();
  } catch (error: unknown) {
    console.error('telegram-webhook error:', error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
