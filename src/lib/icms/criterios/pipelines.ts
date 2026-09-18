/**
 * Configuração dos pipelines de ingestão dos critérios do ICMS.
 *
 * Cada critério tem a sua própria fonte oficial, o seu formato de relatório e
 * a sua tabela de pesos. O Esportes tem um parser dedicado (a memória de
 * cálculo da SEDESE tem layout próprio); Turismo e Meio Ambiente usam o parser
 * de tabela por itens, que casa as colunas do relatório com os itens
 * pontuáveis cadastrados em `criterio_itens_referencia`.
 */

export type FonteRelatorio = "preliminar" | "definitivo";

export type Pipeline = {
  /** slug do critério no catálogo (src/lib/icms/criterios.ts) */
  slug: string;
  nome: string;
  orgao: string;
  /** hosts liberados para download do relatório */
  hosts: string[];
  /** páginas varridas na descoberta automática de PDFs */
  paginasBusca: string[];
  /** páginas oficiais que mudam só o ano na URL (varridas antes das demais) */
  paginasPorAno?: (ano: number) => string[];
  /** palavras que precisam aparecer no link/nome do PDF */
  palavrasChave: string[];
  /** parser usado na leitura */
  formato: "memoria_calculo" | "tabela_itens" | "planilha";
  /** rótulo da coluna que traz a nota/pontuação final do município */
  colunasTotal: string[];
  /** explicação exibida na tela de ingestão */
  comoFunciona: string;
  /** alerta exibido na tela de ingestão (ex.: site que bloqueia download automático) */
  aviso?: string;


};

export const PIPELINES: Pipeline[] = [
  {
    slug: "esportes",
    nome: "Esportes",
    orgao: "SEDESE — Subsecretaria de Esportes",
    hosts: ["observatoriodoesporte.mg.gov.br", "www.observatoriodoesporte.mg.gov.br"],
    paginasBusca: [
      "https://observatoriodoesporte.mg.gov.br/icms-esportivo/",
      "https://observatoriodoesporte.mg.gov.br/",
    ],
    palavrasChave: ["esporte"],
    formato: "memoria_calculo",
    colunasTotal: ["final", "pontuacao final", "total"],
    comoFunciona:
      "Lê o ranking geral e a memória de cálculo por município e atividade (eventos, participantes, modalidades e pontuação).",
  },
  {
    slug: "turismo",
    nome: "Turismo",
    orgao: "Secult-MG (ICMS Turismo)",
    hosts: [
      "www.secult.mg.gov.br",
      "secult.mg.gov.br",
      "www.icmsturismo.mg.gov.br",
      "icmsturismo.mg.gov.br",
      "www.turismo.mg.gov.br",
      "turismo.mg.gov.br",
    ],
    paginasBusca: ["https://www.secult.mg.gov.br/turismo/icms-turismo"],
    palavrasChave: ["habilitados", "icms-turismo", "indice", "índice", "turis"],
    formato: "tabela_itens",
    colunasTotal: ["indice", "indice de participacao", "iit", "pontuacao", "total"],
    comoFunciona:
      "Lê a publicação oficial dos índices do ICMS Turismo (Secult-MG): uma linha por município habilitado com circuito turístico, nota da habilitação, RLPC, IRC, IIT e o índice de participação no critério.",
  },

  {
    slug: "meio_ambiente",
    nome: "Meio Ambiente",
    orgao: "SEMAD / FEAM / IEF",
    hosts: [
      "semad.mg.gov.br",
      "www.semad.mg.gov.br",
      "www.feam.br",
      "feam.br",
      "www.ief.mg.gov.br",
      "ief.mg.gov.br",
      "www.meioambiente.mg.gov.br",
      "meioambiente.mg.gov.br",
    ],
    paginasPorAno: (ano) => [
      `https://semad.mg.gov.br/w/icms-ecologico-publicacoes-${ano}`,
      `https://semad.mg.gov.br/w/icms-ecologico-publicacoes-${ano - 1}`,
    ],
    paginasBusca: [
      "https://semad.mg.gov.br/w/icms-ecologico-publicacoes-2025",
      "https://www.meioambiente.mg.gov.br/",
    ],
    palavrasChave: ["icms", "ecologic", "pontuacao", "fq", "fator de qualidade", "saneamento", "conservacao"],
    formato: "tabela_itens",
    colunasTotal: ["pontuacao", "indice", "total", "iqr"],
    comoFunciona:
      "Varre a página oficial de publicações do ICMS Ecológico do ano (SEMAD) e traz as tabelas trimestrais das resoluções (saneamento, unidades de conservação e mata seca) e as tabelas de Fator de Qualidade (preliminar e final).",
  },
  {
    slug: "educacao",
    nome: "Educação",
    orgao: "Fundação João Pinheiro (FJP) com a SEE-MG",
    hosts: [
      "robin-hood.fjp.mg.gov.br",
      "www.robin-hood.fjp.mg.gov.br",
      "robin-hood-historico.fjp.mg.gov.br",
      "fjp.mg.gov.br",
      "www.fjp.mg.gov.br",
    ],
    paginasBusca: [
      "https://robin-hood.fjp.mg.gov.br/noticias",
      "https://robin-hood.fjp.mg.gov.br/",
    ],
    palavrasChave: ["educa", "iqe", "indice", "índice"],
    formato: "planilha",
    colunasTotal: ["iqe", "indice de participacao", "indice"],
    comoFunciona:
      "Lê a planilha publicada pela FJP com os índices do critério Educação: os quatro componentes (Desempenho, Rendimento, Atendimento e Gestão Escolar), o Índice de Qualidade e o índice de participação, além dos dados constitutivos, dos recursos administrativos e da nota técnica do ano.",
  },
  {
    slug: "patrimonio_cultural",
    nome: "Patrimônio Cultural",
    orgao: "IEPHA-MG (Programa ICMS Patrimônio Cultural)",
    hosts: [
      "www.mg.gov.br",
      "mg.gov.br",
      "www.iepha.mg.gov.br",
      "iepha.mg.gov.br",
    ],
    paginasBusca: [
      "https://www.mg.gov.br/iepha/pagina/programa-icms-patrimonio-cultural",
      "https://www.iepha.mg.gov.br/index.php/programas-e-acoes/icms-patrimonio-cultural",
    ],
    palavrasChave: ["pontuacao", "pontuação", "icms", "patrimonio", "patrimônio"],
    formato: "tabela_itens",
    colunasTotal: ["pontuacao total", "total", "pontuacao", "ppc"],
    comoFunciona:
      "Lê a tabela de pontuação do ICMS Patrimônio Cultural publicada pelo IEPHA-MG (preliminar e definitiva): uma linha por município com a nota de cada quadro da DN CONEP 01/2021 — política municipal, fundo, inventário, educação patrimonial, bens tombados (NH, CP, BI, BM) e registro de bens imateriais — e a pontuação total.",
    aviso:
      "O portal do Governo de Minas bloqueia o download automático da tabela do IEPHA. Baixe a tabela de pontuação no site do IEPHA e envie o arquivo aqui (PDF ou planilha), ou cole o conteúdo — a leitura e a gravação do ranking funcionam igual.",
  },
];



export const PIPELINE_POR_SLUG = new Map(PIPELINES.map((p) => [p.slug, p]));

export function pipelineDe(slug: string): Pipeline {
  const p = PIPELINE_POR_SLUG.get(slug);
  if (!p) throw new Error(`Critério sem pipeline de ingestão: ${slug}`);
  return p;
}
