/**
 * Leitura da planilha do critério Educação (Lei 18.030/2009, Anexo III),
 * publicada pela Fundação João Pinheiro em parceria com a SEE-MG.
 *
 * A planilha vem com várias abas e os nomes de coluna mudam de uma publicação
 * para outra, então a leitura é feita por sinônimos: procura-se, no cabeçalho
 * de cada aba, a coluna do município e as colunas dos quatro componentes
 * (IRAP, IRE, IAE e IGE), do índice de qualidade (IQE) e do índice de
 * participação. A aba de dicionário de dados é lida para descrever as colunas
 * dos dados constitutivos.
 */

import * as XLSX from "xlsx";
import { normalizarTexto } from "@/lib/icms/esportes/parser";
import { canonicalizarMunicipio } from "./municipiosMg";
import type { ItemMunicipio, RankingCriterio } from "./tabela";

export type RecursoEducacao = {
  municipio: string;
  municipioNome: string;
  itemContestado: string;
  resultado: string | null;
};

export type DadoConstitutivo = {
  municipio: string;
  municipioNome: string;
  colunaOrigem: string;
  valorNum: number | null;
  valorTexto: string | null;
};

export type ResultadoEducacao = {
  ranking: RankingCriterio[];
  itens: ItemMunicipio[];
  dadosConstitutivos: DadoConstitutivo[];
  recursos: RecursoEducacao[];
  notaTecnica: string | null;
  dicionario: { coluna: string; descricao: string }[];
  naoMapeados: string[];
  cabecalho: string[];
  /** Municípios com índice calculado mas sem dados constitutivos, e vice-versa. */
  divergencias: { municipio: string; esperado: number; obtido: number }[];
};

type Linha = (string | number | null)[];

const COMPONENTES = [
  { codigo: "edu_irap", nome: "Índice de Desempenho Escolar (IRAP)", peso: 50, chaves: ["irap", "desempenho escolar"] },
  { codigo: "edu_ire", nome: "Índice de Rendimento Escolar (IRE)", peso: 20, chaves: ["ire", "rendimento escolar"] },
  { codigo: "edu_iae", nome: "Índice de Atendimento Educacional (IAE)", peso: 15, chaves: ["iae", "atendimento educacional"] },
  { codigo: "edu_ige", nome: "Índice de Gestão Escolar (IGE)", peso: 15, chaves: ["ige", "gestao escolar"] },
];

const CHAVES_IQE = ["iqe", "indice de qualidade", "qualidade da educacao"];
const CHAVES_INDICE = [
  "indice de participacao",
  "indice educacao",
  "ie municipio",
  "participacao",
  "indice final",
  "ie",
];
const CHAVES_MUNICIPIO = ["municipio", "nome do municipio", "municipios"];

function texto(v: unknown): string {
  return v == null ? "" : String(v).replace(/\s+/g, " ").trim();
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const bruto = texto(v).replace(/%$/, "");
  if (!bruto) return null;
  // pt-BR: 1.234,5678 → 1234.5678
  const limpo = bruto.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function casa(cabecalho: string, chaves: string[]): boolean {
  const c = normalizarTexto(cabecalho);
  return chaves.some((k) => c === k || c.includes(k));
}

function linhasDaAba(wb: XLSX.WorkBook, nome: string): Linha[] {
  const aba = wb.Sheets[nome];
  if (!aba) return [];
  return XLSX.utils.sheet_to_json<Linha>(aba, { header: 1, blankrows: false, defval: null });
}

/** Procura a linha de cabeçalho: a primeira que tenha a coluna do município. */
function acharCabecalho(linhas: Linha[]): { indice: number; colunas: string[] } | null {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const colunas = (linhas[i] ?? []).map(texto);
    const temMunicipio = colunas.some((c) => c && casa(c, CHAVES_MUNICIPIO));
    const preenchidas = colunas.filter(Boolean).length;
    if (temMunicipio && preenchidas >= 2) return { indice: i, colunas };
  }
  return null;
}

function escolherAba(wb: XLSX.WorkBook, chaves: string[]): string | null {
  for (const nome of wb.SheetNames) {
    const n = normalizarTexto(nome);
    if (chaves.some((k) => n.includes(k))) return nome;
  }
  return null;
}

