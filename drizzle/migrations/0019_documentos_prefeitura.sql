CREATE TABLE public.documentos_prefeitura_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  chave text NOT NULL,
  nome text NOT NULL,
  destinatario text NOT NULL DEFAULT 'ambos',
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
  UNIQUE (municipio_id, modulo, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_prefeitura_modelos TO authenticated;
GRANT ALL ON public.documentos_prefeitura_modelos TO service_role;
ALTER TABLE public.documentos_prefeitura_modelos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS q, pg_get_expr(polwithcheck, polrelid) AS w
           FROM pg_policy WHERE polrelid = 'public.cartorio_modelos'::regclass LOOP
    EXECUTE format('CREATE POLICY %I ON public.documentos_prefeitura_modelos AS PERMISSIVE FOR %s TO authenticated %s %s',
      r.polname,
      CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
      CASE WHEN r.q IS NOT NULL THEN 'USING (' || r.q || ')' ELSE '' END,
      CASE WHEN r.w IS NOT NULL THEN 'WITH CHECK (' || r.w || ')' ELSE '' END);
  END LOOP;
END $$;

CREATE TRIGGER documentos_prefeitura_modelos_atualizado BEFORE UPDATE ON public.documentos_prefeitura_modelos
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();