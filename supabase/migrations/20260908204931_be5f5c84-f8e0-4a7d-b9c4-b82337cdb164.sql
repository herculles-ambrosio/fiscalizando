CREATE TABLE public.esportes_atividades_referencia (
  codigo text PRIMARY KEY,
  nome_oficial text NOT NULL,
  sinonimos text[] NOT NULL DEFAULT '{}',
  peso numeric NOT NULL,
  requisito text NOT NULL DEFAULT '',
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esportes_atividades_referencia TO authenticated;
GRANT ALL ON public.esportes_atividades_referencia TO service_role;
ALTER TABLE public.esportes_atividades_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Atividades de referencia visiveis para autenticados"
  ON public.esportes_atividades_referencia FOR SELECT TO authenticated USING (true);

CREATE TABLE public.esportes_ranking_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_base integer NOT NULL,
  fonte_relatorio text NOT NULL CHECK (fonte_relatorio IN ('preliminar','definitivo')),
  municipio text NOT NULL,
  municipio_nome text NOT NULL,
  posicao integer,
  nota_atividades numeric NOT NULL DEFAULT 0,
  nota_jimi numeric NOT NULL DEFAULT 0,
  nota_jemg numeric NOT NULL DEFAULT 0,
  nota_babt numeric NOT NULL DEFAULT 0,
  nota_final numeric NOT NULL DEFAULT 0,
  indice_percentual numeric NOT NULL DEFAULT 0,
  data_ingestao timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano_base, fonte_relatorio, municipio)
);
GRANT SELECT ON public.esportes_ranking_municipio TO authenticated;
GRANT ALL ON public.esportes_ranking_municipio TO service_role;
ALTER TABLE public.esportes_ranking_municipio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking de esportes visivel para autenticados"
  ON public.esportes_ranking_municipio FOR SELECT TO authenticated USING (true);
CREATE INDEX esportes_ranking_ano_idx ON public.esportes_ranking_municipio (ano_base, fonte_relatorio);
CREATE INDEX esportes_ranking_municipio_idx ON public.esportes_ranking_municipio (municipio);

CREATE TABLE public.esportes_atividade_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_base integer NOT NULL,
  fonte_relatorio text NOT NULL CHECK (fonte_relatorio IN ('preliminar','definitivo')),
  municipio text NOT NULL,
  municipio_nome text NOT NULL,
  atividade_nome text NOT NULL,
  atividade_codigo text REFERENCES public.esportes_atividades_referencia(codigo),
  peso_anexo_v numeric,
  peso_rcl numeric,
  pontuacao_atletas numeric,
  pontuacao_modalidades numeric,
  pontuacao numeric,
  eventos_texto text NOT NULL DEFAULT '',
  qtd_eventos integer NOT NULL DEFAULT 0,
  total_participantes integer NOT NULL DEFAULT 0,
  modalidades_texto text NOT NULL DEFAULT '',
  data_ingestao timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.esportes_atividade_municipio TO authenticated;
GRANT ALL ON public.esportes_atividade_municipio TO service_role;
ALTER TABLE public.esportes_atividade_municipio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Atividades de esportes visiveis para autenticados"
  ON public.esportes_atividade_municipio FOR SELECT TO authenticated USING (true);
CREATE INDEX esportes_atividade_ano_idx ON public.esportes_atividade_municipio (ano_base, fonte_relatorio);
CREATE INDEX esportes_atividade_municipio_idx ON public.esportes_atividade_municipio (municipio);

INSERT INTO public.esportes_atividades_referencia (codigo, nome_oficial, sinonimos, peso, requisito, ordem) VALUES
('PSE','Projetos Sócio-Educacionais', ARRAY['PROJETOS SOCIO EDUCACIONAIS','PROJETOS SOCIOEDUCACIONAIS'], 0.5, 'Projetos esportivos com contrapartida socioeducacional, com frequência regular e documentação de atendidos.', 1),
('EPD','Esporte para Pessoas com Deficiência', ARRAY['ESPORTE PARA PESSOAS COM DEFICIENCIA','ESPORTE PARA PESSOA COM DEFICIENCIA'], 1.0, 'Atividades esportivas voltadas a pessoas com deficiência, com registro de participantes e modalidades adaptadas.', 2),
('JEM','Jogos Escolares Municipais', ARRAY['JOGOS ESCOLARES MUNICIPAIS'], 1.0, 'Realização de jogos escolares no município, com regulamento, escolas participantes e resultados.', 3),
('JEMG','Jogos Escolares de Minas Gerais', ARRAY['JOGOS ESCOLARES DE MINAS GERAIS','JEMG'], 1.0, 'Participação oficial do município no JEMG (dados fornecidos pela Subesp).', 4),
('JIMI','Jogos Interior de Minas Gerais', ARRAY['JOGOS DO INTERIOR DE MINAS','MINAS ESPORTIVA JOGOS DE MINAS GERAIS','JIMI'], 0.5, 'Participação oficial do município no JIMI (dados fornecidos pela Subesp).', 5),
('AFA','Atividades Futebol Amador', ARRAY['ATIVIDADES FUTEBOL AMADOR','ATIVIDADES DE FUTEBOL AMADOR'], 0.5, 'Campeonatos e atividades de futebol amador organizados ou apoiados pelo município.', 6),
('ETI','Esporte Terceira Idade', ARRAY['ESPORTE TERCEIRA IDADE','ESPORTE NA TERCEIRA IDADE'], 1.0, 'Atividades esportivas regulares para pessoas idosas, com lista de participantes.', 7),
('AL','Atividades de Lazer', ARRAY['ATIVIDADES DE LAZER'], 0.5, 'Eventos e programas de lazer abertos à comunidade.', 8),
('QAE','Qualificação de Agente Esportivo', ARRAY['QUALIFICACAO DE AGENTE ESPORTIVO','QUALIFICACAO AGENTE ESPORTIVO'], 1.0, 'Cursos e capacitações para agentes esportivos, com carga horária e lista de presença.', 9),
('XE','Xadrez na Escola', ARRAY['XADREZ NA ESCOLA'], 0.5, 'Programa de xadrez nas escolas municipais, com turmas e professores designados.', 10),
('AE','Academia na Escola', ARRAY['ACADEMIA NA ESCOLA'], 0.5, 'Uso de espaços escolares para atividades físicas orientadas fora do horário de aula.', 11),
('PP','Outros Programas/Projetos', ARRAY['OUTROS PROGRAMAS E PROJETOS','OUTROS PROGRAMAS/PROJETOS'], 1.5, 'Demais programas e projetos esportivos cadastrados no Sistema de Informação ICMS Esportivo.', 12),
('IREE','Instalação/Reforma/Equipamento Esportivo', ARRAY['INSTALACAO/REFORMA/EQUIPAMENTO ESPORTIVO','INSTALACAO REFORMA EQUIPAMENTO ESPORTIVO'], 0.5, 'Obras de instalação ou reforma e aquisição de equipamentos esportivos, comprovadas por notas e fotos.', 13),
('BABTE','Bolsa Atleta e Bolsa-Técnico (Municipal/Estadual)', ARRAY['BOLSA ATLETA E BOLSA TECNICO - ESTADUAL E MUNICIPAL -BABTE','BOLSA ATLETA E BOLSA TECNICO ESTADUAL E MUNICIPAL BABTE','BOLSA ATLETA E BOLSA-TECNICO'], 1.0, 'Concessão de bolsas a atletas e técnicos por lei municipal, ou atletas contemplados pela bolsa estadual.', 14);