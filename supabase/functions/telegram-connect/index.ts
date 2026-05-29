// ============================================================================
// telegram-connect — Conecta/desconecta um bot do Telegram a um agente
// ----------------------------------------------------------------------------
// Multi-tenant: cada agente tem seu próprio bot (token do BotFather).
// Valida o dono do agente (JWT), valida o token via getMe, grava em
// telegram_instances e registra o webhook do Telegram apontando para a
// edge function telegram-webhook (?agent_id=...), com secret_token.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { action, agentId, botToken } = body || {};

    if (!action || !agentId) return json({ error: 'action and agentId are required' }, 400);

    // Valida que o usuário é dono do agente
    const { data: agent } = await admin.from('agents').select('user_id').eq('id', agentId).single();
    if (!agent || agent.user_id !== userData.user.id) {
      return json({ error: 'Forbidden - você não é dono deste agente' }, 403);
    }

    if (action === 'get_status') {
      const { data: inst } = await admin
        .from('telegram_instances').select('*').eq('agent_id', agentId).maybeSingle();
      return json({ instance: inst || null });
    }

    if (action === 'disconnect') {
      const { data: inst } = await admin
        .from('telegram_instances').select('bot_token').eq('agent_id', agentId).maybeSingle();
      if (inst?.bot_token) {
        try {
          await fetch(`https://api.telegram.org/bot${inst.bot_token}/deleteWebhook`, { method: 'POST' });
        } catch (_e) { /* ignore */ }
      }
      await admin.from('telegram_instances').delete().eq('agent_id', agentId);
      return json({ success: true });
    }

    if (action === 'connect') {
      if (!botToken || typeof botToken !== 'string' || !/^\d+:[\w-]+$/.test(botToken.trim())) {
        return json({ error: 'Token do bot inválido. Pegue com o @BotFather.' }, 400);
      }
      const cleanToken = botToken.trim();

      // 1) Valida token
      const meResp = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const me = await meResp.json().catch(() => ({}));
      if (!meResp.ok || !me?.ok) {
        return json({ error: 'Token rejeitado pelo Telegram. Verifique e tente novamente.' }, 400);
      }
      const botUsername = me.result?.username || null;
      const botName = me.result?.first_name || null;

      // 2) Gera secret e grava (upsert por agent_id)
      const webhookSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error: upErr } = await admin.from('telegram_instances').upsert({
        agent_id: agentId,
        bot_token: cleanToken,
        bot_username: botUsername,
        bot_name: botName,
        webhook_secret: webhookSecret,
        status: 'connecting',
        error_message: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });
      if (upErr) {
        console.error('upsert telegram_instances error:', upErr);
        return json({ error: 'Falha ao salvar a configuração do bot.' }, 500);
      }

      // 3) Registra o webhook
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook?agent_id=${agentId}`;
      const swResp = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ['message', 'edited_message'],
          drop_pending_updates: true,
        }),
      });
      const sw = await swResp.json().catch(() => ({}));
      if (!swResp.ok || !sw?.ok) {
        const errMsg = sw?.description || `HTTP ${swResp.status}`;
        await admin.from('telegram_instances')
          .update({ status: 'error', error_message: errMsg }).eq('agent_id', agentId);
        return json({ error: `Falha ao registrar webhook: ${errMsg}` }, 502);
      }

      await admin.from('telegram_instances')
        .update({ status: 'connected', error_message: null }).eq('agent_id', agentId);

      return json({ success: true, bot_username: botUsername, bot_name: botName });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (error: unknown) {
    console.error('telegram-connect error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});
