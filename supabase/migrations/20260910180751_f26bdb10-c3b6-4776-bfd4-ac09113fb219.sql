ALTER TABLE public.impugnacoes
  ADD COLUMN IF NOT EXISTS protocolo_numero text,
  ADD COLUMN IF NOT EXISTS protocolado_em date;