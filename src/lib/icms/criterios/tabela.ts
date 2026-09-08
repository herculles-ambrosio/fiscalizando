/**
 * Parser genérico de relatórios em formato de tabela (Turismo, Meio Ambiente e
 * demais critérios cujos órgãos publicam um quadro com uma linha por município).
 *
 * Estratégia:
 *  1) localiza a linha de cabeçalho — aquela que casa com pelo menos dois itens
 *     de referência do critério;
 *  2) a partir dela, cada linha "NOME DO MUNICÍPIO valor valor ..." vira um
 *     conjunto de itens, uma coluna por item;
 *  3) colunas de total/índice viram a nota final do município no ranking;
 *  4) tudo que não casou com nenhum item de referência entra em `naoMapeados`,
 *     para o painel de importações mostrar o que precisa de cadastro.
 *
 * Também aceita o layout em blocos ("Município: X" / "Item: Y"), usado por
 * alguns relatórios ambientais.
 */

import { normalizarMunicipio, normalizarTexto, type PaginaTexto } from "@/lib/icms/esportes/parser";

export type ItemReferencia = {
  codigo: string;
  nome_oficial: string;
  sinonimos: string[];
  peso: number | null;
};

export type ItemMunicipio = {
  municipio: string;
  municipioNome: string;
  itemNome: string;
  itemCodigo: string | null;
  peso: number | null;
  pontuacao: number | null;
  quantidade: number | null;
  observacao: string | null;
};

export type RankingCriterio = {
  municipio: string;
  municipioNome: string;
  posicao: number | null;
  notaFinal: number;
  indicePercentual: number;
};

export type ResultadoTabela = {
  ranking: RankingCriterio[];
  itens: ItemMunicipio[];
  naoMapeados: string[];
  cabecalho: string[];
};

const RE_NUM = /^-?[\d.,]+%?$/;
const SIM = new Set(["sim", "s", "x", "atende", "possui", "conforme"]);
const NAO = new Set(["nao", "n", "-", "0", "nao atende", "ausente"]);

export function numeroFlex(valor: string): number | null {
  const bruto = valor.trim().replace(/%$/, "");
  if (!bruto) return null;
  const limpo = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : /^-?\d+\.\d+$/.test(bruto)
      ? bruto
      : bruto.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function valorDaCelula(celula: string): { pontuacao: number | null; observacao: string | null } {
  const bruto = celula.trim();
  const chave = normalizarTexto(bruto);
  if (RE_NUM.test(bruto)) return { pontuacao: numeroFlex(bruto), observacao: null };
  if (SIM.has(chave)) return { pontuacao: 1, observacao: bruto };
  if (NAO.has(chave)) return { pontuacao: 0, observacao: bruto };
  return { pontuacao: null, observacao: bruto || null };
}

export function casarItem(rotulo: string, referencia: ItemReferencia[]): ItemReferencia | null {
  const alvo = normalizarTexto(rotulo);
  if (!alvo) return null;
  for (const item of referencia) {
    const nomes = [item.nome_oficial, ...(item.sinonimos ?? [])].map(normalizarTexto);
    if (nomes.some((n) => n && (n === alvo || alvo.includes(n) || n.includes(alvo)))) return item;
  }
  return null;
}

/** Quebra a linha do cabeçalho em rótulos de coluna. */
function colunasDoCabecalho(texto: string): string[] {
  return texto
    .split(/\s{2,}|\s\|\s|\t/)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Separa nome do município e as células de valor de uma linha de dados. */
function partirLinha(texto: string): { nome: string; celulas: string[] } | null {
  const limpo = texto.replace(/\s+$/, "");
  const m = limpo.match(/^\s*(?:\d{1,4}[.ºo)]?\s+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^\d]{2,60}?)\s{2,}(.+)$/);
  if (!m) return null;
  const nome = (m[1] ?? "").trim();
  const resto = (m[2] ?? "").trim();
  if (!nome || nome.length < 3) return null;
  const celulas = resto.split(/\s{2,}|\t/).map((c) => c.trim()).filter(Boolean);
  if (celulas.length < 2) return null;
  return { nome, celulas };
}

