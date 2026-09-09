CREATE TABLE public.educacao_dados_constitutivos (
  id uuid primary key default gen_random_uuid(),
  exercicio integer not null,
  fonte_versao text not null check (fonte_versao in ('provisorio','definitivo')),
  municipio text not null,
  municipio_nome text not null,
  coluna_origem text not null,
  valor_num numeric,
  valor_texto text,
  criado_em timestamptz not null default now()
);
CREATE UNIQUE INDEX educacao_dc_unico ON public.educacao_dados_constitutivos (exercicio, fonte_versao, municipio, coluna_origem);
CREATE INDEX educacao_dc_busca ON public.educacao_dados_constitutivos (exercicio, fonte_versao, municipio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educacao_dados_constitutivos TO authenticated;
GRANT ALL ON public.educacao_dados_constitutivos TO service_role;
ALTER TABLE public.educacao_dados_constitutivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "educacao dc leitura" ON public.educacao_dados_constitutivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "educacao dc escrita consultoria" ON public.educacao_dados_constitutivos FOR ALL TO authenticated USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());

CREATE TABLE public.educacao_recursos (
  id uuid primary key default gen_random_uuid(),
  exercicio integer not null,
  fonte_versao text not null default 'definitivo' check (fonte_versao in ('provisorio','definitivo')),
  municipio text not null,
  municipio_nome text not null,
  item_contestado text not null,
  resultado text,
  criado_em timestamptz not null default now()
);
CREATE INDEX educacao_recursos_busca ON public.educacao_recursos (exercicio, municipio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educacao_recursos TO authenticated;
GRANT ALL ON public.educacao_recursos TO service_role;
ALTER TABLE public.educacao_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "educacao recursos leitura" ON public.educacao_recursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "educacao recursos escrita consultoria" ON public.educacao_recursos FOR ALL TO authenticated USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());

CREATE TABLE public.educacao_calendario (
  exercicio integer primary key,
  data_publicacao_provisorio date,
  data_limite_recurso date,
  data_publicacao_definitivo date,
  peso_irap numeric not null default 0.50,
  peso_ire numeric not null default 0.20,
  peso_iae numeric not null default 0.15,
  peso_ige numeric not null default 0.15,
  resolucao_referencia text,
  nota_tecnica text,
  email_recurso text not null default 'leirobin@fjp.mg.gov.br',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educacao_calendario TO authenticated;
GRANT ALL ON public.educacao_calendario TO service_role;
ALTER TABLE public.educacao_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "educacao calendario leitura" ON public.educacao_calendario FOR SELECT TO authenticated USING (true);
CREATE POLICY "educacao calendario escrita consultoria" ON public.educacao_calendario FOR ALL TO authenticated USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());
CREATE TRIGGER educacao_calendario_atualizado_em BEFORE UPDATE ON public.educacao_calendario FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.criterio_itens_referencia (criterio, codigo, nome_oficial, sinonimos, peso, requisito, ordem)
VALUES
 ('educacao','edu_irap','Índice de Desempenho Escolar (IRAP)', ARRAY['irap','desempenho escolar','indice de desempenho escolar'], 50, 'Resultados das avaliações externas do 2º, 5º e 9º ano da rede municipal, ponderados por participação e nível socioeconômico.', 1),
 ('educacao','edu_ire','Índice de Rendimento Escolar (IRE)', ARRAY['ire','rendimento escolar','indice de rendimento escolar'], 20, 'Aprovação, abandono e adequação idade-série, com ponderação de equidade e inclusão.', 2),
 ('educacao','edu_iae','Índice de Atendimento Educacional (IAE)', ARRAY['iae','atendimento educacional','indice de atendimento educacional'], 15, 'Tempo integral, atendimento em área rural e quilombola e alfabetização de adultos.', 3),
 ('educacao','edu_ige','Índice de Gestão Escolar (IGE)', ARRAY['ige','gestao escolar','indice de gestao escolar'], 15, 'Censo escolar: infraestrutura, acessibilidade, formação dos profissionais e gestão democrática.', 4)
ON CONFLICT DO NOTHING;