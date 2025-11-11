-- Create team_members table to store invited members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, invited_email)
);

-- Create table to control agent access for team members
CREATE TABLE public.team_member_agent_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_member_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_agent_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_members
CREATE POLICY "Users can view their team members"
  ON public.team_members FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create team members"
  ON public.team_members FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their team members"
  ON public.team_members FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their team members"
  ON public.team_members FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for team_member_agent_access
CREATE POLICY "Users can view agent access for their team"
  ON public.team_member_agent_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.id = team_member_agent_access.team_member_id
      AND team_members.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agent access for their team"
  ON public.team_member_agent_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.id = team_member_agent_access.team_member_id
      AND team_members.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete agent access for their team"
  ON public.team_member_agent_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.id = team_member_agent_access.team_member_id
      AND team_members.owner_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();