-- Function to get plan limits
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan_name plan_type)
RETURNS TABLE (max_agents integer, max_team_members integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN plan_name = 'Básico' THEN 2
      WHEN plan_name = 'Avançado' THEN 6
      WHEN plan_name = 'Empresarial' THEN 30
      ELSE 0
    END AS max_agents,
    CASE 
      WHEN plan_name = 'Básico' THEN 6
      WHEN plan_name = 'Avançado' THEN 20
      WHEN plan_name = 'Empresarial' THEN 60
      ELSE 0
    END AS max_team_members;
END;
$$;

-- Function to check if user can create more agents
CREATE OR REPLACE FUNCTION public.can_create_agent(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan plan_type;
  current_count integer;
  max_count integer;
BEGIN
  -- Get user's plan
  SELECT plano INTO user_plan
  FROM public.profiles
  WHERE id = user_id;
  
  -- Get max agents for this plan
  SELECT max_agents INTO max_count
  FROM public.get_plan_limits(user_plan);
  
  -- Count current agents
  SELECT COUNT(*) INTO current_count
  FROM public.agents
  WHERE agents.user_id = can_create_agent.user_id;
  
  RETURN current_count < max_count;
END;
$$;

-- Function to check if user can create more team members
CREATE OR REPLACE FUNCTION public.can_create_team_member(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan plan_type;
  current_count integer;
  max_count integer;
BEGIN
  -- Get user's plan
  SELECT plano INTO user_plan
  FROM public.profiles
  WHERE id = user_id;
  
  -- Get max team members for this plan
  SELECT max_team_members INTO max_count
  FROM public.get_plan_limits(user_plan);
  
  -- Count current team members
  SELECT COUNT(*) INTO current_count
  FROM public.team_members
  WHERE owner_id = user_id;
  
  RETURN current_count < max_count;
END;
$$;

-- Update agents INSERT policy to check limits
DROP POLICY IF EXISTS "Users can create their own agents" ON public.agents;
CREATE POLICY "Users can create their own agents"
ON public.agents
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND public.can_create_agent(auth.uid())
);

-- Update team_members INSERT policy to check limits
DROP POLICY IF EXISTS "Users can create team members" ON public.team_members;
CREATE POLICY "Users can create team members"
ON public.team_members
FOR INSERT
WITH CHECK (
  auth.uid() = owner_id 
  AND public.can_create_team_member(auth.uid())
);