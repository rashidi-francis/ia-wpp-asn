// ============================================================================
// dispatch-message — Roteador ÚNICO de envio de mensagens (multicanal)
// ----------------------------------------------------------------------------
// Recebe { conversation_id, content } e envia pelo canal correto da conversa
// (Evolution | Meta Cloud | Telegram). Centraliza toda a saída do ChatASN.
//
// Autenticação:
//  - Chamada interna (outros edge functions / n8n): Bearer = SERVICE_ROLE_KEY
//    → sender_type padrão 'ai'.
//  - Chamada de usuário logado (inbox): JWT do usuário; valida que ele é dono
//    do agente da conversa → sender_type 'human'.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendViaProvider, saveOutgoingMessage } from "../_shared/channel.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { conversation_id, content } = body || {};
    let senderType: 'ai' | 'human' = body?.sender_type === 'human' ? 'human' : 'ai';

    if (!conversation_id || !content || typeof content !== 'string') {
      return json({ error: 'conversation_id and content are required' }, 400);
    }

    // Carrega a conversa (service role — precisamos do provider/instance)
    const { data: conversation, error: convError } = await admin
      .from('whatsapp_conversations')
      .select('id, agent_id, provider, remote_jid, contact_phone')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return json({ error: 'Conversation not found' }, 404);
    }

    // ---- Autorização ----
    const isInternal = token === SERVICE_ROLE_KEY;
    if (!isInternal) {
      // Chamada de usuário: valida dono do agente
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

      const { data: agent } = await admin
        .from('agents').select('user_id').eq('id', conversation.agent_id).single();
      if (!agent || agent.user_id !== userData.user.id) {
        return json({ error: 'Forbidden - you do not own this agent' }, 403);
      }
      senderType = 'human'; // mensagem manual do operador
    }

    // ---- Envio pelo canal correto ----
    const result = await sendViaProvider(admin, conversation as any, content);
    if (!result.success) {
      return json({ success: false, error: result.error || 'Falha no envio' }, 502);
    }

    // ---- Persiste e atualiza conversa (agenda follow-up se IA) ----
    await saveOutgoingMessage(admin, conversation.id, content, result.messageId, senderType);

    return json({ success: true, message_id: result.messageId });
  } catch (error: unknown) {
    console.error('dispatch-message error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
