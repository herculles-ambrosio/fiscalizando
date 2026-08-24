ALTER TABLE public.indices_apurados ADD COLUMN IF NOT EXISTS detalhamento_path text;

CREATE POLICY "uploads permitidos - atualizacao"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'uploads' AND private.pode_ver_municipio(((storage.foldername(name))[1])::uuid))
WITH CHECK (bucket_id = 'uploads' AND private.pode_ver_municipio(((storage.foldername(name))[1])::uuid));