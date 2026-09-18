/**
 * Conversão de planilha (XLSX/XLS/CSV) para o mesmo formato de páginas que o
 * leitor de PDF entrega. Assim qualquer critério aceita tanto o PDF quanto a
 * planilha oficial: cada aba vira uma página e cada linha vira uma linha de
 * texto com as células separadas por dois espaços, que é o que o parser
 * genérico de tabelas espera.
 */

import * as XLSX from "xlsx";
import type { PaginaTexto } from "@/lib/icms/esportes/parser";

export type ConteudoPlanilha = {
  paginas: PaginaTexto[];
  abas: string[];
  linhas: number;
};

function celula(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  return String(v).replace(/\u00a0/g, " ").trim();
}

export function paginasDaPlanilha(dados: Uint8Array): ConteudoPlanilha {
  const wb = XLSX.read(dados, { type: "array" });
  const paginas: PaginaTexto[] = [];
  const abas: string[] = [];
  let total = 0;

  wb.SheetNames.forEach((nome, indice) => {
    const aba = wb.Sheets[nome];
    if (!aba) return;
    const matriz = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, blankrows: false });
    const linhas = matriz
      .map((l) => (Array.isArray(l) ? l.map(celula) : []))
      .filter((l) => l.some((c) => c.length > 0))
      .map((l) => l.join("  ").trimEnd());
    if (!linhas.length) return;
    abas.push(nome);
    total += linhas.length;
    paginas.push({
      pagina: indice + 1,
      linhas: linhas.map((texto, i) => ({ texto, y: linhas.length - i })),
    });
  });

  return { paginas, abas, linhas: total };
}

/** Reconhece pelo conteúdo se o arquivo enviado é um PDF. */
export function ehPdf(dados: Uint8Array): boolean {
  return dados[0] === 0x25 && dados[1] === 0x50 && dados[2] === 0x44 && dados[3] === 0x46;
}
