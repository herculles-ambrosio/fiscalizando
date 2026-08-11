CREATE POLICY "brasao visivel para o municipio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = public.meu_municipio_id()::text
);

CREATE POLICY "admin envia brasao do municipio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = public.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

CREATE POLICY "admin atualiza brasao do municipio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = public.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

CREATE POLICY "admin remove brasao do municipio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brasoes'
  AND (storage.foldername(name))[1] = public.meu_municipio_id()::text
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);