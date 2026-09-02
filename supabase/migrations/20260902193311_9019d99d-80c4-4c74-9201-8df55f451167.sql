ALTER TABLE public.modelos_oficio
  ADD COLUMN IF NOT EXISTS margem_topo numeric NOT NULL DEFAULT 1.9,
  ADD COLUMN IF NOT EXISTS margem_direita numeric NOT NULL DEFAULT 1.9,
  ADD COLUMN IF NOT EXISTS margem_inferior numeric NOT NULL DEFAULT 1.9,
  ADD COLUMN IF NOT EXISTS margem_esquerda numeric NOT NULL DEFAULT 1.9,
  ADD COLUMN IF NOT EXISTS cabecalho text,
  ADD COLUMN IF NOT EXISTS rodape text;