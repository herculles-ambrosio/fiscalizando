alter table public.icms_cargas add column if not exists payload jsonb;

create table if not exists public.icms_comparativos_salvos (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios(id),
  nome text not null,
  exercicio integer not null,
  criterio text not null default 'total',
  municipios text[] not null default '{}',
  observacao text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

grant select, insert, update, delete on public.icms_comparativos_salvos to authenticated;
grant all on public.icms_comparativos_salvos to service_role;

alter table public.icms_comparativos_salvos enable row level security;

create policy icms_comparativos_salvos_select on public.icms_comparativos_salvos for select to authenticated using (private.pode_ver_municipio(municipio_id));
create policy icms_comparativos_salvos_insert on public.icms_comparativos_salvos for insert to authenticated with check (private.pode_ver_municipio(municipio_id));
create policy icms_comparativos_salvos_update on public.icms_comparativos_salvos for update to authenticated using (private.pode_ver_municipio(municipio_id)) with check (private.pode_ver_municipio(municipio_id));
create policy icms_comparativos_salvos_delete on public.icms_comparativos_salvos for delete to authenticated using (private.pode_ver_municipio(municipio_id));

create trigger icms_comparativos_salvos_atualizado_em before update on public.icms_comparativos_salvos for each row execute function public.set_atualizado_em();