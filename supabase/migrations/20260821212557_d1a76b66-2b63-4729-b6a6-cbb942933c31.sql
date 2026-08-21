ALTER TABLE public.indices_apurados
  ADD COLUMN IF NOT EXISTS origem_credito_proprio text,
  ADD COLUMN IF NOT EXISTS arquivo_credito_proprio text;