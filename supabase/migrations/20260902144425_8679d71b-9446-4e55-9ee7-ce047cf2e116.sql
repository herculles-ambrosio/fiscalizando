create table if not exists public.icms_checklist (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios(id),
  exercicio integer not null,
  criterio text not null,
  item_codigo text not null,
  situacao text not null default 'nao_avaliado',
  observacao text,
  evidencia text,
  responsavel text,
  prazo date,
  atualizado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (municipio_id, exercicio, criterio, item_codigo)
);

grant select, insert, update, delete on public.icms_checklist to authenticated;
grant all on public.icms_checklist to service_role;

alter table public.icms_checklist enable row level security;

create policy icms_checklist_select on public.icms_checklist for select to authenticated using (private.pode_ver_municipio(municipio_id));
create policy icms_checklist_insert on public.icms_checklist for insert to authenticated with check (private.pode_ver_municipio(municipio_id));
create policy icms_checklist_update on public.icms_checklist for update to authenticated using (private.pode_ver_municipio(municipio_id)) with check (private.pode_ver_municipio(municipio_id));
create policy icms_checklist_delete on public.icms_checklist for delete to authenticated using (private.pode_ver_municipio(municipio_id));

create trigger icms_checklist_atualizado_em before update on public.icms_checklist for each row execute function public.set_atualizado_em();

alter table public.icms_acoes add column if not exists item_codigo text;