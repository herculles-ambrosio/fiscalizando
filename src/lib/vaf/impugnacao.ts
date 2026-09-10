/**
 * Impugnação do índice provisório do VAF (SEF/MG).
 * Reúne os contribuintes contestados, monta a planilha de anexo e o pacote ZIP.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";
import { nomeArquivoSeguro } from "@/lib/oficios/texto";

/** Chave usada para levar os contribuintes marcados até a tela de impugnação. */
export const CHAVE_ITENS_IMPUGNACAO = "impugnacao:itens";

export type ItemImpugnacao = {
  /** inscrição estadual do contribuinte contestado */
  ie: string;
  cnpj: string | null;
  nome: string | null;
  /** por que o dado do contribuinte está sendo contestado */
  motivo: string;
  /** VAF considerado pela SEF na apuração provisória */
  vafApurado: number;
  /** VAF que o município entende correto */
  vafCorreto: number;
  observacao: string;
};

export type DadosImpugnacao = {
  nome: string;
  exercicio: number;
  anoBase: number | null;
  resolucao: string;
  resolucaoData: string | null;
  indicePublicado: number | null;
  observacao: string;
  itens: ItemImpugnacao[];
};

export const MOTIVOS_IMPUGNACAO = [
  "Contribuinte não entregou a DAMEF/declaração no exercício",
  "Declaração entregue com valor adicionado zerado",
  "Queda expressiva de valor adicionado sem respaldo econômico",
  "Valor adicionado divergente dos documentos fiscais",
  "Operações atribuídas a outro município",
  "Contribuinte com atividade no município e sem VAF apurado",
] as const;

/** Motivo sugerido a partir das situações apuradas pelo sistema. */
export function motivoSugerido(situacoes: string[] | null | undefined): string {
  const s = new Set((situacoes ?? []).map((x) => String(x).toUpperCase()));
  if (s.has("OMISSO") || s.has("SOMENTE_RETORNO")) return MOTIVOS_IMPUGNACAO[0];
  if (s.has("ZERADO")) return MOTIVOS_IMPUGNACAO[1];
  if (s.has("DISCREPANTE")) return MOTIVOS_IMPUGNACAO[2];
  if (s.has("FORA_DO_PRAZO")) return MOTIVOS_IMPUGNACAO[0];
  return MOTIVOS_IMPUGNACAO[3];
}

export const diferencaItem = (i: ItemImpugnacao): number =>
  Math.max(0, (Number(i.vafCorreto) || 0) - (Number(i.vafApurado) || 0));

export const totalContestado = (itens: ItemImpugnacao[]): number =>
  itens.reduce((s, i) => s + diferencaItem(i), 0);

export const moedaBr = (v: number): string =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

/** Planilha (XLSX) com um contribuinte por linha, para anexar à impugnação. */
export function planilhaImpugnacao(dados: DadosImpugnacao, municipio: string | null): Blob {
  const linhas = dados.itens.map((i, n) => ({
    "Nº": n + 1,
    "Inscrição estadual": i.ie,
    CNPJ: i.cnpj ?? "",
    Contribuinte: i.nome ?? "",
    Motivo: i.motivo,
    "VAF apurado (R$)": Number(i.vafApurado) || 0,
    "VAF que o município entende correto (R$)": Number(i.vafCorreto) || 0,
    "Diferença a recompor (R$)": diferencaItem(i),
    Observação: i.observacao ?? "",
  }));

  const planilha = XLSX.utils.json_to_sheet(linhas);
  planilha["!cols"] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 20 },
    { wch: 42 },
    { wch: 46 },
    { wch: 18 },
    { wch: 22 },
    { wch: 20 },
    { wch: 40 },
  ];

  const capa = XLSX.utils.aoa_to_sheet([
    ["Impugnação do índice provisório do VAF"],
    ["Município", municipio ?? ""],
    ["Exercício do índice", dados.exercicio],
    ["Ano-base", dados.anoBase ?? ""],
    ["Resolução impugnada", dados.resolucao],
    ["Publicação", dados.resolucaoData ?? ""],
    ["Índice provisório publicado", dados.indicePublicado ?? ""],
    ["Contribuintes contestados", dados.itens.length],
    ["Total a recompor (R$)", totalContestado(dados.itens)],
  ]);
  capa["!cols"] = [{ wch: 34 }, { wch: 40 }];

  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, capa, "Resumo");
  XLSX.utils.book_append_sheet(livro, planilha, "Contribuintes");
  const buffer = XLSX.write(livro, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function nomeBaseArquivo(dados: DadosImpugnacao, municipio: string | null): string {
  return nomeArquivoSeguro(
    `impugnacao_${municipio ?? "municipio"}_${dados.exercicio}`.toLowerCase(),
  );
}

export function baixarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** ZIP com a petição, a planilha (Anexo I) e os anexos II e III. */
export async function zipImpugnacao(
  documento: Blob,
  planilha: Blob,
  base: string,
  anexos?: { anexoII: Blob; anexoIII: Blob } | null,
): Promise<Blob> {
  const zip = new JSZip();
  zip.file(`${base}.docx`, documento);
  zip.file(`${base}_anexo-I_contribuintes.xlsx`, planilha);
  if (anexos) {
    zip.file(`${base}_anexo-II_demonstrativo.docx`, anexos.anexoII);
    zip.file(`${base}_anexo-III_fichas.docx`, anexos.anexoIII);
  }
  return zip.generateAsync({ type: "blob" });
}

