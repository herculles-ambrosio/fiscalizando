CREATE TABLE public.bancos_instituicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'BANCO',
  codigo_bc text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, cnpj)
);
CREATE TABLE public.bancos_contas_cosif (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  conta text NOT NULL,
  descricao text NOT NULL,
  item_lc116 text,
  aliquota numeric NOT NULL DEFAULT 5,
  tributavel boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, conta)
);
CREATE TABLE public.bancos_declaracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  instituicao_nome text,
  competencia_ano integer NOT NULL,
  competencia_mes integer NOT NULL,
  conta text NOT NULL DEFAULT 'TOTAL',
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  tributavel_declarado boolean,
  aliquota_declarada numeric,
  iss_declarado numeric,
  origem text NOT NULL DEFAULT 'manual',
  arquivo_nome text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bancos_declaracoes (municipio_id, competencia_ano, competencia_mes);
CREATE TABLE public.bancos_estban (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  competencia_ano integer NOT NULL,
  competencia_mes integer NOT NULL,
  cnpj_raiz text NOT NULL,
  nome text NOT NULL,
  agencias integer,
  verbete_710 numeric,
  verbete_711 numeric,
  verbete_712 numeric,
  depositos numeric,
  operacoes_credito numeric,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, competencia_ano, competencia_mes, cnpj_raiz)
);
CREATE TABLE public.bancos_ifdata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  nome text,
  ano integer NOT NULL,
  trimestre integer NOT NULL,
  rendas_servicos numeric NOT NULL DEFAULT 0,
  participacao_pct numeric NOT NULL DEFAULT 100,
  origem text NOT NULL DEFAULT 'manual',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, cnpj, ano, trimestre)
);
CREATE TABLE public.bancos_modelos (
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
CREATE TABLE public.bancos_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  nome text,
  competencia text,
  modelo_chave text NOT NULL,
  modelo_nome text NOT NULL,
  emitido_por uuid,
  emitido_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text; r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['bancos_instituicoes','bancos_contas_cosif','bancos_declaracoes','bancos_estban','bancos_ifdata','bancos_modelos','bancos_notificacoes'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR r IN SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS q, pg_get_expr(polwithcheck, polrelid) AS w
             FROM pg_policy WHERE polrelid = 'public.cartorio_modelos'::regclass LOOP
      EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR %s TO authenticated %s %s',
        r.polname, t,
        CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
        CASE WHEN r.q IS NOT NULL THEN 'USING (' || r.q || ')' ELSE '' END,
        CASE WHEN r.w IS NOT NULL THEN 'WITH CHECK (' || r.w || ')' ELSE '' END);
    END LOOP;
  END LOOP;
END $$;

CREATE TRIGGER bancos_instituicoes_atualizado BEFORE UPDATE ON public.bancos_instituicoes FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER bancos_contas_cosif_atualizado BEFORE UPDATE ON public.bancos_contas_cosif FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER bancos_declaracoes_atualizado BEFORE UPDATE ON public.bancos_declaracoes FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER bancos_ifdata_atualizado BEFORE UPDATE ON public.bancos_ifdata FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER bancos_modelos_atualizado BEFORE UPDATE ON public.bancos_modelos FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();