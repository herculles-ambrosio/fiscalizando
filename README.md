# Apura VAF 2.0

Prompt de construção — Sistema de Apuração VAF Multi-Prefeituras (Supabase)

 

1. Visão geral do produto

Construir um sistema web multi-tenant (várias prefeituras usando o mesmo sistema, cada uma vendo só os próprios dados) para apuração do VAF (Valor Adicionado Fiscal) municipal em Minas Gerais. O sistema deve:

Permitir que cada prefeitura faça upload de 2 arquivos-texto de largura fixa por exercício: o Arquivo de Contribuintes Ativos e o Arquivo de Retorno VAF/DAMEF (emitidos pela SEF-MG).

Fazer o parse desses arquivos (posições fixas, documentadas na Seção 7) e apurar, para cada contribuinte, a situação: Omisso, Zerado, Fora do Prazo, Discrepante (variação de VAF vs. exercício anterior acima de um limiar) ou Normal.

Mostrar um dashboard com resumo (contadores por situação, gráfico por CNAE) e uma tabela filtrável/pesquisável de todos os contribuintes.

Gerar, sob demanda, um ofício de retificação (documento formal) para cada contribuinte Omisso ou Zerado, e permitir baixar todos em lote (zip) ou individual.

Manter histórico: cada upload gera uma "carga" vinculada a um exercício; a prefeitura pode comparar cargas de exercícios diferentes.

2. Stack

Frontend: o que o Ready gerar por padrão (React), com Tailwind.

Backend/dados: Supabase — Postgres (com Row Level Security para multi-tenancy), Supabase Auth (login por e-mail/senha), Supabase Storage (arquivos enviados e gerados) e Edge Functions (Deno/TypeScript) para o parsing pesado e geração de documentos.

Não usar back-end separado — tudo roda em Supabase + frontend.

3. Modelo de dados (Postgres / Supabase)

Execute este SQL como schema inicial (via SQL editor do Supabase ou migration):

-- ============ TENANTS (prefeituras) ============

create table municipios (

  id uuid primary key default gen_random_uuid(),

  nome text not null,                 -- "Nanuque"

  uf text not null default 'MG',

  codigo_sef text not null,           -- código do município na SEF-MG (ex: "443")

  criado_em timestamptz not null default now()

);

 

-- ============ USUÁRIOS (ligados a um município) ============

create table perfis (

  id uuid primary key references auth.users(id) on delete cascade,

  municipio_id uuid not null references municipios(id) on delete cascade,

  nome text,

  papel text not null default 'operador' check (papel in ('admin','operador','leitura')),

  criado_em timestamptz not null default now()

);

 

-- ============ CARGAS (um upload = um par de arquivos + um exercício) ============

create table cargas (

  id uuid primary key default gen_random_uuid(),

  municipio_id uuid not null references municipios(id) on delete cascade,

  exercicio int not null,

  arquivo_ativos_path text,           -- caminho no Storage

  arquivo_retorno_path text,

  status text not null default 'pendente'

    check (status in ('pendente','processando','concluida','erro')),

  mensagem_erro text,

  total_ativos int,

  total_omissos int,

  total_zerados int,

  total_fora_prazo int,

  total_discrepantes int,

  total_normais int,

  criado_por uuid references auth.users(id),

  criado_em timestamptz not null default now(),

  concluida_em timestamptz

);

 

-- ============ CONTRIBUINTES APURADOS (resultado, um por contribuinte/carga) ============

create table contribuintes_apurados (

  id uuid primary key default gen_random_uuid(),

  carga_id uuid not null references cargas(id) on delete cascade,

  municipio_id uuid not null references municipios(id) on delete cascade, -- denormalizado p/ RLS simples

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

  situacoes text[] not null default '{}',   -- ex: {'ZERADO','DISCREPANTE'}

  oficio_path text,                          -- preenchido depois de gerado

  criado_em timestamptz not null default now()

);

create index idx_contrib_carga on contribuintes_apurados(carga_id);

create index idx_contrib_municipio on contribuintes_apurados(municipio_id);

create index idx_contrib_situacoes on contribuintes_apurados using gin(situacoes);

 

-- ============ ROW LEVEL SECURITY (isolamento entre prefeituras) ============

alter table municipios enable row level security;

alter table perfis enable row level security;

