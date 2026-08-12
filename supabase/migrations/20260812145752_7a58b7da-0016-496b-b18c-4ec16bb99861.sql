ALTER TABLE public.cargas
  ADD COLUMN IF NOT EXISTS tipo_retorno text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS mes_referencia integer;

ALTER TABLE public.cargas
  ADD CONSTRAINT cargas_tipo_retorno_check
  CHECK (tipo_retorno IN ('mensal','indice_provisorio','indice_definitivo'));

CREATE INDEX IF NOT EXISTS cargas_municipio_exercicio_tipo_idx
  ON public.cargas (municipio_id, exercicio, tipo_retorno);