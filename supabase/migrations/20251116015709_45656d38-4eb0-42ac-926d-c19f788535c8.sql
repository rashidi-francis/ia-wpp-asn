-- Adiciona coluna celular na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN celular TEXT;

-- Atualiza a função handle_new_user para incluir celular
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome, email, plano, celular)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    'Plano Teste Grátis',
    NEW.raw_user_meta_data->>'celular'
  );
  RETURN NEW;
END;
$function$;