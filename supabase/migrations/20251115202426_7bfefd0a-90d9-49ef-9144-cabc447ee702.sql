-- Adicionar o novo plano ao enum
ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'Plano Teste Grátis';

-- Atualizar a função get_plan_limits para incluir o novo plano
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan_name plan_type)
RETURNS TABLE(max_agents integer, max_team_members integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN plan_name = 'Plano Teste Grátis' THEN 1
      WHEN plan_name = 'Básico' THEN 2
      WHEN plan_name = 'Avançado' THEN 6
      WHEN plan_name = 'Empresarial' THEN 30
      ELSE 0
    END AS max_agents,
    CASE 
      WHEN plan_name = 'Plano Teste Grátis' THEN 0
      WHEN plan_name = 'Básico' THEN 6
      WHEN plan_name = 'Avançado' THEN 20
      WHEN plan_name = 'Empresarial' THEN 60
      ELSE 0
    END AS max_team_members;
END;
$$;

-- Atualizar o trigger handle_new_user para definir o plano padrão como "Plano Teste Grátis"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, plano)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'Plano Teste Grátis'
  );
  RETURN NEW;
END;
$$;