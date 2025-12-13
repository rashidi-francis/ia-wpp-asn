-- Create table for WhatsApp conversations
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  agent_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, remote_jid)
);

-- Create table for WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id TEXT,
  content TEXT NOT NULL,
  is_from_me BOOLEAN DEFAULT false,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversations
CREATE POLICY "Users can view conversations for their agents"
ON public.whatsapp_conversations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM agents WHERE agents.id = whatsapp_conversations.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can update conversations for their agents"
ON public.whatsapp_conversations
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM agents WHERE agents.id = whatsapp_conversations.agent_id AND agents.user_id = auth.uid()
));

CREATE POLICY "Users can insert conversations for their agents"
ON public.whatsapp_conversations
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM agents WHERE agents.id = whatsapp_conversations.agent_id AND agents.user_id = auth.uid()
));

-- RLS policies for messages
CREATE POLICY "Users can view messages for their conversations"
ON public.whatsapp_messages
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM whatsapp_conversations wc
  JOIN agents a ON a.id = wc.agent_id
  WHERE wc.id = whatsapp_messages.conversation_id AND a.user_id = auth.uid()
));

CREATE POLICY "Users can insert messages for their conversations"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM whatsapp_conversations wc
  JOIN agents a ON a.id = wc.agent_id
  WHERE wc.id = whatsapp_messages.conversation_id AND a.user_id = auth.uid()
));

-- Create indexes for performance
CREATE INDEX idx_whatsapp_conversations_agent_id ON public.whatsapp_conversations(agent_id);
CREATE INDEX idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;