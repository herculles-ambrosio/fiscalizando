-- papeis
alter table public.perfis alter column municipio_id drop not null;
alter table public.perfis add column if not exists precisa_trocar_senha boolean not null default false;

drop trigger if exists perfis_bloqueia_escalonamento on public.perfis;

update public.perfis set papel = 'prefeitura_admin' where papel = 'admin';
update public.perfis set papel = 'prefeitura_operador' where papel = 'operador';

alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check
  check (papel in ('superadmin','consultor','prefeitura_admin','prefeitura_operador'));
alter table public.perfis drop constraint if exists perfis_municipio_por_papel;
alter table public.perfis add constraint perfis_municipio_por_papel check (
  (papel in ('superadmin','consultor') and municipio_id is null)
  or (papel in ('prefeitura_admin','prefeitura_operador') and municipio_id is not null)
);
alter table public.perfis alter column papel set default 'prefeitura_operador';

-- funcoes privadas
create or replace function private.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;

create or replace function private.eh_consultoria()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel in ('superadmin','consultor'))
$$;

create or replace function private.eh_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'superadmin')
$$;

create or replace function private.pode_ver_municipio(_municipio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.eh_consultoria()
      or (_municipio_id is not null and _municipio_id = private.meu_municipio_id())
$$;

create or replace function private.eh_admin_municipio(_municipio_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.eh_consultoria()
      or exists (
        select 1 from public.perfis
        where id = auth.uid() and papel = 'prefeitura_admin' and municipio_id = _municipio_id
      )
$$;

revoke all on function private.meu_papel(), private.eh_consultoria(), private.eh_superadmin(),
  private.pode_ver_municipio(uuid), private.eh_admin_municipio(uuid) from public;
grant execute on function private.meu_papel(), private.eh_consultoria(), private.eh_superadmin(),
  private.pode_ver_municipio(uuid), private.eh_admin_municipio(uuid) to authenticated, service_role;

-- trigger anti-escalonamento
create or replace function public.perfis_bloqueia_escalonamento()
returns trigger language plpgsql set search_path = public as $function$
begin
  if current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Perfis so podem ser criados pela administracao';
  end if;
  if new.papel is distinct from old.papel
     or new.municipio_id is distinct from old.municipio_id
     or new.id is distinct from old.id then
    raise exception 'Alteracao de papel ou municipio nao permitida';
  end if;
  return new;
end;
$function$;

create trigger perfis_bloqueia_escalonamento
before insert or update on public.perfis
for each row execute function public.perfis_bloqueia_escalonamento();

-- politicas: perfis
drop policy if exists "ve seu perfil e colegas" on public.perfis;
create policy "ve perfis permitidos" on public.perfis for select to authenticated
  using (id = auth.uid() or private.eh_consultoria() or private.pode_ver_municipio(municipio_id));
create policy "atualiza o proprio perfil" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- politicas: municipios
drop policy if exists "ve seu municipio" on public.municipios;
create policy "ve municipios permitidos" on public.municipios for select to authenticated
  using (private.pode_ver_municipio(id));
create policy "superadmin cria municipios" on public.municipios for insert to authenticated
  with check (private.eh_superadmin());
create policy "superadmin edita municipios" on public.municipios for update to authenticated
  using (private.eh_superadmin()) with check (private.eh_superadmin());

-- politicas: cargas
drop policy if exists "cargas do seu municipio" on public.cargas;
create policy "cargas permitidas" on public.cargas for all to authenticated
  using (private.pode_ver_municipio(municipio_id))
  with check (private.pode_ver_municipio(municipio_id));

-- politicas: contribuintes
drop policy if exists "contribuintes do seu municipio" on public.contribuintes_apurados;
create policy "contribuintes permitidos" on public.contribuintes_apurados for all to authenticated
  using (private.pode_ver_municipio(municipio_id))
  with check (private.pode_ver_municipio(municipio_id));

-- politicas: configuracoes
drop policy if exists "ve configuracoes do seu municipio" on public.configuracoes_municipio;
drop policy if exists "admin cria configuracoes do seu municipio" on public.configuracoes_municipio;
drop policy if exists "admin edita configuracoes do seu municipio" on public.configuracoes_municipio;
create policy "ve configuracoes permitidas" on public.configuracoes_municipio for select to authenticated
  using (private.pode_ver_municipio(municipio_id));
create policy "cria configuracoes permitidas" on public.configuracoes_municipio for insert to authenticated
  with check (private.eh_admin_municipio(municipio_id));
create policy "edita configuracoes permitidas" on public.configuracoes_municipio for update to authenticated
  using (private.eh_admin_municipio(municipio_id))
  with check (private.eh_admin_municipio(municipio_id));

-- politicas: storage
drop policy if exists "uploads do seu municipio - leitura" on storage.objects;
drop policy if exists "uploads do seu municipio - insercao" on storage.objects;
drop policy if exists "uploads do seu municipio - remocao" on storage.objects;
drop policy if exists "brasao visivel para o municipio" on storage.objects;
drop policy if exists "admin envia brasao do municipio" on storage.objects;
drop policy if exists "admin atualiza brasao do municipio" on storage.objects;
drop policy if exists "admin remove brasao do municipio" on storage.objects;

create policy "uploads permitidos - leitura" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and private.pode_ver_municipio(((storage.foldername(name))[1])::uuid));
create policy "uploads permitidos - insercao" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and private.pode_ver_municipio(((storage.foldername(name))[1])::uuid));
create policy "uploads permitidos - remocao" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and private.pode_ver_municipio(((storage.foldername(name))[1])::uuid));

create policy "brasao permitido - leitura" on storage.objects for select to authenticated
  using (bucket_id = 'brasoes' and private.pode_ver_municipio(((storage.foldername(name))[1])::uuid));
create policy "brasao permitido - insercao" on storage.objects for insert to authenticated
  with check (bucket_id = 'brasoes' and private.eh_admin_municipio(((storage.foldername(name))[1])::uuid));
create policy "brasao permitido - atualizacao" on storage.objects for update to authenticated
  using (bucket_id = 'brasoes' and private.eh_admin_municipio(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'brasoes' and private.eh_admin_municipio(((storage.foldername(name))[1])::uuid));
create policy "brasao permitido - remocao" on storage.objects for delete to authenticated
  using (bucket_id = 'brasoes' and private.eh_admin_municipio(((storage.foldername(name))[1])::uuid));