alter table cargas enable row level security;

alter table contribuintes_apurados enable row level security;

 

-- helper: município do usuário logado

create or replace function meu_municipio_id() returns uuid

language sql stable as $$

  select municipio_id from perfis where id = auth.uid()

$$;

 

create policy "ve seu municipio" on municipios

  for select using (id = meu_municipio_id());

 

create policy "ve seu perfil e colegas" on perfis

  for select using (municipio_id = meu_municipio_id());

 

create policy "cargas do seu municipio" on cargas

  for all using (municipio_id = meu_municipio_id())

  with check (municipio_id = meu_municipio_id());

 

create policy "contribuintes do seu municipio" on contribuintes_apurados

  for all using (municipio_id = meu_municipio_id())

  with check (municipio_id = meu_municipio_id());

Storage (buckets)

uploads — arquivos .txt originais enviados (privado, RLS por município via caminho municipio_id/carga_id/ativos.txt)

outputs — planilha .xlsx gerada e ofícios .docx/.zip (municipio_id/carga_id/...)

Configurar políticas de Storage equivalentes às de cargas (usuário só acessa objetos cujo primeiro segmento do caminho é o seu municipio_id).

4. Fluxo do usuário / Telas

Login (Supabase Auth) → usuário cai direto no seu município (não precisa escolher; perfis.municipio_id já define isso). Se o usuário tiver acesso a mais de um município (ex.: um escritório de contabilidade atendendo várias prefeituras), adicionar um seletor — mas isso é fase 2, não é o modelo padrão.

Dashboard — cards com os totais da carga mais recente (Omissos, Zerados, Fora do Prazo, Discrepantes, Normais) + gráfico de barras por CNAE + botão "Nova apuração".

Nova apuração — dropzone para os 2 arquivos .txt, campo opcional "Exercício" (se vazio, detecta automaticamente), botão "Processar". Mostrar status em tempo real (pendente → processando → concluída) — pode usar Supabase Realtime na tabela cargas para atualizar a barra de progresso sem polling.

Tabela de contribuintes — grid com busca por nome/CNPJ/IE, filtro por situação (chips: Omisso, Zerado, Fora do Prazo, Discrepante, Normal — combináveis), colunas: IE, CNPJ, Nome, CNAE, VAF atual, VAF anterior, Variação %, Situação (badge colorido), botão "Gerar/baixar ofício" por linha.

Geração de ofícios em lote — botão na tela de resultado da carga: "Gerar todos os ofícios" → chama a Edge Function gerar-oficios → quando pronto, baixa um .zip.

Histórico — lista de cargas anteriores por exercício, com os mesmos totais, permitindo reabrir qualquer carga passada.

Administração (só para papel admin) — cadastrar usuários do próprio município (convite por e-mail via Supabase Auth).

5. Regras de negócio da apuração (implementar na Edge Function apurar)

Para cada contribuinte do universo de Ativos (arquivo 1):

entregou_declaracao: existe registro tipo 01 no arquivo de retorno com a mesma Inscrição Estadual e o exercício da carga.

vaf_atual: valor do registro tipo 10 (Histórico de Declarações) — não usar o registro 07, que só é preenchido para o Regime Normal e sub-representa fortemente o universo (confirmado em teste real: registro 07 cobria 83 de 2.160 declarações, contra 100% cobertas pelo registro 10). Aplicar o sinal do campo sinal_valor_vaf (- = negativo). Se houver mais de um registro 10 para a mesma IE no exercício (retificação), usar o de data_processamento mais recente.

vaf_anterior: campo valor_adicionado_anterior do registro tipo 02, aplicando o sinal de sinal_valor_adicionado_anterior.

Situação OMISSO: não entregou declaração.

Situação ZERADO: entregou, mas vaf_atual == 0.

Situação FORA DO PRAZO: data_entrega (registro 01) posterior a 31/05 do ano seguinte ao exercício (parametrizável).

Situação DISCREPANTE: |vaf_atual − vaf_anterior| / |vaf_anterior| ≥ 0.30 (30%, parametrizável — deixar configurável na tela de "Nova apuração" como opção avançada, com esse valor como padrão).

Se nenhuma das anteriores, situação = NORMAL. Um contribuinte pode acumular mais de uma situação simultaneamente (ex.: Zerado + Fora do Prazo).

