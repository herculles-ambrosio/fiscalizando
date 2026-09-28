create table public.noticias_fontes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text not null unique,
  tipo text not null default 'rss' check (tipo in ('rss','pagina')),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.noticias_fontes to authenticated;
grant all on public.noticias_fontes to service_role;
alter table public.noticias_fontes enable row level security;
create policy "fontes leitura" on public.noticias_fontes for select to authenticated using (true);
create policy "fontes escrita consultoria" on public.noticias_fontes for all to authenticated using (private.eh_consultoria()) with check (private.eh_consultoria());

create table public.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumo text,
  url text not null unique,
  fonte text,
  publicada_em timestamptz not null default now(),
  temas text[] not null default '{}',
  origem text not null default 'auto' check (origem in ('auto','manual')),
  fixada boolean not null default false,
  oculta boolean not null default false,
  criado_por uuid,
  criado_em timestamptz not null default now()
);
create index noticias_publicada_idx on public.noticias (publicada_em desc);
grant select, insert, update, delete on public.noticias to authenticated;
grant all on public.noticias to service_role;
alter table public.noticias enable row level security;
create policy "noticias leitura" on public.noticias for select to authenticated using (not oculta or private.eh_consultoria());
create policy "noticias escrita consultoria" on public.noticias for all to authenticated using (private.eh_consultoria()) with check (private.eh_consultoria());

insert into public.noticias_fontes (nome, url, tipo) values
 ('Agência Minas', 'https://www.agenciaminas.mg.gov.br/rss', 'rss'),
 ('Receita Federal', 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/RSS', 'rss'),
 ('AMM - Associação Mineira de Municípios', 'https://portalamm.org.br/feed/', 'rss'),
 ('SEF-MG - Notícias', 'https://www.fazenda.mg.gov.br/noticias/', 'pagina'),
 ('TCE-MG', 'https://www.tce.mg.gov.br/noticias/', 'pagina'),
 ('CNM - Confederação Nacional de Municípios', 'https://cnm.org.br/comunicacao/noticias', 'pagina'),
 ('Google Notícias - VAF/ICMS MG', 'https://news.google.com/rss/search?q=(VAF+OR+ICMS+OR+ITBI+OR+ISS+OR+%22nota+fiscal%22)+munic%C3%ADpios+Minas+Gerais&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss'),
 ('Google Notícias - Reforma Tributária municípios', 'https://news.google.com/rss/search?q=reforma+tribut%C3%A1ria+munic%C3%ADpios+IBS&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss');