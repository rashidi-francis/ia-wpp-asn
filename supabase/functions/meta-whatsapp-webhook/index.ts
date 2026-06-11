// ============================================================================
// meta-whatsapp-webhook — Recebe mensagens da WhatsApp Cloud API (Meta)
// ----------------------------------------------------------------------------
// GET : verificação do webhook (hub.challenge) usando webhook_verify_token.
// POST: recebe mensagens, identifica a instância pelo phone_number_id,
//       normaliza para o inbox unificado e encaminha pro n8n (provider: meta_cloud).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, buildAgentN8nExtras, saveIncomingMessage, forwardToN8n,
  sendMetaText, saveOutgoingMessage,
} from "../_shared/channel.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const ok = () => new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  // ---- Verificação do webhook (GET) ----
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const verifyToken = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && verifyToken && challenge) {
      const { data: inst } = await supabase
        .from('meta_whatsapp_instances')
        .select('id')
        .eq('webhook_verify_token', verifyToken)
        .maybeSingle();
      if (inst) {
        return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    if (!bodyText.trim()) return ok();
    const payload = JSON.parse(bodyText);

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages || [];
        if (!phoneNumberId || messages.length === 0) continue;

        const { data: inst } = await supabase
          .from('meta_whatsapp_instances')
          .select('*')
          .eq('phone_number_id', phoneNumberId)
          .maybeSingle();
        if (!inst) { console.log('Meta instance not found for phone_number_id', phoneNumberId); continue; }

        const contactsMap: Record<string, string> = {};
        for (const c of value.contacts || []) {
          if (c.wa_id) contactsMap[c.wa_id] = c.profile?.name || '';
        }

        for (const msg of messages) {
          const from = msg.from; // wa_id (telefone)
          if (!from) continue;

          let content = '';
          let messageType = 'text';
          if (msg.type === 'text') { content = msg.text?.body || ''; }
          else if (msg.type === 'image') { content = msg.image?.caption ? `[Imagem] ${msg.image.caption}` : '[Imagem enviada]'; messageType = 'image'; }
          else if (msg.type === 'audio' || msg.type === 'voice') { content = '[Áudio]'; messageType = 'audio'; }
          else if (msg.type === 'document') { content = `[Documento] ${msg.document?.filename || 'arquivo'}`; messageType = 'document'; }
          else if (msg.type === 'video') { content = '[Vídeo enviado]'; messageType = 'video'; }
          else if (msg.type === 'sticker') { content = '[Sticker]'; }
          else if (msg.type === 'location') { content = '[Localização]'; }
          else if (msg.type === 'button') { content = msg.button?.text || '[Botão]'; }
          else if (msg.type === 'interactive') {
            content = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Resposta]';
          } else { content = '[Mensagem]'; }

          const remoteJid = `${from}@s.whatsapp.net`;
          const contactName = contactsMap[from] || null;

          const saved = await saveIncomingMessage(supabase, {
            agentId: inst.agent_id, provider: 'meta_cloud', remoteJid,
            contactName, contactPhone: from, content,
            messageId: msg.id || null, messageType,
          });
          if (!saved) continue;
          if (!saved.agentEnabled) { console.log('Agent disabled, not forwarding'); continue; }
          if (messageType !== 'text') {
            console.log('Meta non-text message saved as placeholder; skipping n8n text flow');
            continue;
          }

          const extras = await buildAgentN8nExtras(supabase, inst.agent_id);
          const n8nBody: Record<string, any> = {
            provider: 'meta_cloud',
            event: 'messages.upsert',
            instance: `meta_${inst.agent_id}`,
            instance_name: `meta_${inst.agent_id}`,
            instancia: `meta_${inst.agent_id}`,
            agent_id: inst.agent_id,
            remoteJid,

            // Campos p/ agendamento (tabela appointments)
            conversation_id: saved.conversationId,
            channel: 'whatsapp',
            customer_name: contactName || '',
            customer_contact: from,

            phone_number: from,
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
            const sent = await sendMetaText(inst.phone_number_id, inst.access_token, from, replyText);
            await saveOutgoingMessage(supabase, saved.conversationId, replyText, sent.messageId, 'ai');
          }
        }
      }
    }

    return ok();
  } catch (error: unknown) {
    console.error('meta-whatsapp-webhook error:', error);
    return ok();
  }
});
