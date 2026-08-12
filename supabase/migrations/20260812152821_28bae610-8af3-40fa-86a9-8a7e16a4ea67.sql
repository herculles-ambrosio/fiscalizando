ALTER TABLE public.cargas
  ADD COLUMN IF NOT EXISTS competencia_mes integer,
  ADD COLUMN IF NOT EXISTS competencia_ano integer;

ALTER TABLE public.cargas
  ADD CONSTRAINT cargas_competencia_mes_check CHECK (competencia_mes IS NULL OR (competencia_mes BETWEEN 1 AND 12)),
  ADD CONSTRAINT cargas_competencia_ano_check CHECK (competencia_ano IS NULL OR (competencia_ano BETWEEN 1990 AND 2100));

UPDATE public.cargas
SET competencia_ano = COALESCE(competencia_ano, exercicio),
    competencia_mes = COALESCE(competencia_mes, CASE WHEN mes_referencia BETWEEN 1 AND 12 THEN mes_referencia ELSE NULL END);

CREATE INDEX IF NOT EXISTS cargas_competencia_idx ON public.cargas (municipio_id, competencia_ano, competencia_mes);