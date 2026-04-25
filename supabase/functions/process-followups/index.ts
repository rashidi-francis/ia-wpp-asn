// Edge function: process-followups
// Acionada a cada 5min via pg_cron.
// Lê conversas com followup_due_at vencido, valida quiet hours / domingo /
// agente ativo / WhatsApp conectado, e dispara a próxima mensagem da sequência
// fixa (10min / 4h / 12h) via Evolution API.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')!;
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')!;

// Sequência fixa de follow-up (espelha o FollowUpDialog do frontend)
const FOLLOWUP_SEQUENCE = [
  {
    index: 1,
    delayAfterPreviousMs: 10 * 60 * 1000, // 10 minutos
    text: "Vi que você iniciou conversa mas parou de interagir, há algo que eu possa ajudar?",
  },
  {
    index: 2,
    delayAfterPreviousMs: 4 * 60 * 60 * 1000, // 4 horas
    text: "Olá, você está por aí? Só me dar um sinal que vamos seguir conversa e te ajudar no que vc precisa tá",
  },
  {
    index: 3,
    delayAfterPreviousMs: 12 * 60 * 60 * 1000, // 12 horas
    text: "Como até momento não tive seu feedback, vou esperar você retornar tá, talvez não seja seu momento de decisão ou esteja cuidando de outras tarefas por aí, até breve... Ficamos no seu aguardo",
  },
];

// Quiet hours: 20h às 9h (horário de Brasília, UTC-3)
const QUIET_HOUR_START = 20; // 20h
const QUIET_HOUR_END = 9;    // 9h
const RESUME_HOUR = 9;       // hora pra reagendar

// Retorna { hour, weekday } no horário de Brasília
function getBrasiliaTime(date = new Date()): { hour: number; weekday: number; date: Date } {
  // Brasília = UTC-3 (sem horário de verão atualmente)
  const utc = date.getTime();
  const brt = new Date(utc - 3 * 60 * 60 * 1000);
  return {
    hour: brt.getUTCHours(),
    weekday: brt.getUTCDay(), // 0=domingo, 6=sábado
    date: brt,
  };
}

// Checa se o horário atual está na janela de silêncio
function isInQuietHours(hour: number): boolean {
  // 20h, 21h, 22h, 23h, 0h, 1h ... 8h → silêncio
  return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
}

