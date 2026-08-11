ALTER TABLE public.contribuintes_apurados ADD COLUMN IF NOT EXISTS regime_recolhimento text;
ALTER TABLE public.cargas ADD COLUMN IF NOT EXISTS total_simples_nacional integer;
ALTER TABLE public.cargas ADD COLUMN IF NOT EXISTS total_simei integer;
CREATE INDEX IF NOT EXISTS contribuintes_apurados_regime_idx ON public.contribuintes_apurados (carga_id, regime_recolhimento);