CREATE TABLE public.empresas (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios(id) on delete cascade,
  cnpj text not null,
  razao_social text, nome_fantasia text,
  inscricao_estadual text,
  logradouro text, numero text, complemento text, bairro text, cep text, municipio_nome text, uf text,
  email text, telefone text,
  cnae_principal text, cnae_descricao text, cnaes_secundarios text[] not null default '{}',
  natureza_juridica text, porte text,
  situacao text, situacao_data date, motivo text, data_inicio date,
  opcao_simples boolean, data_opcao_simples date, data_exclusao_simples date,
  opcao_mei boolean, data_opcao_mei date, data_exclusao_mei date,
  tipo_auto text not null default 'NAO_CLASSIFICADO',
  tipo_manual text,
  tipo_manual_por uuid, tipo_manual_em timestamptz,
  origem text not null default 'sef',
  referencia_base text,
  fonte text, consultado_em timestamptz, erro_consulta text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, cnpj)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas permitidas" ON public.empresas FOR ALL TO authenticated
  USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE INDEX empresas_municipio_idx ON public.empresas(municipio_id);
CREATE TRIGGER empresas_atualizado_em BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();