CREATE TABLE public.cartorio_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('emolumentos','declaracoes')),
  competencia_ano integer NOT NULL,
  competencia_mes integer NOT NULL CHECK (competencia_mes BETWEEN 1 AND 12),
  arquivo_nome text NOT NULL,
  origem text NOT NULL DEFAULT 'arquivo',
  linhas integer NOT NULL DEFAULT 0,
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_cargas TO authenticated;
GRANT ALL ON public.cartorio_cargas TO service_role;
ALTER TABLE public.cartorio_cargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartorio_cargas_select ON public.cartorio_cargas FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_cargas_insert ON public.cartorio_cargas FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_cargas_update ON public.cartorio_cargas FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_cargas_delete ON public.cartorio_cargas FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE INDEX cartorio_cargas_mun_comp_idx ON public.cartorio_cargas (municipio_id, competencia_ano DESC, competencia_mes DESC);

CREATE TRIGGER cartorio_cargas_atualizado_em BEFORE UPDATE ON public.cartorio_cargas FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.cartorio_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'GERAL',
  titulo text NOT NULL,
  corpo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  margem_topo numeric NOT NULL DEFAULT 1.9,
  margem_direita numeric NOT NULL DEFAULT 1.9,
  margem_inferior numeric NOT NULL DEFAULT 1.9,
  margem_esquerda numeric NOT NULL DEFAULT 1.9,
  cabecalho text,
  rodape text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartorio_modelos TO authenticated;
GRANT ALL ON public.cartorio_modelos TO service_role;
ALTER TABLE public.cartorio_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartorio_modelos_select ON public.cartorio_modelos FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY cartorio_modelos_insert ON public.cartorio_modelos FOR INSERT TO authenticated WITH CHECK (private.eh_admin_municipio(municipio_id));
CREATE POLICY cartorio_modelos_update ON public.cartorio_modelos FOR UPDATE TO authenticated USING (private.eh_admin_municipio(municipio_id)) WITH CHECK (private.eh_admin_municipio(municipio_id));
CREATE POLICY cartorio_modelos_delete ON public.cartorio_modelos FOR DELETE TO authenticated USING (private.eh_admin_municipio(municipio_id));

CREATE TRIGGER cartorio_modelos_atualizado_em BEFORE UPDATE ON public.cartorio_modelos FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();