-- Add new columns to agents table for expanded agent configuration
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS nome VARCHAR(100);
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS como_deve_responder TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS instrucoes_agente TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS topicos_evitar TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS palavras_evitar TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS links_permitidos TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS regras_personalizadas TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS resposta_padrao_erro TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS resposta_secundaria_erro TEXT;