Só considerar contribuintes com codigo_situacao_contribuinte = '1' (Situação Normal) no arquivo de Ativos — os demais (cancelados, baixados etc.) ficam de fora do universo cobrado.

6. Edge Functions necessárias

Criar 3 Edge Functions em Supabase (Deno/TypeScript):

processar-carga

Recebe carga_id. Passos:

Baixa os 2 arquivos do Storage (uploads/...).

Faz o parse de ambos usando os layouts da Seção 7.

Aplica as regras de negócio da Seção 5.

Grava um registro em contribuintes_apurados por contribuinte do universo de Ativos.

Atualiza cargas com os totais e status = 'concluida' (ou 'erro' + mensagem_erro se algo falhar).

Detecta o exercício automaticamente pela moda do campo exercicio do registro tipo 01, se não informado.

gerar-planilha

Recebe carga_id. Gera um .xlsx (pode usar uma lib como sheetjs/xlsx via npm: import no Deno) com a mesma estrutura usada no protótipo Python: aba principal com todos os contribuintes coloridos por situação, aba "Resumo" com os totais. Salva em outputs/{municipio_id}/{carga_id}/controle_vaf.xlsx e retorna a URL assinada.

gerar-oficios

Recebe carga_id (e opcionalmente uma lista de IEs, para gerar só alguns). Para cada contribuinte Omisso/Zerado, monta um .docx a partir do modelo da Seção 8 (pode usar a lib docx via npm:docx no Deno, replicando a lógica já validada em Node/docx no protótipo) e empacota tudo num .zip (npm:jszip). Salva em outputs/{municipio_id}/{carga_id}/oficios.zip e atualiza contribuintes_apurados.oficio_path de cada um.

Nota: essas 3 funções já existem prontas em Python/Node num protótipo funcional (testado com dados reais de Nanuque/MG). A lógica de parsing e classificação deve ser portada linha a linha para TypeScript — não reinventar as regras, só traduzir a linguagem.

7. Layouts dos arquivos-fonte (posições fixas, 1-indexadas, inclusivas)

Isso é o núcleo técnico do sistema — sem isso a Edge Function processar-carga não tem como funcionar. Copie exatamente como está.

// layouts.ts

// [inicio, fim, tipo("N"|"A"), nomeCampo] — posições 1-indexadas e inclusivas

type Campo = [number, number, "N" | "A", string];

 

export const LAYOUT_ATIVOS: Campo[] = [

  [1, 13, "N", "inscricao_estadual"],

  [14, 15, "A", "uf"],

  [16, 75, "A", "nome_comercial"],

  [76, 77, "A", "complemento_1"],

  [78, 79, "A", "complemento_2"],

  [80, 81, "A", "complemento_3"],

  [82, 131, "A", "nome_complemento_1"],

  [132, 181, "A", "nome_complemento_2"],

  [182, 231, "A", "nome_complemento_3"],

  [232, 236, "A", "numero_logradouro"],

  [237, 241, "N", "codigo_logradouro"],

  [242, 244, "A", "tipo_logradouro"],

  [245, 278, "A", "nome_logradouro"],

  [279, 292, "A", "titulo_logradouro"],

  [293, 298, "A", "numero_crc_contabilista"],

  [299, 300, "A", "uf_contabilista"],

  [301, 311, "A", "cpf_contabilista"],

  [312, 325, "A", "cgc_contabilista"],

  [326, 358, "A", "nome_contabilista"],

  [359, 360, "A", "complemento_1_contabilista"],

  [361, 362, "A", "complemento_2_contabilista"],

  [363, 364, "A", "complemento_3_contabilista"],

  [365, 369, "A", "nome_complemento_1_contabilista"],

  [370, 374, "A", "nome_complemento_2_contabilista"],

  [375, 379, "A", "nome_complemento_3_contabilista"],

  [380, 384, "A", "numero_logradouro_contabilista"],

  [385, 389, "A", "codigo_logradouro_contabilista"],

  [390, 392, "A", "tipo_logradouro_contabilista"],

  [393, 426, "A", "nome_logradouro_contabilista"],

  [427, 440, "A", "titulo_logradouro_contabilista"],

  [441, 441, "A", "vazio_1"],

  [442, 443, "N", "ddd_telefone_contabilista"],

  [444, 451, "A", "numero_telefone_contabilista"],

  [452, 452, "A", "vazio_2"],

  [453, 456, "A", "ramal_telefone_contabilista"],

  [457, 460, "N", "unidade_administrativa_contribuinte"],

  [461, 461, "A", "sinal_vaf"],

  [462, 475, "N", "valor_vaf"],

  [476, 477, "N", "regime_recolhimento"],

  [478, 478, "A", "vazio_3"],

  [479, 480, "N", "srf"],

  [481, 483, "N", "codigo_municipio_centralizadora_1"],

  [484, 486, "N", "codigo_municipio_centralizadora_2"],

  [487, 501, "N", "valor_outras_entradas_ano_exercicio"],

  [502, 508, "N", "cae_contribuinte"],

  [509, 516, "A", "codigo_cep"],

  [517, 519, "N", "codigo_municipio_contribuinte"],

  [520, 526, "N", "codigo_cnaef_contribuinte"],

  [527, 528, "N", "desmembramento"],

  [529, 530, "N", "unidade_auxiliar"],

  [531, 531, "N", "codigo_situacao_contribuinte"],

  [532, 539, "A", "data_situacao_contribuinte"],

  [540, 541, "A", "uf_contabilista_2"],

  [542, 571, "A", "municipio_contabilista"],

  [572, 591, "A", "bairro_contabilista"],

  [592, 599, "A", "codigo_cep_contabilista"],

  [600, 619, "A", "bairro_contribuinte"],

  [620, 669, "A", "email_responsavel"],

  [670, 672, "N", "codigo_municipio_anterior"],

  [673, 687, "N", "valor_saida_vaf_ano_anterior"],

  [688, 702, "N", "valor_entrada_vaf_ano_anterior"],

  [703, 717, "N", "cnpj_contribuinte"],

];

 

