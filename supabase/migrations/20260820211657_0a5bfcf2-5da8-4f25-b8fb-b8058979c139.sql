ALTER TABLE public.contribuintes_apurados
  ADD COLUMN IF NOT EXISTS situacao_cadastral text,
  ADD COLUMN IF NOT EXISTS situacao_cadastral_data date,
  ADD COLUMN IF NOT EXISTS mes_inicio_atividade smallint,
  ADD COLUMN IF NOT EXISTS mes_fim_atividade smallint;

CREATE INDEX IF NOT EXISTS contribuintes_apurados_situacao_cadastral_idx
  ON public.contribuintes_apurados (carga_id, situacao_cadastral);