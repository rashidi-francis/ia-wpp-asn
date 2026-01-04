-- Adicionar políticas RLS para admins verem todos os dados

-- Admins podem ver todos os profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Admins podem ver todos os agents
CREATE POLICY "Admins can view all agents" 
ON public.agents 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Admins podem ver todas as conversas
CREATE POLICY "Admins can view all conversations" 
ON public.whatsapp_conversations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Admins podem ver todas as mensagens
CREATE POLICY "Admins can view all messages" 
ON public.whatsapp_messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));