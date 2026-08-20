CREATE TABLE public.acoes_recuperacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id),
  referencia text NOT NULL DEFAULT '',
  acao_chave text NOT NULL,
  inscricao_estadual text NOT NULL DEFAULT '',
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  tamanho bigint,
  tipo_mime text,
  descricao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX acoes_recuperacao_anexos_busca
  ON public.acoes_recuperacao_anexos (municipio_id, referencia, acao_chave, inscricao_estadual);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_recuperacao_anexos TO authenticated;
GRANT ALL ON public.acoes_recuperacao_anexos TO service_role;

ALTER TABLE public.acoes_recuperacao_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve anexos permitidos" ON public.acoes_recuperacao_anexos
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "registra anexos permitidos" ON public.acoes_recuperacao_anexos
  FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id) AND criado_por = auth.uid());
CREATE POLICY "atualiza anexos permitidos" ON public.acoes_recuperacao_anexos
  FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "exclui anexos permitidos" ON public.acoes_recuperacao_anexos
  FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));