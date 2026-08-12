ALTER TABLE public.cargas DROP CONSTRAINT IF EXISTS cargas_competencia_mes_check;
ALTER TABLE public.cargas ADD CONSTRAINT cargas_competencia_mes_check CHECK (competencia_mes IS NULL OR (competencia_mes BETWEEN 1 AND 13));
ALTER TABLE public.cargas DROP CONSTRAINT IF EXISTS cargas_competencia_detectada_mes_check;
ALTER TABLE public.cargas ADD CONSTRAINT cargas_competencia_detectada_mes_check CHECK (competencia_detectada_mes IS NULL OR (competencia_detectada_mes BETWEEN 1 AND 13));