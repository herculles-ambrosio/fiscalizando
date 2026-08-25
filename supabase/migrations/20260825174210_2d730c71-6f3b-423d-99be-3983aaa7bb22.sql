create or replace function private.cnpj_no_meu_escopo(_cnpj text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select _cnpj is not null and (
    private.eh_consultoria()
    or exists (
      select 1 from public.contribuintes_apurados c
      where c.cnpj = _cnpj
        and private.pode_ver_municipio(c.municipio_id)
    )
    or exists (
      select 1 from public.acoes_recuperacao a
      where a.cnpj = _cnpj
        and private.pode_ver_municipio(a.municipio_id)
    )
  )
$$;

revoke execute on function private.cnpj_no_meu_escopo(text) from public, anon;
grant execute on function private.cnpj_no_meu_escopo(text) to authenticated, service_role;

drop policy if exists "Autenticados podem ler situacoes da Receita" on public.situacoes_receita;
create policy "Situacoes da Receita apenas do meu escopo"
  on public.situacoes_receita
  for select to authenticated
  using (private.cnpj_no_meu_escopo(cnpj));

drop policy if exists "receita_fila_leitura_autenticados" on public.receita_fila;
create policy "receita_fila_leitura_do_meu_escopo"
  on public.receita_fila
  for select to authenticated
  using (private.cnpj_no_meu_escopo(cnpj));