// ============================================================================
// process-calendar-reminders — Lembretes de reunião (multicanal)
// ----------------------------------------------------------------------------
// Acionada a cada 5min via pg_cron. Lê a tabela `appointments` (agendamentos
// criados pela IA no Google Calendar) e dispara 3 lembretes ao cliente:
//   1º) 24 horas antes
//   2º) 1 hora antes
//   3º) 10 minutos antes
// Envio reaproveita o motor multicanal (Evolution | Meta Cloud | Telegram) via
// `sendViaProvider`, usando a conversa do lead. Cada tier é marcado como enviado
// para nunca duplicar.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, sendViaProvider } from "../_shared/channel.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Tiers de lembrete (minutos antes do início)
const REMINDERS = [
  { key: "reminder_24h_sent", offsetMin: 24 * 60, label: "24h" },
  { key: "reminder_1h_sent", offsetMin: 60, label: "1h" },
  { key: "reminder_10min_sent", offsetMin: 10, label: "10min" },
] as const;

// Janela de tolerância: como o cron roda a cada 5min, aceitamos disparar até
// GRACE minutos depois do horário ideal. Passou disso → considera "perdido"
// e marca como enviado (sem mandar nada), evitando lembrete fora de hora.
const GRACE_MIN = 20;

function fmtDateTimeBRT(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { date, time };
}

function buildMessage(
  tier: "24h" | "1h" | "10min",
  appt: { customer_name: string | null; event_title: string | null; event_start: string },
): string {
  const name = appt.customer_name?.trim();
  const greet = name ? `, ${name}` : "";
  const { date, time } = fmtDateTimeBRT(appt.event_start);
  const titulo = appt.event_title?.trim() ? ` (${appt.event_title.trim()})` : "";

  if (tier === "24h") {
    return `Olá${greet}! 👋 Passando para lembrar que você tem uma reunião${titulo} agendada para amanhã, dia ${date}, às ${time}. Te espero! 😊`;
  }
  if (tier === "1h") {
    return `Oi${greet}! ⏰ Sua reunião${titulo} é daqui a 1 hora, hoje às ${time}. Já se organize para não perder!`;
  }
  // 10min
  return `${name ? name + ", f" : "F"}altam só 10 minutinhos para a sua reunião${titulo}, às ${time}! Estou te aguardando. 🚀`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startTime = Date.now();
  const stats = { processed: 0, sent: 0, skipped: 0, completed: 0, errors: 0 };

  try {
    console.log("=== process-calendar-reminders START ===");
    const nowMs = Date.now();

    // 1. Marca como concluídos os agendamentos já passados (não geram lembrete)
    const { data: past } = await supabase
      .from("appointments")
      .update({ status: "completed" })
      .eq("status", "scheduled")
      .lt("event_start", new Date(nowMs).toISOString())
      .select("id");
    stats.completed = past?.length || 0;

    // 2. Busca agendamentos futuros (até 25h à frente) ainda 'scheduled'
    const horizon = new Date(nowMs + 25 * 60 * 60 * 1000).toISOString();
    const { data: appointments, error: queryError } = await supabase
      .from("appointments")
      .select("*")
      .eq("status", "scheduled")
      .gt("event_start", new Date(nowMs).toISOString())
      .lte("event_start", horizon)
      .limit(200);

    if (queryError) throw queryError;
    console.log(`Found ${appointments?.length || 0} upcoming appointments`);

    if (!appointments || appointments.length === 0) {
      return json({ ok: true, stats, duration_ms: Date.now() - startTime });
    }

    for (const appt of appointments) {
      stats.processed++;
      const startMs = new Date(appt.event_start).getTime();
      const minutesUntil = (startMs - nowMs) / 60000;

      for (const tier of REMINDERS) {
        if (appt[tier.key]) continue; // já enviado

        if (minutesUntil > tier.offsetMin) {
          // ainda não chegou a hora deste lembrete
          continue;
        }

        // Chegou a hora (ou passou). Está dentro da janela de tolerância?
        const withinWindow = minutesUntil > tier.offsetMin - GRACE_MIN;

        if (!withinWindow) {
          // Janela perdida (ex.: agendamento criado tarde demais p/ este tier)
          // → marca como enviado sem mandar, para não disparar fora de hora.
          await supabase
            .from("appointments")
            .update({ [tier.key]: true })
            .eq("id", appt.id);
          stats.skipped++;
          continue;
        }

        // Dentro da janela → ENVIA
        try {
          const sent = await sendReminder(supabase, appt, tier.label as "24h" | "1h" | "10min");
          if (sent.success) {
            await supabase
              .from("appointments")
              .update({ [tier.key]: true })
              .eq("id", appt.id);
            stats.sent++;
            console.log(`Appointment ${appt.id}: sent ${tier.label} reminder`);
          } else {
            stats.errors++;
            console.error(`Appointment ${appt.id}: ${tier.label} send failed - ${sent.error}`);
          }
        } catch (e) {
          stats.errors++;
          console.error(`Appointment ${appt.id}: ${tier.label} error -`, e);
        }

        // No máximo 1 lembrete por execução por agendamento
        break;
      }
    }

    console.log("=== process-calendar-reminders END ===", stats);
    return json({ ok: true, stats, duration_ms: Date.now() - startTime });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-calendar-reminders fatal error:", msg);
    return json({ ok: false, error: msg, stats }, 500);
  }
});