function abaDeIndices(wb: XLSX.WorkBook): string | null {
  const direta = escolherAba(wb, ["indices calculados", "indice calculado", "indices", "resultado"]);
  if (direta) return direta;
  // Sem nome reconhecível: procura a aba que traga pelo menos dois componentes.
  for (const nome of wb.SheetNames) {
    const cab = acharCabecalho(linhasDaAba(wb, nome));
    if (!cab) continue;
    const achados = COMPONENTES.filter((c) => cab.colunas.some((col) => casa(col, c.chaves)));
    if (achados.length >= 2) return nome;
  }
  return null;
}

export function extrairEducacao(dados: ArrayBuffer | Uint8Array): ResultadoEducacao {
  const wb = XLSX.read(dados, { type: "array" });

  const naoMapeados = new Set<string>();
  const ranking: RankingCriterio[] = [];
  const itens: ItemMunicipio[] = [];
  const dadosConstitutivos: DadoConstitutivo[] = [];
  const recursos: RecursoEducacao[] = [];
  let cabecalho: string[] = [];

  // 1) Dicionário de dados (usado para descrever as colunas constitutivas).
  const dicionario: { coluna: string; descricao: string }[] = [];
  const abaDic = escolherAba(wb, ["dicionario", "dicionário"]);
  if (abaDic) {
    for (const l of linhasDaAba(wb, abaDic)) {
      const coluna = texto(l?.[0]);
      const descricao = texto(l?.[1]);
      if (coluna && descricao && normalizarTexto(coluna) !== "variavel") {
        dicionario.push({ coluna, descricao });
      }
    }
  }

  // 2) Índices calculados por município.
  const abaIndices = abaDeIndices(wb);
  const municipiosComIndice = new Set<string>();
  if (abaIndices) {
    const linhas = linhasDaAba(wb, abaIndices);
    const cab = acharCabecalho(linhas);
    if (cab) {
      cabecalho = cab.colunas.filter(Boolean);
      const colMunicipio = cab.colunas.findIndex((c) => c && casa(c, CHAVES_MUNICIPIO));
      const colDe = (chaves: string[]) => cab.colunas.findIndex((c) => c && casa(c, chaves));
      const colIqe = colDe(CHAVES_IQE);
      const colIndice = colDe(CHAVES_INDICE);
      const colComponentes = COMPONENTES.map((c) => ({ ...c, coluna: colDe(c.chaves) }));

      for (const c of cab.colunas) {
        if (!c) continue;
        const usada =
          casa(c, CHAVES_MUNICIPIO) ||
          casa(c, CHAVES_IQE) ||
          casa(c, CHAVES_INDICE) ||
          COMPONENTES.some((k) => casa(c, k.chaves));
        if (!usada) naoMapeados.add(c);
      }

      for (let i = cab.indice + 1; i < linhas.length; i++) {
        const l = linhas[i] ?? [];
        const oficial = canonicalizarMunicipio(texto(l[colMunicipio]));
        if (!oficial) continue;
        const iqe = colIqe >= 0 ? numero(l[colIqe]) : null;
        const indice = colIndice >= 0 ? numero(l[colIndice]) : null;
        if (iqe == null && indice == null) continue;
        municipiosComIndice.add(oficial.chave);
        ranking.push({
          municipio: oficial.chave,
          municipioNome: oficial.nome,
          posicao: null,
          notaFinal: iqe ?? indice ?? 0,
          indicePercentual: indice ?? 0,
        });
        for (const c of colComponentes) {
          if (c.coluna < 0) continue;
          const valor = numero(l[c.coluna]);
          itens.push({
            municipio: oficial.chave,
            municipioNome: oficial.nome,
            itemNome: c.nome,
            itemCodigo: c.codigo,
            peso: c.peso,
            pontuacao: valor,
            quantidade: null,
            observacao: null,
          });
        }
      }
    }
  }

  ranking.sort((a, b) => b.notaFinal - a.notaFinal);
  ranking.forEach((l, i) => (l.posicao = i + 1));

  // 3) Dados constitutivos (números brutos por município).
  const abaDados = escolherAba(wb, ["constitutiv", "dados brutos", "dados"]);
  const municipiosComDados = new Set<string>();
  if (abaDados && abaDados !== abaIndices) {
    const linhas = linhasDaAba(wb, abaDados);
    const cab = acharCabecalho(linhas);
    if (cab) {
      const colMunicipio = cab.colunas.findIndex((c) => c && casa(c, CHAVES_MUNICIPIO));
      for (let i = cab.indice + 1; i < linhas.length; i++) {
        const l = linhas[i] ?? [];
        const oficial = canonicalizarMunicipio(texto(l[colMunicipio]));
        if (!oficial) continue;
        municipiosComDados.add(oficial.chave);
        cab.colunas.forEach((coluna, idx) => {
          if (!coluna || idx === colMunicipio) return;
          const bruto = l[idx];
          if (bruto == null || texto(bruto) === "") return;
          const n = numero(bruto);
          dadosConstitutivos.push({
            municipio: oficial.chave,
            municipioNome: oficial.nome,
            colunaOrigem: coluna,
            valorNum: n,
            valorTexto: n == null ? texto(bruto) : null,
          });
        });
      }
    }
  }

  // 4) Recursos administrativos (só na versão definitiva).
  const abaRecursos = escolherAba(wb, ["recurso"]);
  if (abaRecursos) {
    const linhas = linhasDaAba(wb, abaRecursos);
    const cab = acharCabecalho(linhas);
    if (cab) {
      const colMunicipio = cab.colunas.findIndex((c) => c && casa(c, CHAVES_MUNICIPIO));
      const colItem = cab.colunas.findIndex(
        (c) => c && /contestad|objeto|item|solicitac|pedido/.test(normalizarTexto(c)),
      );
      const colResultado = cab.colunas.findIndex(
        (c) => c && /resultado|decisao|parecer|situacao/.test(normalizarTexto(c)),
      );
      for (let i = cab.indice + 1; i < linhas.length; i++) {
        const l = linhas[i] ?? [];
        const oficial = canonicalizarMunicipio(texto(l[colMunicipio]));
        if (!oficial) continue;
        const item = colItem >= 0 ? texto(l[colItem]) : "";
        const resultado = colResultado >= 0 ? texto(l[colResultado]) : "";
        if (!item && !resultado) continue;
        recursos.push({
          municipio: oficial.chave,
          municipioNome: oficial.nome,
          itemContestado: item || "Recurso administrativo",
          resultado: resultado || null,
        });
      }
    }
  }

  // 5) Nota técnica: texto corrido, guardado apenas para consulta.
  const abaNota = escolherAba(wb, ["nota tecnica", "nota técnica", "nota"]);
  let notaTecnica: string | null = null;
  if (abaNota) {
    const linhas = linhasDaAba(wb, abaNota)
      .map((l) => (l ?? []).map(texto).filter(Boolean).join(" "))
      .filter(Boolean);
    notaTecnica = linhas.join("\n").slice(0, 20000) || null;
  }

  // 6) Municípios presentes em uma aba e ausentes na outra — pode indicar
  // exclusão do critério no ano (§4 do art. 2º da lei).
  const divergencias: { municipio: string; esperado: number; obtido: number }[] = [];
  if (municipiosComDados.size) {
    for (const m of municipiosComIndice) {
      if (!municipiosComDados.has(m)) divergencias.push({ municipio: m, esperado: 1, obtido: 0 });
    }
    for (const m of municipiosComDados) {
      if (!municipiosComIndice.has(m)) divergencias.push({ municipio: m, esperado: 0, obtido: 1 });
    }
  }

  return {
    ranking,
    itens,
    dadosConstitutivos,
    recursos,
    notaTecnica,
    dicionario,
    naoMapeados: [...naoMapeados],
    cabecalho,
    divergencias,
  };
}

/** Soma dos índices de participação — deve fechar perto de 100. */
export function somaIndices(ranking: RankingCriterio[]): number {
  return ranking.reduce((t, l) => t + (l.indicePercentual || 0), 0);
}