// Registros comuns a vários tipos (mesma estrutura) — reaproveitar

const detalhamentoPadrao = (): Campo[] => [

  [1, 2, "A", "tipo_registro"],

  [3, 5, "N", "municipio_contribuinte"],

  [6, 18, "N", "inscricao_estadual"],

  [19, 21, "N", "codigo_municipio_detalhamento"],

  [22, 36, "N", "valor_municipio"],

  [37, 39, "N", "codigo_municipio_estabelecimento"],

  [40, 53, "A", "cnpj_contribuinte"],

  [54, 55, "N", "regime_recolhimento"],

  [56, 165, "A", "vazio"],

];

 

const indicePadrao = (): Campo[] => [

  [1, 2, "A", "tipo_registro"],

  [3, 5, "N", "codigo_municipio"],

  [6, 18, "N", "zeros"],

  [19, 33, "N", "vaf_a_proprio"],

  [34, 48, "N", "vaf_a_credito_externo"],

  [49, 63, "N", "vaf_b_credito_interno"],

  [64, 78, "N", "vaf_b_credito_proprio"],

  [79, 93, "N", "vaf_b_debito"],

  [94, 108, "N", "acertos_ano_anterior_credito"],

  [109, 123, "N", "acertos_ano_anterior_debito"],

  [124, 138, "N", "vaf_municipal"],

  [139, 147, "N", "indice"],

  [148, 163, "N", "vaf_estadual"],

  [164, 178, "N", "credito_proprio_valor_af"],

  [179, 193, "N", "credito_proprio_valor_siare"],

  [194, 195, "N", "regime_recolhimento"],

];

 