// ---------------------------------------------------------------------------
// Envia 1 lembrete pelo canal correto. Preferimos a conversa (roteamento
// multicanal automático). Sem conversa, montamos um destino best-effort.
// ---------------------------------------------------------------------------
async function sendReminder(
  supabase: any,
  appt: any,
  tier: "24h" | "1h" | "10min",
): Promise<{ success: boolean; error?: string }> {
  const text = buildMessage(tier, appt);

  let conversation:
    | { id: string; agent_id: string; provider: string; remote_jid: string; contact_phone: string | null }
    | null = null;

  if (appt.conversation_id) {
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .select("id, agent_id, provider, remote_jid, contact_phone")
      .eq("id", appt.conversation_id)
      .maybeSingle();
    if (conv) conversation = conv;
  }

  // Fallback: sem conversa vinculada, monta destino a partir do contato salvo
  if (!conversation) {
    const contact = (appt.customer_contact || "").trim();
    if (!contact) return { success: false, error: "Sem conversa nem contato do cliente" };

    if (appt.channel === "telegram") {
      conversation = {
        id: "virtual",
        agent_id: appt.agent_id,
        provider: "telegram",
        remote_jid: contact.startsWith("tg:") ? contact : `tg:${contact}`,
        contact_phone: null,
      };
    } else {
      const digits = contact.replace(/\D/g, "");
      // descobre se o agente usa Meta Cloud ou Evolution
      const { data: meta } = await supabase
        .from("meta_whatsapp_instances")
        .select("id")
        .eq("agent_id", appt.agent_id)
        .maybeSingle();
      conversation = {
        id: "virtual",
        agent_id: appt.agent_id,
        provider: meta ? "meta_cloud" : "evolution",
        remote_jid: `${digits}@s.whatsapp.net`,
        contact_phone: digits,
      };
    }
  }

  const result = await sendViaProvider(supabase, conversation as any, text);
  if (!result.success) return { success: false, error: result.error };

  // Registra no histórico da conversa (sem agendar follow-up) p/ aparecer no inbox
  if (appt.conversation_id) {
    await supabase.from("whatsapp_messages").insert({
      conversation_id: appt.conversation_id,
      content: text,
      is_from_me: true,
      message_type: "text",
      sender_type: "ai",
    });
    await supabase
      .from("whatsapp_conversations")
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        last_message_from: "ai",
      })
      .eq("id", appt.conversation_id);
  }

  return { success: true };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
