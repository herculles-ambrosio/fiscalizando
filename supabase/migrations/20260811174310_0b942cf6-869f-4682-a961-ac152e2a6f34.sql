CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.meu_municipio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT municipio_id FROM public.perfis WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION private.meu_municipio_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.meu_municipio_id() TO authenticated, service_role;

-- public policies
DROP POLICY IF EXISTS "ve seu municipio" ON public.municipios;
CREATE POLICY "ve seu municipio" ON public.municipios FOR SELECT TO authenticated
USING (id = private.meu_municipio_id());

DROP POLICY IF EXISTS "ve seu perfil e colegas" ON public.perfis;
CREATE POLICY "ve seu perfil e colegas" ON public.perfis FOR SELECT TO authenticated
USING (municipio_id = private.meu_municipio_id());

DROP POLICY IF EXISTS "cargas do seu municipio" ON public.cargas;
CREATE POLICY "cargas do seu municipio" ON public.cargas FOR ALL TO authenticated
USING (municipio_id = private.meu_municipio_id())
WITH CHECK (municipio_id = private.meu_municipio_id());

DROP POLICY IF EXISTS "contribuintes do seu municipio" ON public.contribuintes_apurados;
CREATE POLICY "contribuintes do seu municipio" ON public.contribuintes_apurados FOR ALL TO authenticated
USING (municipio_id = private.meu_municipio_id())
WITH CHECK (municipio_id = private.meu_municipio_id());

DROP POLICY IF EXISTS "ve configuracoes do seu municipio" ON public.configuracoes_municipio;
CREATE POLICY "ve configuracoes do seu municipio" ON public.configuracoes_municipio FOR SELECT TO authenticated
USING (municipio_id = private.meu_municipio_id());

DROP POLICY IF EXISTS "admin cria configuracoes do seu municipio" ON public.configuracoes_municipio;
CREATE POLICY "admin cria configuracoes do seu municipio" ON public.configuracoes_municipio FOR INSERT TO authenticated
WITH CHECK (
  municipio_id = private.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

DROP POLICY IF EXISTS "admin edita configuracoes do seu municipio" ON public.configuracoes_municipio;
CREATE POLICY "admin edita configuracoes do seu municipio" ON public.configuracoes_municipio FOR UPDATE TO authenticated
USING (
  municipio_id = private.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
)
WITH CHECK (
  municipio_id = private.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

-- storage policies
DROP POLICY IF EXISTS "uploads do seu municipio - leitura" ON storage.objects;
CREATE POLICY "uploads do seu municipio - leitura" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = private.meu_municipio_id()::text);

DROP POLICY IF EXISTS "uploads do seu municipio - insercao" ON storage.objects;
CREATE POLICY "uploads do seu municipio - insercao" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = private.meu_municipio_id()::text);

DROP POLICY IF EXISTS "uploads do seu municipio - remocao" ON storage.objects;
CREATE POLICY "uploads do seu municipio - remocao" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = private.meu_municipio_id()::text);

DROP POLICY IF EXISTS "brasao visivel para o municipio" ON storage.objects;
CREATE POLICY "brasao visivel para o municipio" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brasoes' AND (storage.foldername(name))[1] = private.meu_municipio_id()::text);

DROP POLICY IF EXISTS "admin envia brasao do municipio" ON storage.objects;
CREATE POLICY "admin envia brasao do municipio" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = private.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

DROP POLICY IF EXISTS "admin atualiza brasao do municipio" ON storage.objects;
CREATE POLICY "admin atualiza brasao do municipio" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = private.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

DROP POLICY IF EXISTS "admin remove brasao do municipio" ON storage.objects;
CREATE POLICY "admin remove brasao do municipio" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = private.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

DROP FUNCTION IF EXISTS public.meu_municipio_id();

-- perfis: block privilege escalation via papel/municipio_id changes
CREATE OR REPLACE FUNCTION public.perfis_bloqueia_escalonamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Perfis so podem ser criados por administracao interna';
  END IF;
  IF NEW.papel IS DISTINCT FROM OLD.papel OR NEW.municipio_id IS DISTINCT FROM OLD.municipio_id OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Alteracao de papel ou municipio nao permitida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfis_bloqueia_escalonamento ON public.perfis;
CREATE TRIGGER perfis_bloqueia_escalonamento
BEFORE INSERT OR UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.perfis_bloqueia_escalonamento();