-- 1) Marcador de canal nas conversas (para o dispatch saber por onde responder)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_provider
  ON public.whatsapp_conversations (provider);

-- 2) Tabela de instâncias do Telegram (um bot por agente, multi-tenant)
CREATE TABLE IF NOT EXISTS public.telegram_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  bot_token text NOT NULL,
  bot_username text,
  bot_name text,
  status text NOT NULL DEFAULT 'disconnected',
  webhook_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id)
);

-- Grants (tabela acessada por edge functions com service_role e pelo dono via Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_instances TO authenticated;
GRANT ALL ON public.telegram_instances TO service_role;

ALTER TABLE public.telegram_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telegram instances"
ON public.telegram_instances
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = telegram_instances.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can create telegram instances for their agents"
ON public.telegram_instances
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = telegram_instances.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can update their own telegram instances"
ON public.telegram_instances
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = telegram_instances.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own telegram instances"
ON public.telegram_instances
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = telegram_instances.agent_id AND agents.user_id = auth.uid()
));

-- Admin read (consistente com as outras tabelas do projeto)
CREATE POLICY "Admins can view all telegram instances"
ON public.telegram_instances
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_telegram_instances_updated_at
BEFORE UPDATE ON public.telegram_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();