export const LAYOUTS_RETORNO: Record<string, Campo[]> = {

  "0A": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 68, "A", "endereco"],

    [69, 88, "A", "bairro"], [89, 96, "N", "cep"], [97, 98, "N", "ddd"],

    [99, 106, "A", "telefone"], [107, 110, "N", "agencia_postal"],

    [111, 117, "N", "caixa_postal"], [118, 152, "A", "email"],

    [153, 155, "N", "municipio_endereco"], [156, 157, "A", "regime_recolhimento"],

    [158, 165, "A", "vazio"],

  ],

  "0B": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 68, "A", "endereco"],

    [69, 88, "A", "bairro"], [89, 96, "N", "cep"], [97, 126, "A", "nome_municipio"],

    [127, 128, "A", "uf"], [129, 163, "N", "email"], [164, 165, "N", "regime_recolhimento"],

  ],

  "01": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 22, "N", "exercicio"],

    [23, 57, "A", "nome_contribuinte"], [58, 65, "N", "data_entrega"],

    [66, 71, "N", "hora_entrega"], [72, 79, "N", "data_primeira_entrega"],

    [80, 87, "N", "data_processamento"], [88, 88, "N", "tipo_damef"],

    [89, 89, "N", "tipo_contribuinte"], [90, 91, "N", "regime_recolhimento_final"],

    [92, 92, "A", "indicador_substituicao"], [93, 93, "A", "vazio_1"],

    [94, 113, "A", "numero_protocolo_entrega"], [114, 114, "A", "indicio_irregularidade"],

    [115, 115, "A", "indicador_escrita"], [116, 122, "N", "codigo_cnaef"],

    [123, 124, "N", "codigo_desmembramento"], [125, 154, "A", "nome_municipio"],

    [155, 156, "N", "mes_inicio"], [157, 158, "N", "mes_fim"],

    [159, 161, "N", "codigo_mudanca_municipio"], [162, 163, "N", "regime_recolhimento"],

    [164, 165, "A", "vazio_2"],

  ],

  "02": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 53, "A", "nome_responsavel"],

    [54, 67, "N", "cpf_cgc"], [68, 92, "A", "cargo"], [93, 102, "A", "telefone"],

    [103, 117, "N", "valor_entradas_anterior"], [118, 132, "N", "valor_saidas_anterior"],

    [133, 147, "N", "valor_outras_entradas_anterior"],

    [148, 148, "A", "sinal_valor_adicionado_anterior"],

    [149, 162, "N", "valor_adicionado_anterior"], [163, 164, "N", "regime_recolhimento"],

    [165, 165, "A", "vazio"],

  ],

  "03": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 21, "N", "codigo_campo"],

    [22, 36, "N", "valor"], [37, 38, "N", "regime_recolhimento"], [39, 165, "A", "vazio"],

  ],

  "04": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 21, "N", "codigo_campo"],

    [22, 36, "N", "valor_inicial"], [37, 51, "N", "valor_final"],

    [52, 53, "N", "regime_recolhimento"], [54, 165, "A", "vazio"],

  ],

  "06": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 21, "N", "codigo_campo"],

    [22, 36, "N", "valor_entradas"], [37, 51, "N", "valor_saidas"],

    [52, 53, "N", "regime_recolhimento"], [54, 165, "A", "vazio"],

  ],

  "07": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 33, "N", "valor_saidas"],

    [34, 48, "N", "valor_entradas"], [49, 63, "N", "valor_outras_entradas"],

    [64, 78, "N", "valor_adicionado_fiscal"], [79, 80, "N", "regime_recolhimento"],

    [81, 165, "A", "vazio"],

  ],

  "08": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 21, "N", "codigo_municipio"],

    [22, 36, "N", "valor_municipio"], [37, 38, "N", "tipo_detalhamento"],

    [39, 43, "N", "percentual_municipio"], [44, 58, "N", "valor_computado"],

    [59, 60, "N", "regime_recolhimento"], [61, 165, "A", "vazio"],

  ],

  "09": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 19, "A", "grupo"],

    [20, 22, "N", "codigo_campo"], [23, 37, "N", "valor_contabil"],

    [38, 52, "N", "valor_base_calculo"], [53, 67, "N", "valor_icms"],

    [68, 82, "N", "valor_sem_correcao"], [83, 84, "N", "regime_recolhimento"],

    [85, 165, "A", "vazio"],

  ],

  "10": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 22, "N", "exercicio"],

    [23, 30, "N", "data_entrega"], [31, 36, "N", "hora_entrega"],

    [37, 44, "N", "data_processamento"], [45, 45, "N", "tipo_damef"],

    [46, 65, "A", "numero_protocolo"], [66, 67, "N", "regime_recolhimento_final"],

    [68, 68, "N", "tipo_contribuinte"], [69, 69, "A", "indicador_substituicao"],

    [70, 70, "A", "sinal_valor_entradas_vaf"], [71, 84, "N", "valor_entradas_vaf"],

    [85, 85, "A", "sinal_valor_outras_entradas_vaf"],

    [86, 99, "N", "valor_outras_entradas_vaf"], [100, 100, "A", "sinal_valor_saidas_vaf"],

    [101, 114, "N", "valor_saidas_vaf"], [115, 115, "A", "sinal_valor_vaf"],

    [116, 129, "N", "valor_vaf"], [130, 143, "N", "numero_documento"],

    [144, 145, "N", "codigo_recusa_1"], [146, 147, "N", "codigo_recusa_2"],

    [148, 149, "N", "codigo_recusa_3"], [150, 151, "N", "codigo_recusa_4"],

    [152, 153, "N", "codigo_recusa_5"], [154, 156, "N", "municipio_informado"],

    [157, 158, "N", "codigo_validacao_declaracao"],

    [159, 183, "A", "descricao_codigo_validacao"], [184, 185, "N", "regime_recolhimento"],

    [186, 192, "A", "vazio"],

  ],

  "11": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "zeros"], [19, 21, "N", "codigo_municipio"],

    [22, 34, "N", "inscricao_estadual"], [35, 37, "N", "codigo_municipio_estabelecimento"],

    [38, 72, "A", "nome_contribuinte"], [73, 80, "N", "data_primeira_entrega"],

    [81, 95, "N", "valor_credito"], [96, 109, "A", "cnpj_contribuinte"],

    [110, 111, "A", "flag_sn"], [112, 120, "N", "cnaef"],

    [121, 122, "N", "regime_recolhimento"], [123, 165, "A", "vazio"],

  ],

  "12": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_creditado"],

    [6, 18, "N", "zeros"], [19, 21, "N", "municipio_debitado"],

    [22, 36, "N", "valor_af"], [37, 51, "N", "valor_siare"],

    [52, 66, "N", "valor_credito"], [67, 68, "N", "regime_recolhimento"],

    [69, 165, "A", "vazio"],

  ],

  "13": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_debitado"],

    [6, 18, "N", "zeros"], [19, 21, "N", "municipio_creditado"],

    [22, 36, "N", "valor_af"], [37, 51, "N", "valor_siare"],

    [52, 66, "N", "valor"], [67, 68, "A", "regime_recolhimento"], [69, 165, "A", "vazio"],

  ],

  "14": detalhamentoPadrao(),

  "15": detalhamentoPadrao(),

  "16": indicePadrao(),

  "17": indicePadrao(),

  "18": detalhamentoPadrao(),

  "19": detalhamentoPadrao(),

  "20": detalhamentoPadrao(),

  "21": detalhamentoPadrao(),

  "22": detalhamentoPadrao(),

  "23": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 21, "N", "codigo_municipio_estabelecimento"],

    [22, 36, "N", "valor_receita_bruta_municipio"], [37, 51, "N", "valor_vaf_municipio"],

    [52, 66, "N", "valor_total_outras_entradas_vaf"], [67, 68, "A", "flag_sn"],

    [69, 70, "N", "regime_recolhimento"], [71, 165, "A", "vazio"],

  ],

  "24": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "municipio_contribuinte"],

    [6, 18, "N", "inscricao_estadual"], [19, 33, "N", "valor_transferencia_mercadoria"],

    [34, 48, "N", "valor_auto_infracao"], [49, 50, "N", "regime_recolhimento"],

    [51, 165, "A", "vazio"],

  ],

  "25": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "codigo_municipio"],

    [6, 18, "N", "inscricao_estadual"], [19, 31, "N", "valor_total_receita"],

    [32, 44, "N", "valor_total_transf_mercadoria"], [45, 57, "N", "valor_total_autuacoes"],

    [58, 70, "N", "valor_total_aquisicao_rural"], [71, 83, "N", "valor_total_producao_rural"],

    [84, 96, "N", "valor_total_servico_comunicacao"],

    [97, 109, "N", "valor_total_servico_transporte"],

    [110, 122, "N", "valor_total_revend_ambulante"], [123, 135, "N", "valor_total_refeicoes"],

    [136, 148, "N", "valor_total_aquisicao_mercadorias"], [149, 150, "N", "regime_recolhimento"],

    [151, 165, "A", "vazio"],

  ],

  "35": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "codigo_municipio"], [6, 18, "N", "zeros"],

    [19, 21, "N", "codigo_municipio_2"], [22, 34, "N", "inscricao_estadual"],

    [35, 37, "N", "municipio_estabelecimento"], [38, 72, "A", "nome_contribuinte"],

    [73, 80, "A", "data_entrada_vaf"], [81, 81, "A", "sinal_valor_vaf"],

    [82, 95, "N", "valor_vaf"], [96, 109, "A", "cnpj"], [110, 111, "N", "regime_recolhimento"],

  ],

  "40": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "codigo_municipio"], [6, 18, "N", "zeros"],

    [19, 34, "N", "inscricao_estadual"], [35, 37, "N", "municipio_estabelecimento"],

    [38, 72, "A", "nome_contribuinte"], [73, 80, "A", "data_entrada_vaf"],

    [81, 81, "A", "sinal_valor_vaf"], [82, 95, "N", "valor_vaf"], [96, 109, "A", "cnpj"],

    [110, 111, "N", "regime_recolhimento"],

  ],

  "99": [

    [1, 2, "A", "tipo_registro"], [3, 5, "N", "codigo_municipio"], [6, 18, "N", "constante"],

    [19, 27, "N", "qtde_registros_municipio"], [28, 43, "N", "total_geral_valores_municipio"],

    [44, 53, "A", "data_inicio_processamento"], [54, 63, "A", "data_fim_processamento"],

    [64, 79, "N", "vaf_estadual"], [80, 193, "A", "vazio"],

  ],

};

 

