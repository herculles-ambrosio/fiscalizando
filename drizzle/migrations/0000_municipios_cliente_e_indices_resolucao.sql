ALTER TABLE public.municipios
  ADD COLUMN IF NOT EXISTS cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fonte_indice text NOT NULL DEFAULT 'apuracao';

ALTER TABLE public.municipios
  ADD CONSTRAINT municipios_fonte_indice_check CHECK (fonte_indice IN ('apuracao','resolucao'));

UPDATE public.municipios m
SET cliente = true
WHERE EXISTS (SELECT 1 FROM public.indices_apurados i WHERE i.municipio_id = m.id)
   OR EXISTS (SELECT 1 FROM public.cargas c WHERE c.municipio_id = m.id);

CREATE TABLE IF NOT EXISTS public.indices_resolucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL,
  codigo_mun text NOT NULL,
  municipio_nome text NOT NULL,
  resolucao text NOT NULL,
  exercicio_aplicacao integer NOT NULL,
  ano_a integer NOT NULL,
  vaf_a numeric,
  indice_a numeric,
  ano_b integer NOT NULL,
  vaf_b numeric,
  indice_b numeric,
  media_indices numeric,
  fonte_url text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS indices_resolucao_chave
  ON public.indices_resolucao (resolucao, codigo_mun);
CREATE INDEX IF NOT EXISTS indices_resolucao_municipio
  ON public.indices_resolucao (municipio_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indices_resolucao TO authenticated;
GRANT ALL ON public.indices_resolucao TO service_role;

ALTER TABLE public.indices_resolucao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura autenticada" ON public.indices_resolucao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "consultoria insere" ON public.indices_resolucao
  FOR INSERT TO authenticated WITH CHECK (private.eh_consultoria());
CREATE POLICY "consultoria atualiza" ON public.indices_resolucao
  FOR UPDATE TO authenticated USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());
CREATE POLICY "consultoria remove" ON public.indices_resolucao
  FOR DELETE TO authenticated USING (private.eh_consultoria());

CREATE TRIGGER indices_resolucao_atualizado_em
  BEFORE UPDATE ON public.indices_resolucao
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();