CREATE TABLE public.criterio_relatorios_encontrados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio text NOT NULL,
  url text NOT NULL,
  texto text NOT NULL DEFAULT '',
  tipo text,
  ano integer,
  vezes integer NOT NULL DEFAULT 1,
  primeiro_em timestamptz NOT NULL DEFAULT now(),
  ultimo_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criterio, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criterio_relatorios_encontrados TO authenticated;
GRANT ALL ON public.criterio_relatorios_encontrados TO service_role;
ALTER TABLE public.criterio_relatorios_encontrados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticados" ON public.criterio_relatorios_encontrados FOR SELECT TO authenticated USING (true);
CREATE POLICY "consultoria insere" ON public.criterio_relatorios_encontrados FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('superadmin','consultor')));
CREATE POLICY "consultoria atualiza" ON public.criterio_relatorios_encontrados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('superadmin','consultor')));
CREATE POLICY "consultoria apaga" ON public.criterio_relatorios_encontrados FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel IN ('superadmin','consultor')));