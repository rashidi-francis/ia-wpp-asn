-- Adicionar campos de controle de follow-up na tabela whatsapp_conversations
-- Primeiro adicionar colunas sem constraints
ALTER TABLE public.whatsapp_conversations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open',
ADD COLUMN IF NOT EXISTS last_message_from TEXT DEFAULT 'lead',
ADD COLUMN IF NOT EXISTS followup_due_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS followup_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0;

-- Atualizar valores existentes para serem compatíveis
UPDATE public.whatsapp_conversations 
SET status = 'open' WHERE status IS NULL OR status NOT IN ('open', 'waiting', 'closed', 'human');

UPDATE public.whatsapp_conversations 
SET last_message_from = 'lead' WHERE last_message_from IS NULL OR last_message_from NOT IN ('lead', 'ai', 'human');

-- Criar índice para consulta eficiente de follow-ups pendentes
CREATE INDEX IF NOT EXISTS idx_conversations_followup_pending 
ON public.whatsapp_conversations (followup_due_at, followup_sent, status, last_message_from)
WHERE followup_due_at IS NOT NULL AND followup_sent = false;