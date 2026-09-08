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
  formato: "memoria_calculo" | "tabela_itens";
  /** rótulo da coluna que traz a nota/pontuação final do município */
  colunasTotal: string[];
  /** explicação exibida na tela de ingestão */
  comoFunciona: string;

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
    orgao: "SETUR/MG",
    hosts: ["www.turismo.mg.gov.br", "turismo.mg.gov.br", "www.mg.gov.br"],
    paginasBusca: [
      "https://www.turismo.mg.gov.br/icms-turistico/",
      "https://www.turismo.mg.gov.br/",
    ],
    palavrasChave: ["turis"],
    formato: "tabela_itens",
    colunasTotal: ["pontuacao", "pontuacao final", "total", "indice"],
    comoFunciona:
      "Lê a planilha de pontuação por município publicada pela SETUR e casa cada coluna com os itens da política municipal de turismo (órgão, conselho, fundo, plano, circuito, inventário).",
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
];


export const PIPELINE_POR_SLUG = new Map(PIPELINES.map((p) => [p.slug, p]));

export function pipelineDe(slug: string): Pipeline {
  const p = PIPELINE_POR_SLUG.get(slug);
  if (!p) throw new Error(`Critério sem pipeline de ingestão: ${slug}`);
  return p;
}
