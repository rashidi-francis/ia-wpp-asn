-- Tabela de configurações de Follow-up por agente
CREATE TABLE public.agent_followup_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    delay_type TEXT NOT NULL DEFAULT '24h', -- '30min', '24h', '3d'
    custom_message TEXT, -- mensagem personalizada opcional
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Tabela de fotos do agente
CREATE TABLE public.agent_photos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL,
    url TEXT NOT NULL,
    description TEXT, -- descrição para a IA saber quando enviar
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_agent_photos FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Tabela de configurações de Google Calendar por agente
CREATE TABLE public.agent_calendar_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    google_refresh_token TEXT, -- token OAuth refresh
    google_calendar_id TEXT, -- ID do calendário específico
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT fk_agent_calendar FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_agent_followup_agent_id ON public.agent_followup_settings(agent_id);
CREATE INDEX idx_agent_photos_agent_id ON public.agent_photos(agent_id);
CREATE INDEX idx_agent_calendar_agent_id ON public.agent_calendar_settings(agent_id);

-- Enable RLS
ALTER TABLE public.agent_followup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agent_followup_settings
CREATE POLICY "Users can view their own agent followup settings"
ON public.agent_followup_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_followup_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own agent followup settings"
ON public.agent_followup_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_followup_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can update their own agent followup settings"
ON public.agent_followup_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_followup_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own agent followup settings"
ON public.agent_followup_settings FOR DELETE
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_followup_settings.agent_id AND agents.user_id = auth.uid()
));

-- Políticas RLS para agent_photos
CREATE POLICY "Users can view their own agent photos"
ON public.agent_photos FOR SELECT
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_photos.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own agent photos"
ON public.agent_photos FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_photos.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own agent photos"
ON public.agent_photos FOR DELETE
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_photos.agent_id AND agents.user_id = auth.uid()
));

-- Políticas RLS para agent_calendar_settings
CREATE POLICY "Users can view their own agent calendar settings"
ON public.agent_calendar_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_calendar_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can insert their own agent calendar settings"
ON public.agent_calendar_settings FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_calendar_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can update their own agent calendar settings"
ON public.agent_calendar_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_calendar_settings.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own agent calendar settings"
ON public.agent_calendar_settings FOR DELETE
USING (EXISTS (
    SELECT 1 FROM agents WHERE agents.id = agent_calendar_settings.agent_id AND agents.user_id = auth.uid()
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agent_followup_settings_updated_at
BEFORE UPDATE ON public.agent_followup_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_calendar_settings_updated_at
BEFORE UPDATE ON public.agent_calendar_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();