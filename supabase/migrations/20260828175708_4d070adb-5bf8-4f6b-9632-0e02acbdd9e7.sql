ALTER TABLE public.cargas DROP CONSTRAINT IF EXISTS cargas_competencia_mes_check;
ALTER TABLE public.cargas ADD CONSTRAINT cargas_competencia_mes_check CHECK (competencia_mes IS NULL OR (competencia_mes >= 1 AND competencia_mes <= 24));
ALTER TABLE public.cargas DROP CONSTRAINT IF EXISTS cargas_competencia_detectada_mes_check;
ALTER TABLE public.cargas ADD CONSTRAINT cargas_competencia_detectada_mes_check CHECK (competencia_detectada_mes IS NULL OR (competencia_detectada_mes >= 1 AND competencia_detectada_mes <= 24));
ALTER TABLE public.indices_apurados DROP CONSTRAINT IF EXISTS indices_apurados_mes_check;
ALTER TABLE public.indices_apurados ADD CONSTRAINT indices_apurados_mes_check CHECK (competencia_mes IS NULL OR (competencia_mes >= 1 AND competencia_mes <= 24));