create table public.preferencias_usuario (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  criado_em timestamp with time zone not null default now(),
  atualizado_em timestamp with time zone not null default now(),
  primary key (usuario_id, chave)
);

grant select, insert, update, delete on public.preferencias_usuario to authenticated;
grant all on public.preferencias_usuario to service_role;

alter table public.preferencias_usuario enable row level security;

create policy "Usuario le suas preferencias"
  on public.preferencias_usuario for select to authenticated
  using (usuario_id = auth.uid());

create policy "Usuario cria suas preferencias"
  on public.preferencias_usuario for insert to authenticated
  with check (usuario_id = auth.uid());

create policy "Usuario atualiza suas preferencias"
  on public.preferencias_usuario for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "Usuario apaga suas preferencias"
  on public.preferencias_usuario for delete to authenticated
  using (usuario_id = auth.uid());

create trigger preferencias_usuario_atualizado_em
  before update on public.preferencias_usuario
  for each row execute function public.set_atualizado_em();