// Parser genérico: extrai os campos de uma linha de largura fixa.

// Campos "N" retornam também um valor numérico, assumindo 2 casas decimais

// implícitas (confirmado por teste cruzado entre os registros 10 e 23 em dados

// reais — ajustar DECIMAIS_IMPLICITAS se necessário).

const DECIMAIS_IMPLICITAS = 2;

 

export function parseLinha(linha: string, layout: Campo[]): Record<string, any> {

  const maxEnd = Math.max(...layout.map((c) => c[1]));

  if (linha.length < maxEnd) linha = linha.padEnd(maxEnd, " ");

  const out: Record<string, any> = {};

  for (const [inicio, fim, tipo, nome] of layout) {

    const raw = linha.slice(inicio - 1, fim);

    out[nome] = raw.trim();

    if (tipo === "N" && !["data_entrega", "data_processamento",

        "data_primeira_entrega", "data_entrada_vaf"].includes(nome)) {

      const digits = raw.replace(/[^0-9]/g, "");

      out[nome + "_num"] = digits ? Number(digits) / 10 ** DECIMAIS_IMPLICITAS : null;

    }

  }

  return out;

}

8. Modelo do ofício (docx) — texto e placeholders

O ofício tem duas variantes: OMISSO e ZERADO, mesmo corpo, título e uma frase mudam. Placeholders: {{contribuinte}}, {{cnpj}}, {{inscricao_estadual}}, {{endereco}}, {{exercicio}}, {{data_oficio}}, {{titulo}} (calculado: "PEDIDO DE RETIFICAÇÃO EMPRESAS OMISSAS VAF {{exercicio}}" ou "PEDIDO DE RETIFICAÇÃO EMPRESAS COM DECLARAÇÃO ZERADAS VAF {{exercicio}}").

