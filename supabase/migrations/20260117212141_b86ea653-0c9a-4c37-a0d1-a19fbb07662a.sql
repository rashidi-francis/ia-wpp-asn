-- Create enum for META WhatsApp instance status
CREATE TYPE public.meta_whatsapp_status AS ENUM ('disconnected', 'connecting', 'connected', 'error');

-- Create table for META WhatsApp API connections
CREATE TABLE public.meta_whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  business_account_id TEXT,
  webhook_verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.meta_whatsapp_status NOT NULL DEFAULT 'disconnected',
  phone_number TEXT,
  display_phone_number TEXT,
  verified_name TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

-- Enable Row Level Security
ALTER TABLE public.meta_whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Create policies for user access (users can only access their own agents' META instances)
CREATE POLICY "Users can view their own META instances" 
ON public.meta_whatsapp_instances 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.agents 
    WHERE agents.id = meta_whatsapp_instances.agent_id 
    AND agents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create META instances for their agents" 
ON public.meta_whatsapp_instances 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agents 
    WHERE agents.id = meta_whatsapp_instances.agent_id 
    AND agents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own META instances" 
ON public.meta_whatsapp_instances 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.agents 
    WHERE agents.id = meta_whatsapp_instances.agent_id 
    AND agents.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own META instances" 
ON public.meta_whatsapp_instances 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.agents 
    WHERE agents.id = meta_whatsapp_instances.agent_id 
    AND agents.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meta_whatsapp_instances_updated_at
BEFORE UPDATE ON public.meta_whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for META instances
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_instances;