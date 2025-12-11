-- Criar enum para status da instância WhatsApp
CREATE TYPE whatsapp_instance_status AS ENUM ('disconnected', 'connecting', 'connected', 'qr_pending');

-- Criar tabela para instâncias WhatsApp dos agentes
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL UNIQUE,
  status whatsapp_instance_status NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  qr_code_expires_at TIMESTAMP WITH TIME ZONE,
  phone_number TEXT,
  evolution_instance_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para garantir 1 instância por agente
CREATE UNIQUE INDEX idx_whatsapp_instances_agent_id ON public.whatsapp_instances(agent_id);

-- Enable RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own instances (via agents table)
CREATE POLICY "Users can view their own whatsapp instances"
ON public.whatsapp_instances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.id = whatsapp_instances.agent_id
    AND agents.user_id = auth.uid()
  )
);

-- Policy: Users can create instances for their own agents
CREATE POLICY "Users can create whatsapp instances for their agents"
ON public.whatsapp_instances
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.id = whatsapp_instances.agent_id
    AND agents.user_id = auth.uid()
  )
);

-- Policy: Users can update their own instances
CREATE POLICY "Users can update their own whatsapp instances"
ON public.whatsapp_instances
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.id = whatsapp_instances.agent_id
    AND agents.user_id = auth.uid()
  )
);

-- Policy: Users can delete their own instances
CREATE POLICY "Users can delete their own whatsapp instances"
ON public.whatsapp_instances
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.agents
    WHERE agents.id = whatsapp_instances.agent_id
    AND agents.user_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
BEFORE UPDATE ON public.whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime para atualizações de QR code
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;