// Calcula o próximo horário "permitido" para enviar
// Pula quiet hours e domingo
function getNextAllowedTime(from: Date = new Date()): Date {
  const result = new Date(from);

  // Loop até achar horário válido (no máximo alguns dias)
  for (let i = 0; i < 8; i++) {
    const brt = getBrasiliaTime(result);

    // Se domingo → pula pra segunda 9h BRT
    if (brt.weekday === 0) {
      // Avança até o próximo dia (segunda)
      // Setamos para 9h BRT = 12h UTC
      const next = new Date(result);
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(12, 0, 0, 0); // 9h BRT
      result.setTime(next.getTime());
      continue;
    }

    // Se está em quiet hours → reagenda pra 9h BRT
    if (isInQuietHours(brt.hour)) {
      const next = new Date(result);
      // Se já passou das 20h, vai pro dia seguinte 9h
      if (brt.hour >= QUIET_HOUR_START) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      next.setUTCHours(12, 0, 0, 0); // 9h BRT = 12h UTC
      result.setTime(next.getTime());
      continue;
    }

    // Está em horário válido E não é domingo → ok
    return result;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const startTime = Date.now();
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    rescheduled: 0,
  };

  try {
    console.log('=== process-followups START ===');

    // 1. Busca conversas com follow-up vencido (não enviado e que ainda não esgotou as 3 msgs)
    const { data: conversations, error: queryError } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .lte('followup_due_at', new Date().toISOString())
      .eq('followup_sent', false)
      .eq('agent_enabled', true)
      .lt('followup_count', 3)
      .limit(100);

    if (queryError) {
      console.error('Error querying conversations:', queryError);
      throw queryError;
    }

    console.log(`Found ${conversations?.length || 0} conversations with due follow-up`);

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, stats, duration_ms: Date.now() - startTime }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Processa cada conversa
    for (const conv of conversations) {
      stats.processed++;
      const followupIndex = (conv.followup_count || 0) + 1; // 1, 2 ou 3
      const seqStep = FOLLOWUP_SEQUENCE.find(s => s.index === followupIndex);

      if (!seqStep) {
        console.log(`Conversation ${conv.id}: no sequence step for index ${followupIndex}`);
        await supabase
          .from('whatsapp_conversations')
          .update({ followup_sent: true, followup_due_at: null })
          .eq('id', conv.id);
        continue;
      }

      // 2a. Re-checa: lead respondeu desde o agendamento?
      if (conv.last_message_from === 'lead') {
        console.log(`Conversation ${conv.id}: lead replied, cancelling follow-up`);
        await supabase
          .from('whatsapp_conversations')
          .update({
            followup_due_at: null,
            followup_sent: false,
            followup_count: 0,
          })
          .eq('id', conv.id);
        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          status: 'skipped_lead_replied',
          skip_reason: 'Lead respondeu antes do disparo',
        });
        stats.skipped++;
        continue;
      }

      // 2b. Quiet hours / domingo? Reagenda
      const brt = getBrasiliaTime();
      if (brt.weekday === 0 || isInQuietHours(brt.hour)) {
        const nextTime = getNextAllowedTime();
        const reason = brt.weekday === 0 ? 'skipped_sunday' : 'skipped_quiet_hours';
        console.log(`Conversation ${conv.id}: ${reason}, rescheduling to ${nextTime.toISOString()}`);

        await supabase
          .from('whatsapp_conversations')
          .update({ followup_due_at: nextTime.toISOString() })
          .eq('id', conv.id);

        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          status: reason,
          skip_reason: reason === 'skipped_sunday'
            ? 'Domingo — reagendado para segunda 9h'
            : `Janela de silêncio (${QUIET_HOUR_START}h-${QUIET_HOUR_END}h) — reagendado para 9h`,
          rescheduled_to: nextTime.toISOString(),
        });
        stats.rescheduled++;
        continue;
      }

      // 2c. Busca a instância WhatsApp do agente
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('agent_id', conv.agent_id)
        .maybeSingle();

      if (!instance) {
        console.log(`Conversation ${conv.id}: no WhatsApp instance for agent ${conv.agent_id}`);
        await supabase
          .from('whatsapp_conversations')
          .update({ followup_sent: true, followup_due_at: null })
          .eq('id', conv.id);
        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          status: 'skipped_disabled',
          skip_reason: 'Agente sem instância WhatsApp',
        });
        stats.skipped++;
        continue;
      }

      if (instance.status !== 'connected') {
        console.log(`Conversation ${conv.id}: WhatsApp ${instance.status}, rescheduling +30min`);
        const retry = new Date(Date.now() + 30 * 60 * 1000);
        const nextTime = getNextAllowedTime(retry);
        await supabase
          .from('whatsapp_conversations')
          .update({ followup_due_at: nextTime.toISOString() })
          .eq('id', conv.id);
        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          status: 'skipped_disconnected',
          skip_reason: `WhatsApp ${instance.status} — retry em 30min`,
          rescheduled_to: nextTime.toISOString(),
        });
        stats.skipped++;
        continue;
      }

      // 2d. ENVIA via Evolution API
      try {
        const cleanUrl = EVOLUTION_API_URL.replace(/\/+$/, '').replace(/\/manager$/, '');
        const sendUrl = `${cleanUrl}/message/sendText/${instance.instance_name}`;

        const sendResp = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: conv.remote_jid.split('@')[0],
            text: seqStep.text,
          }),
        });

        if (!sendResp.ok) {
          const errBody = await sendResp.text();
          throw new Error(`Evolution API ${sendResp.status}: ${errBody.substring(0, 200)}`);
        }

        // 2e. Atualiza conversa e cria log de sucesso
        const isLast = followupIndex === 3;
        const updateData: any = {
          followup_count: followupIndex,
          last_message: seqStep.text,
          last_message_at: new Date().toISOString(),
          last_message_from: 'ai',
        };

        if (isLast) {
          // Última mensagem da sequência → marca como enviada e para
          updateData.followup_sent = true;
          updateData.followup_due_at = null;
        } else {
          // Agenda a próxima
          const nextStep = FOLLOWUP_SEQUENCE.find(s => s.index === followupIndex + 1);
          if (nextStep) {
            const rawNext = new Date(Date.now() + nextStep.delayAfterPreviousMs);
            const nextTime = getNextAllowedTime(rawNext);
            updateData.followup_due_at = nextTime.toISOString();
          }
        }

        await supabase
          .from('whatsapp_conversations')
          .update(updateData)
          .eq('id', conv.id);

        // Salva também a mensagem no histórico
        await supabase
          .from('whatsapp_messages')
          .insert({
            conversation_id: conv.id,
            content: seqStep.text,
            is_from_me: true,
            message_type: 'text',
            sender_type: 'ai',
          });

        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          message_sent: seqStep.text,
          status: 'sent',
        });

        console.log(`Conversation ${conv.id}: sent follow-up #${followupIndex}${isLast ? ' (last)' : ''}`);
        stats.sent++;
      } catch (sendErr) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error(`Conversation ${conv.id}: send error -`, errMsg);
        await supabase.from('followup_logs').insert({
          conversation_id: conv.id,
          agent_id: conv.agent_id,
          followup_index: followupIndex,
          status: 'error',
          error_message: errMsg,
        });
        // Reagenda pra +30min em caso de erro temporário
        const retry = new Date(Date.now() + 30 * 60 * 1000);
        const nextTime = getNextAllowedTime(retry);
        await supabase
          .from('whatsapp_conversations')
          .update({ followup_due_at: nextTime.toISOString() })
          .eq('id', conv.id);
        stats.errors++;
      }
    }

    console.log('=== process-followups END ===', stats);
    return new Response(
      JSON.stringify({ ok: true, stats, duration_ms: Date.now() - startTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('process-followups fatal error:', msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg, stats }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
