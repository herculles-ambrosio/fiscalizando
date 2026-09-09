CREATE TABLE public.cartorio_config (
  municipio_id uuid PRIMARY KEY REFERENCES public.municipios(id) ON DELETE CASCADE,
  aliquota_iss numeric NOT NULL DEFAULT 5,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_config TO authenticated;
GRANT ALL ON public.cartorio_config TO service_role;
ALTER TABLE public.cartorio_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartorio_config_select ON public.cartorio_config FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_config_insert ON public.cartorio_config FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_config_update ON public.cartorio_config FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_config_delete ON public.cartorio_config FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE TRIGGER cartorio_config_atualizado_em BEFORE UPDATE ON public.cartorio_config FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.cartorio_serventias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cns text NOT NULL,
  nome text NOT NULL,
  comarca text,
  tipo_servico text NOT NULL DEFAULT '',
  status text,
  cnpj text,
  inscricao_municipal text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, cns, tipo_servico)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_serventias TO authenticated;
GRANT ALL ON public.cartorio_serventias TO service_role;
ALTER TABLE public.cartorio_serventias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartorio_serventias_select ON public.cartorio_serventias FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_serventias_insert ON public.cartorio_serventias FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_serventias_update ON public.cartorio_serventias FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_serventias_delete ON public.cartorio_serventias FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE TRIGGER cartorio_serventias_atualizado_em BEFORE UPDATE ON public.cartorio_serventias FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.cartorio_emolumentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  competencia_ano integer NOT NULL,
  competencia_mes integer NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
  cns text NOT NULL,
  serventia_nome text NOT NULL,
  comarca text,
  tipo_servico text NOT NULL DEFAULT '',
  status text,
  emolumentos numeric NOT NULL DEFAULT 0,
  recompe numeric NOT NULL DEFAULT 0,
  tfj numeric NOT NULL DEFAULT 0,
  despesa numeric NOT NULL DEFAULT 0,
  outras_receitas numeric NOT NULL DEFAULT 0,
  fonte text NOT NULL DEFAULT 'arquivo',
  arquivo_nome text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, competencia_ano, competencia_mes, cns, tipo_servico)
);
CREATE INDEX cartorio_emolumentos_periodo ON public.cartorio_emolumentos (municipio_id, competencia_ano, competencia_mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_emolumentos TO authenticated;
GRANT ALL ON public.cartorio_emolumentos TO service_role;
ALTER TABLE public.cartorio_emolumentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartorio_emolumentos_select ON public.cartorio_emolumentos FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_emolumentos_insert ON public.cartorio_emolumentos FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_emolumentos_update ON public.cartorio_emolumentos FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_emolumentos_delete ON public.cartorio_emolumentos FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE TRIGGER cartorio_emolumentos_atualizado_em BEFORE UPDATE ON public.cartorio_emolumentos FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.cartorio_declaracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  competencia_ano integer NOT NULL,
  competencia_mes integer NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
  cns text NOT NULL,
  serventia_nome text,
  tipo_servico text NOT NULL DEFAULT '',
  base_declarada numeric NOT NULL DEFAULT 0,
  iss_declarado numeric NOT NULL DEFAULT 0,
  iss_pago numeric NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual',
  arquivo_nome text,
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, competencia_ano, competencia_mes, cns, tipo_servico)
);
CREATE INDEX cartorio_declaracoes_periodo ON public.cartorio_declaracoes (municipio_id, competencia_ano, competencia_mes);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_declaracoes TO authenticated;
GRANT ALL ON public.cartorio_declaracoes TO service_role;
ALTER TABLE public.cartorio_declaracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartorio_declaracoes_select ON public.cartorio_declaracoes FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_declaracoes_insert ON public.cartorio_declaracoes FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_declaracoes_update ON public.cartorio_declaracoes FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_declaracoes_delete ON public.cartorio_declaracoes FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE TRIGGER cartorio_declaracoes_atualizado_em BEFORE UPDATE ON public.cartorio_declaracoes FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();