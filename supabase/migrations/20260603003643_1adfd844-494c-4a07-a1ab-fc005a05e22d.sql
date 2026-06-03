CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL,
  conversation_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp',
  customer_name text,
  customer_contact text,
  google_event_id text,
  calendar_id text DEFAULT 'primary',
  event_title text,
  event_description text,
  event_start timestamp with time zone NOT NULL,
  event_end timestamp with time zone,
  attendees text,
  source text,
  status text NOT NULL DEFAULT 'scheduled',
  reminder_24h_sent boolean NOT NULL DEFAULT false,
  reminder_1h_sent boolean NOT NULL DEFAULT false,
  reminder_10min_sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointments for their agents"
ON public.appointments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = appointments.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Admins can view all appointments"
ON public.appointments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert appointments for their agents"
ON public.appointments
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = appointments.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can update appointments for their agents"
ON public.appointments
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = appointments.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can delete appointments for their agents"
ON public.appointments
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.agents
  WHERE agents.id = appointments.agent_id AND agents.user_id = auth.uid()
));

CREATE UNIQUE INDEX idx_appointments_agent_event
  ON public.appointments (agent_id, google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX idx_appointments_due
  ON public.appointments (status, event_start);

CREATE INDEX idx_appointments_agent
  ON public.appointments (agent_id);

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();