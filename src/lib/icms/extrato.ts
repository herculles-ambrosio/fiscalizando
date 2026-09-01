/**
 * Leitura dos extratos do portal Robin Hood (FJP).
 *
 * Os arquivos são baixados com extensão .xls mas são, na verdade, tabelas
 * HTML. Aqui detectamos o tipo pelo conteúdo (nunca pelo nome) e devolvemos
 * as linhas já normalizadas por critério e mês.
 */

import { acharCriterio, normalizarRotulo } from "./criterios";

export type TipoExtrato = "indice_anual" | "transferencia_anual" | "comparativo";

export type LinhaIndice = {
  criterio: string;
  rotulo: string;
  /** valores por mês (índice 0 = janeiro); null quando o mês está em branco */
  meses: (number | null)[];
};

export type LinhaComparativo = {
  municipio: string;
  selecionado: boolean;
  meses: (number | null)[];
};

export type ExtratoLido =
  | { tipo: "indice_anual"; linhas: LinhaIndice[]; desconhecidos: string[] }
  | { tipo: "transferencia_anual"; linhas: LinhaIndice[]; desconhecidos: string[] }
  | { tipo: "comparativo"; linhas: LinhaComparativo[] };

/** Números pt-BR: "1.234,56" -> 1234.56; célula vazia -> null. */
export function numeroBr(texto: string): number | null {
  const limpo = texto.replace(/\s|&nbsp;|R\$/g, "").trim();
  if (!limpo) return null;
  const normal = limpo.replace(/\./g, "").replace(",", ".");
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

function semTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

type Tabela = { cabecalho: string[]; linhas: string[][]; ocultas: boolean[] };

function extrairTabelas(html: string): Tabela[] {
  const tabelas: Tabela[] = [];
  for (const [, corpo] of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const cabecalho: string[] = [];
    const linhas: string[][] = [];
    const ocultas: boolean[] = [];

    const cabRaw = corpo.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i)?.[1] ?? "";
    for (const [, celula] of cabRaw.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)) {
      cabecalho.push(semTags(celula));
    }

    for (const [, linhaRaw] of corpo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas: string[] = [];
      let temTd = false;
      for (const [, celula] of linhaRaw.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
        temTd = true;
        celulas.push(semTags(celula));
      }

      if (!temTd) continue;
      linhas.push(celulas);
      ocultas.push(/class="[^"]*hidden/i.test(linhaRaw));
    }
    if (linhas.length) tabelas.push({ cabecalho, linhas, ocultas });
  }
  return tabelas;
}

const MESES_CABECALHO = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Descobre em quais colunas estão os 12 meses. */
function colunasMeses(cabecalho: string[]): number[] {
  const cols = new Array(12).fill(-1);
  cabecalho.forEach((titulo, i) => {
    const chave = normalizarRotulo(titulo);
    const mes = MESES_CABECALHO.findIndex((m) => chave.startsWith(m));
    if (mes >= 0 && cols[mes] === -1) cols[mes] = i;
  });
  return cols;
}

function detectarTipo(html: string, cabecalho: string[]): TipoExtrato {
  const chaves = cabecalho.map(normalizarRotulo);
  if (chaves.some((c) => c.includes("municipio"))) return "comparativo";
  const planilha = normalizarRotulo(html.match(/<x:Name>([^<]*)<\/x:Name>/i)?.[1] ?? "");
  if (planilha.includes("transfer")) return "transferencia_anual";
  if (planilha.includes("indice")) return "indice_anual";
  // fallback: transferências têm coluna TOTAL (ANUAL)
  return chaves.some((c) => c.startsWith("total")) ? "transferencia_anual" : "indice_anual";
}

export function lerExtrato(html: string): ExtratoLido {
  const tabelas = extrairTabelas(html);
  if (!tabelas.length) {
    throw new Error("Não encontrei nenhuma tabela neste arquivo. Baixe o extrato direto do portal Robin Hood.");
  }
  const tabela = tabelas.reduce((a, b) => (b.linhas.length > a.linhas.length ? b : a));
  const cols = colunasMeses(tabela.cabecalho);
  if (cols.every((c) => c === -1)) {
    throw new Error("Este arquivo não tem colunas de meses — não parece um extrato anual do Robin Hood.");
  }

  const tipo = detectarTipo(html, tabela.cabecalho);

  if (tipo === "comparativo") {
    const colNome = tabela.cabecalho.findIndex((t) => normalizarRotulo(t).includes("municipio"));
    const linhas: LinhaComparativo[] = [];
    for (const celulas of tabela.linhas) {
      const bruto = celulas[colNome] ?? "";
      if (!bruto) continue;
      const selecionado = /selecionado/i.test(bruto);
      const municipio = bruto.replace(/selecionado/gi, "").trim();
      if (!municipio) continue;
      linhas.push({
        municipio,
        selecionado,
        meses: cols.map((c) => (c >= 0 ? numeroBr(celulas[c] ?? "") : null)),
      });
    }
    return { tipo, linhas };
  }

  const linhas: LinhaIndice[] = [];
  const desconhecidos: string[] = [];
  for (const celulas of tabela.linhas) {
    const rotulo = (celulas[0] ?? "").trim();
    if (!rotulo) continue;
    const criterio = acharCriterio(rotulo);
    if (!criterio) {
      desconhecidos.push(rotulo);
      continue;
    }
    linhas.push({
      criterio: criterio.slug,
      rotulo,
      meses: cols.map((c) => (c >= 0 ? numeroBr(celulas[c] ?? "") : null)),
    });
  }
  return { tipo, linhas, desconhecidos };
}

/** Lê o arquivo respeitando a codificação declarada (UTF-8 ou Latin-1). */
export function decodificarExtrato(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

/** Tenta descobrir o exercício pelo nome do arquivo (ex.: ..._anual-2026.xls). */
export function exercicioDoNome(nome: string, padrao: number): number {
  const anos = [...nome.matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]));
  const valido = anos.filter((a) => a >= 1991 && a <= padrao + 1);
  return valido.length ? valido[valido.length - 1] : padrao;
}

export const ROTULO_TIPO: Record<TipoExtrato, string> = {
  indice_anual: "Índice anual",
  transferencia_anual: "Transferências anuais",
  comparativo: "Comparativo entre municípios",
};
