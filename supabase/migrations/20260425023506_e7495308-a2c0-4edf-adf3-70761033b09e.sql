-- Tabela de auditoria dos disparos de follow-up
CREATE TABLE public.followup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  followup_index INTEGER NOT NULL, -- 1, 2 ou 3
  message_sent TEXT,
  status TEXT NOT NULL, -- 'sent' | 'skipped_quiet_hours' | 'skipped_sunday' | 'skipped_lead_replied' | 'skipped_disabled' | 'skipped_disconnected' | 'error'
  skip_reason TEXT,
  error_message TEXT,
  rescheduled_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_logs_conversation ON public.followup_logs(conversation_id);
CREATE INDEX idx_followup_logs_agent ON public.followup_logs(agent_id);
CREATE INDEX idx_followup_logs_created_at ON public.followup_logs(created_at DESC);

ALTER TABLE public.followup_logs ENABLE ROW LEVEL SECURITY;

-- Donos dos agentes podem ver os logs dos seus follow-ups
CREATE POLICY "Users can view followup logs for their agents"
ON public.followup_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = followup_logs.agent_id
    AND agents.user_id = auth.uid()
));

-- Admins podem ver todos os logs
CREATE POLICY "Admins can view all followup logs"
ON public.followup_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index pra acelerar a query do cron (conversas com follow-up vencido)
CREATE INDEX IF NOT EXISTS idx_conversations_followup_due 
ON public.whatsapp_conversations(followup_due_at) 
WHERE followup_due_at IS NOT NULL AND followup_sent = false;