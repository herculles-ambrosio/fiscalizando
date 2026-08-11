create policy "uploads do seu municipio - leitura" on storage.objects
  for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = public.meu_municipio_id()::text);

create policy "uploads do seu municipio - insercao" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = public.meu_municipio_id()::text);

create policy "uploads do seu municipio - remocao" on storage.objects
  for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = public.meu_municipio_id()::text);