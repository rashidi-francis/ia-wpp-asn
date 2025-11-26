-- Update the get_plan_limits function to reflect the new plan limits
CREATE OR REPLACE FUNCTION get_plan_limits(plan_name plan_type)
RETURNS TABLE (max_agents integer, max_team_members integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE plan_name
      WHEN 'Plano Teste Grátis' THEN 1
      WHEN 'Básico' THEN 1
      WHEN 'Avançado' THEN 3
      WHEN 'Empresarial' THEN 6
      ELSE 1
    END as max_agents,
    CASE plan_name
      WHEN 'Plano Teste Grátis' THEN 1
      WHEN 'Básico' THEN 3
      WHEN 'Avançado' THEN 6
      WHEN 'Empresarial' THEN 12
      ELSE 1
    END as max_team_members;
END;
$$;