PREFEITURA MUNICIPAL DE {{municipio}}          ESTADO DE MINAS GERAIS

                    SECRETARIA MUNICIPAL DE FAZENDA

              SETOR DE TRIBUTAÇÃO E FISCALIZAÇÃO DE RENDAS

________________________________________________________________

 

                    {{titulo}}

 

{{municipio}}/MG, {{data_oficio}}.

 

Prezado,

 

    Contribuinte .......... :  {{contribuinte}}

CNPJ..................... :  {{cnpj}}          Inscrição Estadual :  {{inscricao_estadual}}

Endereço................:  {{endereco}}

 

    Valor Adicionado Fiscal (VAF) é um indicador econômico-contábil utilizado pelo

Estado para calcular o índice de participação municipal no repasse de receita do

Imposto sobre Operações relativas à Circulação de Mercadorias e sobre Prestações de

Serviços de Transporte Interestadual e Intermunicipal e de Comunicação (ICMS) e do

Imposto sobre Produtos Industrializados (IPI) aos municípios mineiros. É apurado

pela Secretaria de Estado de Fazenda de Minas Gerais (SEF-MG), com base em

declarações anuais apresentadas pelas empresas estabelecidas nos respectivos

municípios.

 

    Prezado contribuinte responsável pelas informações do VAF {{exercicio}}. Estamos

