CREATE TABLE public.empresas_prefeitura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  carga_ref text,
  arquivo_nome text,
  documento text NOT NULL,
  tipo_documento text NOT NULL,
  inscricao_municipal text,
  nome text,
  regime text,
  simples_optante boolean,
  situacao text,
  situacao_normalizada text,
  municipio_endereco text,
  cep text,
  endereco text,
  bairro text,
  alerta_municipio text,
  repetido boolean NOT NULL DEFAULT false,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX empresas_prefeitura_mun_idx ON public.empresas_prefeitura(municipio_id, documento);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_prefeitura TO authenticated;
GRANT ALL ON public.empresas_prefeitura TO service_role;
ALTER TABLE public.empresas_prefeitura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas_prefeitura permitidas" ON public.empresas_prefeitura FOR ALL TO authenticated
  USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));