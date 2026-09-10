CREATE TABLE public.impugnacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id),
  carga_id uuid REFERENCES public.cargas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  exercicio integer NOT NULL,
  ano_base integer,
  resolucao text NOT NULL DEFAULT '',
  resolucao_data date,
  indice_publicado numeric,
  observacao text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.impugnacoes TO authenticated;
GRANT ALL ON public.impugnacoes TO service_role;

ALTER TABLE public.impugnacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impugnacoes_select" ON public.impugnacoes FOR SELECT TO authenticated
USING (private.eh_consultoria() OR municipio_id = private.meu_municipio_id());

CREATE POLICY "impugnacoes_insert" ON public.impugnacoes FOR INSERT TO authenticated
WITH CHECK (private.eh_consultoria() OR municipio_id = private.meu_municipio_id());

CREATE POLICY "impugnacoes_update" ON public.impugnacoes FOR UPDATE TO authenticated
USING (private.eh_consultoria() OR municipio_id = private.meu_municipio_id())
WITH CHECK (private.eh_consultoria() OR municipio_id = private.meu_municipio_id());

CREATE POLICY "impugnacoes_delete" ON public.impugnacoes FOR DELETE TO authenticated
USING (private.eh_consultoria() OR municipio_id = private.meu_municipio_id());

CREATE TRIGGER impugnacoes_atualizado_em BEFORE UPDATE ON public.impugnacoes
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE INDEX impugnacoes_municipio_idx ON public.impugnacoes (municipio_id, criado_em DESC);