acompanhando o VAF {{exercicio}} do Município de {{municipio}}. A resolução

4.306/2011 da SRE- Secretaria da Receita Estadual legaliza o município de indicar um

representante para coletar e acompanhar a correta transmissão dos dados e

regularidade das informações, conforme art. 21 in verbis:

 

Art.21.O município indicará a Secretaria de Estado de Fazenda até 31 de Maio de cada

exercício, o nome da pessoa responsável para acompanhamento da coleta de dados, da

análise da informações recebidas e da apuração do valor adicionado.

 

    Como representante do município, solicitamos a retificação da DAMEF/VAF-PGDAS/

DEFIS da empresa acima relacionada, de sua responsabilidade.

 

    Com efeito, de acordo com o banco de dados da Receita Estadual o contribuinte

não realizou a validação da DAMEF, sendo assim, solicitamos que seja providenciado

junto ao sitio da Receita Estadual a regularização da declaração DAMEF/VAF

referente ao ano de {{exercicio}}.

 

    A multa por deixar de entregar a declaração varia de 100 a 500 UFEMG, conforme

previsto no artigo 215 do RICMS, inciso III, alíneas "a" e "b", ou seja, varia em

torno de R$ 553,10 (Quinhentos e cinquenta e três reais e dez centavos) para as

microempresas a R$ 2.765,50 (Dois mil setecentos e sessenta e cinco reais e

cinquenta centavos), para as demais.

 

Art. 215. As multas calculadas com base na UFEMG, ou no valor do imposto não

declarado, são:

III- por deixar de entregar ao Fisco documento informativo do movimento econômico

ou fiscal, exceto o previsto no inciso VIII do caput deste artigo, na forma e no

prazo definidos neste regulamento:

 

    Ressaltamos que é de suma importância à participação de sua empresa para o

crescimento de seu município. Pois através desta declaração o mesmo receberá a

parcela do ICMS que lhe é devida no exercício de {{exercicio + 1}}.

 

    Convicto de vosso apoio e atenção ao pleito subscrevemos com protesto de mais

elevada estima e consideração.

 

                            Atenciosamente.

 

                    Secretaria Municipal da Fazenda

 

                                                        Recebi ____/____/____

9. Ordem sugerida de construção no Ready

Criar o projeto Supabase e rodar o SQL da Seção 3.

Configurar Auth (e-mail/senha) e o fluxo de cadastro vinculando perfis.municipio_id.

Criar os buckets de Storage e políticas.

Construir a tela de Login → Dashboard vazio (sem cargas ainda).

Construir a tela "Nova apuração" com upload dos 2 arquivos para o Storage.

Implementar a Edge Function processar-carga com os layouts da Seção 7 e as regras da Seção 5 — testar primeiro com um arquivo pequeno (poucas linhas) antes de rodar com um arquivo real de milhares de contribuintes.

Construir a tabela de contribuintes (grid com filtros) lendo de contribuintes_apurados.

Implementar gerar-planilha e o botão de download.

Implementar gerar-oficios e o botão de download em lote.

Cadastrar o primeiro município real (ex.: Nanuque) e validar ponta a ponta com os arquivos reais antes de liberar para outras prefeituras.

10. Coisas para confirmar durante a implementação

Testar a geração de .docx dentro de uma Edge Function Deno com npm:docx — Edge Functions têm timeout e limite de memória; para volumes grandes (2.000+ ofícios), considerar gerar em background (fila) em vez de síncrono, ou paginar a geração em lotes menores.

Confirmar que os arquivos .txt de cada prefeitura vêm sempre na mesma codificação (Latin-1, confirmado no teste com Nanuque/MG) — se algum município mandar em UTF-8, detectar e tratar.

Em anexo vou enviar:
1. Layout contribuintes ativos (arqcontr.pdf);
2. Layout arquivo retorno (retorno20210517.pdf);
3. Arquivo txt contribuinte ativos da prefeitura de Nanuque (P443AT0026.TXT); 
4. Arquivo txt do retorno (P443RT1226.txt);
5. Modelo Retificação omissos (retificação  omissa.docx);
6. Modelo Retificação zerados (retificação  zerados.docx);

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vaf-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2a0b2cb7-f6ba-408f-b958-f3ceda1c0058).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
