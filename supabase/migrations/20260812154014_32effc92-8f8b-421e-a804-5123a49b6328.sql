ALTER TABLE public.cargas
  ADD COLUMN IF NOT EXISTS competencia_ajustada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS competencia_motivo text,
  ADD COLUMN IF NOT EXISTS competencia_ajustada_por uuid,
  ADD COLUMN IF NOT EXISTS competencia_ajustada_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS competencia_detectada_mes integer,
  ADD COLUMN IF NOT EXISTS competencia_detectada_ano integer;