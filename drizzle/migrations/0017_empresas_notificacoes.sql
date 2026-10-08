CREATE TABLE public.empresas_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  observacao text NOT NULL DEFAULT 'ATIVA_SEM_CADASTRO',
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_modelos TO authenticated;
GRANT ALL ON public.empresas_modelos TO service_role;
ALTER TABLE public.empresas_modelos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.empresas_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  nome text,
  observacao text NOT NULL,
  modelo_chave text NOT NULL,
  modelo_nome text NOT NULL,
  emitido_por uuid,
  emitido_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.empresas_notificacoes TO authenticated;
GRANT ALL ON public.empresas_notificacoes TO service_role;
ALTER TABLE public.empresas_notificacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.empresas_notificacoes (municipio_id, criado_em DESC);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS q, pg_get_expr(polwithcheck, polrelid) AS w
           FROM pg_policy WHERE polrelid = 'public.cartorio_modelos'::regclass LOOP
    EXECUTE format('CREATE POLICY %I ON public.empresas_modelos AS PERMISSIVE FOR %s TO authenticated %s %s',
      r.polname,
      CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
      CASE WHEN r.q IS NOT NULL THEN 'USING (' || r.q || ')' ELSE '' END,
      CASE WHEN r.w IS NOT NULL THEN 'WITH CHECK (' || r.w || ')' ELSE '' END);
    IF r.polcmd IN ('r','a','d') THEN
      EXECUTE format('CREATE POLICY %I ON public.empresas_notificacoes AS PERMISSIVE FOR %s TO authenticated %s %s',
        r.polname,
        CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' ELSE 'DELETE' END,
        CASE WHEN r.q IS NOT NULL THEN 'USING (' || r.q || ')' ELSE '' END,
        CASE WHEN r.w IS NOT NULL THEN 'WITH CHECK (' || r.w || ')' ELSE '' END);
    END IF;
  END LOOP;
END $$;

CREATE TRIGGER empresas_modelos_atualizado BEFORE UPDATE ON public.empresas_modelos
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();