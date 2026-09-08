CREATE TABLE public.criterio_itens_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio text NOT NULL,
  codigo text NOT NULL,
  nome_oficial text NOT NULL,
  sinonimos text[] NOT NULL DEFAULT '{}',
  peso numeric,
  requisito text,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criterio, codigo)
);
GRANT SELECT ON public.criterio_itens_referencia TO authenticated;
GRANT ALL ON public.criterio_itens_referencia TO service_role;
ALTER TABLE public.criterio_itens_referencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens referencia leitura" ON public.criterio_itens_referencia FOR SELECT TO authenticated USING (true);
CREATE TRIGGER criterio_itens_referencia_atualizado_em BEFORE UPDATE ON public.criterio_itens_referencia FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.criterio_ranking_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio text NOT NULL,
  ano_base integer NOT NULL,
  fonte_relatorio text NOT NULL,
  municipio text NOT NULL,
  municipio_nome text NOT NULL,
  posicao integer,
  nota_final numeric NOT NULL DEFAULT 0,
  indice_percentual numeric NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (criterio, ano_base, fonte_relatorio, municipio)
);
GRANT SELECT ON public.criterio_ranking_municipio TO authenticated;
GRANT ALL ON public.criterio_ranking_municipio TO service_role;
ALTER TABLE public.criterio_ranking_municipio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ranking criterio leitura" ON public.criterio_ranking_municipio FOR SELECT TO authenticated USING (true);
CREATE INDEX criterio_ranking_busca ON public.criterio_ranking_municipio (criterio, ano_base, fonte_relatorio, municipio);
CREATE TRIGGER criterio_ranking_atualizado_em BEFORE UPDATE ON public.criterio_ranking_municipio FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE TABLE public.criterio_item_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio text NOT NULL,
  ano_base integer NOT NULL,
  fonte_relatorio text NOT NULL,
  municipio text NOT NULL,
  municipio_nome text NOT NULL,
  item_nome text NOT NULL,
  item_codigo text,
  peso numeric,
  pontuacao numeric,
  quantidade numeric,
  observacao text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.criterio_item_municipio TO authenticated;
GRANT ALL ON public.criterio_item_municipio TO service_role;
ALTER TABLE public.criterio_item_municipio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens criterio leitura" ON public.criterio_item_municipio FOR SELECT TO authenticated USING (true);
CREATE INDEX criterio_item_busca ON public.criterio_item_municipio (criterio, ano_base, fonte_relatorio, municipio);

CREATE TABLE public.criterio_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criterio text NOT NULL,
  ano_base integer NOT NULL,
  fonte_relatorio text NOT NULL,
  origem text NOT NULL,
  url text,
  arquivo_nome text,
  paginas integer NOT NULL DEFAULT 0,
  registros_ranking integer NOT NULL DEFAULT 0,
  registros_itens integer NOT NULL DEFAULT 0,
  municipios integer NOT NULL DEFAULT 0,
  nao_mapeados jsonb NOT NULL DEFAULT '[]'::jsonb,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  importado_por uuid,
  importado_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.criterio_importacoes TO authenticated;
GRANT ALL ON public.criterio_importacoes TO service_role;
ALTER TABLE public.criterio_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "importacoes leitura" ON public.criterio_importacoes FOR SELECT TO authenticated USING (true);
CREATE INDEX criterio_importacoes_busca ON public.criterio_importacoes (criterio, criado_em DESC);

INSERT INTO public.criterio_itens_referencia (criterio, codigo, nome_oficial, sinonimos, peso, requisito, ordem) VALUES
('turismo','tur_orgao','Órgão municipal de turismo','{"orgao municipal de turismo","secretaria de turismo","departamento de turismo"}',1,'Secretaria, departamento ou setor de turismo formalmente instituído por lei.',1),
('turismo','tur_conselho','Conselho Municipal de Turismo em funcionamento','{"conselho municipal de turismo","comtur"}',1,'COMTUR criado por lei, com atas de reuniões no ano-base.',2),
('turismo','tur_fundo','Fundo Municipal de Turismo com movimentação','{"fundo municipal de turismo","fumtur"}',1,'FUMTUR criado por lei, com receita e despesa executadas no ano-base.',3),
('turismo','tur_plano','Plano Municipal de Turismo','{"plano municipal de turismo","politica municipal de turismo"}',1,'Plano aprovado e vigente, com metas e prazos.',4),
('turismo','tur_circuito','Participação em Circuito Turístico certificado','{"circuito turistico","certificacao de circuito"}',1,'Adesão formal a circuito certificado pela SETUR/MG no ano-base.',5),
('turismo','tur_inventario','Inventário da Oferta Turística atualizado','{"inventario da oferta turistica","inventario turistico"}',1,'Inventário atualizado e enviado à SETUR/MG.',6),
('turismo','tur_cadastur','Prestadores cadastrados no Cadastur','{"cadastur","cadastro de prestadores"}',1,'Meios de hospedagem, agências e guias com cadastro ativo.',7),
('turismo','tur_orcamento','Recursos orçamentários aplicados em turismo','{"orcamento de turismo","dotacao de turismo"}',1,'Dotação própria executada no ano-base.',8),
('turismo','tur_patrimonio','Atrativos e patrimônio turístico protegidos','{"atrativos turisticos","patrimonio turistico"}',1,'Atrativos inventariados com medidas de proteção e sinalização.',9),
('meio_ambiente','ma_aterro','Aterro sanitário licenciado','{"aterro sanitario","disposicao final de residuos"}',NULL,'Aterro licenciado e operando com IQR igual ou superior a 7,0.',1),
('meio_ambiente','ma_utc','Usina de triagem e compostagem licenciada','{"usina de triagem","utc","compostagem"}',NULL,'UTC licenciada e em operação regular.',2),
('meio_ambiente','ma_ete','Estação de tratamento de esgoto em operação','{"estacao de tratamento de esgoto","ete","tratamento de esgoto"}',NULL,'ETE licenciada, com vazão tratada comprovada.',3),
('meio_ambiente','ma_coleta','Coleta seletiva com destinação regularizada','{"coleta seletiva","reciclagem"}',NULL,'Programa de coleta seletiva com associação/cooperativa e destinação licenciada.',4),
('meio_ambiente','ma_uc','Unidades de conservação registradas','{"unidade de conservacao","uc","icms ecologico mata"}',NULL,'UC municipal cadastrada no IEF/FEAM com plano de manejo e conselho.',5),
('meio_ambiente','ma_mata_seca','Áreas de mata seca inventariadas','{"mata seca"}',NULL,'Áreas de mata seca mapeadas e informadas ao órgão estadual.',6),
('meio_ambiente','ma_pmsb','Plano Municipal de Saneamento Básico atualizado','{"plano municipal de saneamento","pmsb"}',NULL,'Plano aprovado e revisado no prazo legal.',7),
('meio_ambiente','ma_pmgirs','Plano de Gestão Integrada de Resíduos Sólidos','{"plano de residuos solidos","pmgirs"}',NULL,'Plano aprovado, com metas de redução de rejeitos.',8),
('meio_ambiente','ma_conselho','Conselho e Fundo Municipal de Meio Ambiente','{"conselho municipal de meio ambiente","codema","fundo municipal de meio ambiente"}',NULL,'CODEMA ativo com atas e fundo com movimentação no ano-base.',9);