export function extrairTabelaCriterio(
  paginas: PaginaTexto[],
  referencia: ItemReferencia[],
  colunasTotal: string[],
): ResultadoTabela {
  const linhas = paginas.flatMap((p) => p.linhas.map((l) => l.texto));
  const naoMapeados = new Set<string>();
  const itens: ItemMunicipio[] = [];
  const ranking = new Map<string, RankingCriterio>();
  let cabecalho: string[] = [];
  let mapaColunas: (ItemReferencia | null)[] = [];
  let indiceTotal = -1;
  const totais = colunasTotal.map(normalizarTexto);

  const registrarCabecalho = (texto: string): boolean => {
    const cols = colunasDoCabecalho(texto);
    if (cols.length < 3) return false;
    const casados = cols.map((c) => casarItem(c, referencia));
    const quantos = casados.filter(Boolean).length;
    const temTotal = cols.some((c) => totais.includes(normalizarTexto(c)));
    if (quantos < 2 && !(quantos >= 1 && temTotal)) return false;
    cabecalho = cols;
    mapaColunas = casados;
    indiceTotal = cols.findIndex((c) => totais.includes(normalizarTexto(c)));
    cols.forEach((c, i) => {
      if (!casados[i] && i !== indiceTotal && i > 0) naoMapeados.add(c);
    });
    return true;
  };

  for (const texto of linhas) {
    if (!texto.trim()) continue;
    if (registrarCabecalho(texto)) continue;
    if (!cabecalho.length) continue;

    const partido = partirLinha(texto);
    if (!partido) continue;
    const municipio = normalizarMunicipio(partido.nome);
    if (!municipio) continue;

    // A primeira coluna do cabeçalho costuma ser "Município"; as células
    // começam na segunda coluna.
    partido.celulas.forEach((celula, i) => {
      const coluna = cabecalho[i + 1] ?? cabecalho[i] ?? "";
      const item = mapaColunas[i + 1] ?? mapaColunas[i] ?? null;
      const posTotal = indiceTotal >= 0 ? indiceTotal - 1 : -1;
      const { pontuacao, observacao } = valorDaCelula(celula);
      if (i === posTotal) {
        ranking.set(municipio, {
          municipio,
          municipioNome: partido.nome.trim(),
          posicao: null,
          notaFinal: pontuacao ?? 0,
          indicePercentual: /%/.test(celula) ? (pontuacao ?? 0) : 0,
        });
        return;
      }
      if (!item && !coluna) return;
      if (!item) {
        if (coluna) naoMapeados.add(coluna);
        return;
      }
      itens.push({
        municipio,
        municipioNome: partido.nome.trim(),
        itemNome: item.nome_oficial,
        itemCodigo: item.codigo,
        peso: item.peso,
        pontuacao,
        quantidade: pontuacao,
        observacao,
      });
    });
  }

  // Layout alternativo em blocos: "Município: X" seguido de "Item: Y ... valor".
  let municipioAtual: { nome: string; chave: string } | null = null;
  for (const texto of linhas) {
    const mMun = texto.match(/^\s*Munic[ií]pio:\s*(.+)$/);
    if (mMun) {
      const nome = (mMun[1] ?? "").trim();
      municipioAtual = { nome, chave: normalizarMunicipio(nome) };
      continue;
    }
    if (!municipioAtual) continue;
    const mItem = texto.match(/^\s*(?:Item|Indicador|Atividade|Subcrit[ée]rio)[^:]*:\s*(.+)$/i);
    if (!mItem) continue;
    const bruto = (mItem[1] ?? "").trim();
    const partes = bruto.split(/\s{2,}|\s-\s/);
    const rotulo = (partes[0] ?? bruto).trim();
    const item = casarItem(rotulo, referencia);
    if (!item) {
      naoMapeados.add(rotulo);
      continue;
    }
    const valor = partes.length > 1 ? valorDaCelula(partes[partes.length - 1] ?? "") : { pontuacao: null, observacao: null };
    itens.push({
      municipio: municipioAtual.chave,
      municipioNome: municipioAtual.nome,
      itemNome: item.nome_oficial,
      itemCodigo: item.codigo,
      peso: item.peso,
      pontuacao: valor.pontuacao,
      quantidade: valor.pontuacao,
      observacao: valor.observacao,
    });
  }

  return {
    ranking: [...ranking.values()].sort((a, b) => b.notaFinal - a.notaFinal).map((l, i) => ({
      ...l,
      posicao: i + 1,
    })),
    itens,
    naoMapeados: [...naoMapeados],
    cabecalho,
  };
}
