create table public.municipios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf text not null default 'MG',
  codigo_sef text not null,
  criado_em timestamptz not null default now()
);

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  municipio_id uuid not null references public.municipios(id) on delete cascade,
  nome text,
  papel text not null default 'operador' check (papel in ('admin','operador','leitura')),
  criado_em timestamptz not null default now()
);

create table public.cargas (
  id uuid primary key default gen_random_uuid(),
  municipio_id uuid not null references public.municipios(id) on delete cascade,
  exercicio int not null,
  arquivo_ativos_path text,
  arquivo_retorno_path text,
  status text not null default 'pendente' check (status in ('pendente','processando','concluida','erro')),
  mensagem_erro text,
  limiar_discrepancia numeric not null default 0.30,
  data_limite_entrega date,
  total_ativos int,
  total_omissos int,
  total_zerados int,
  total_fora_prazo int,
  total_discrepantes int,
  total_normais int,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  concluida_em timestamptz
);

create table public.contribuintes_apurados (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid not null references public.cargas(id) on delete cascade,
  municipio_id uuid not null references public.municipios(id) on delete cascade,
  inscricao_estadual text not null,
  cnpj text,
  nome text,
  endereco text,
  cnae text,
  entregou_declaracao boolean not null default false,
  vaf_atual numeric,
  vaf_anterior numeric,
  variacao_pct numeric,
  data_entrega date,
  situacoes text[] not null default '{}',
  oficio_path text,
  criado_em timestamptz not null default now()
);
create index idx_contrib_carga on public.contribuintes_apurados(carga_id);
create index idx_contrib_municipio on public.contribuintes_apurados(municipio_id);
create index idx_contrib_situacoes on public.contribuintes_apurados using gin(situacoes);
create index idx_cargas_municipio on public.cargas(municipio_id, exercicio);

grant select on public.municipios to authenticated;
grant all on public.municipios to service_role;
grant select on public.perfis to authenticated;
grant all on public.perfis to service_role;
grant select, insert, update, delete on public.cargas to authenticated;
grant all on public.cargas to service_role;
grant select, insert, update, delete on public.contribuintes_apurados to authenticated;
grant all on public.contribuintes_apurados to service_role;

alter table public.municipios enable row level security;
alter table public.perfis enable row level security;
alter table public.cargas enable row level security;
alter table public.contribuintes_apurados enable row level security;

create or replace function public.meu_municipio_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select municipio_id from public.perfis where id = auth.uid()
$$;

create policy "ve seu municipio" on public.municipios
  for select to authenticated using (id = public.meu_municipio_id());

create policy "ve seu perfil e colegas" on public.perfis
  for select to authenticated using (municipio_id = public.meu_municipio_id());

create policy "cargas do seu municipio" on public.cargas
  for all to authenticated
  using (municipio_id = public.meu_municipio_id())
  with check (municipio_id = public.meu_municipio_id());

create policy "contribuintes do seu municipio" on public.contribuintes_apurados
  for all to authenticated
  using (municipio_id = public.meu_municipio_id())
  with check (municipio_id = public.meu_municipio_id());

insert into public.municipios (nome, uf, codigo_sef) values ('Nanuque', 'MG', '443');

alter publication supabase_realtime add table public.cargas;