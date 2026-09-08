/**
 * Conversão do conteúdo colado (texto do PDF, tabela do Excel ou CSV) para o
 * mesmo formato de páginas que o leitor de PDF entrega, permitindo reaproveitar
 * o parser genérico dos critérios sem precisar do arquivo original.
 */

import type { PaginaTexto } from "@/lib/icms/esportes/parser";

/** Detecta o separador dominante do conteúdo colado. */
function separador(texto: string): RegExp {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  const conta = (re: RegExp) => linhas.reduce((s, l) => s + (l.match(re)?.length ?? 0), 0);
  const tab = conta(/\t/g);
  const pv = conta(/;/g);
  const pipe = conta(/\|/g);
  const maior = Math.max(tab, pv, pipe);
  if (maior < linhas.length) return /\s{2,}/;
  if (maior === tab) return /\t/;
  if (maior === pv) return /;/;
  return /\|/;
}

export type ConteudoColado = {
  paginas: PaginaTexto[];
  linhas: number;
};

/**
 * Normaliza o conteúdo colado: cada linha vira uma linha de texto com as
 * células separadas por dois espaços, que é o que o parser espera.
 */
export function paginasDoTextoColado(bruto: string): ConteudoColado {
  const sep = separador(bruto);
  const linhas = bruto
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trimEnd())
    .filter((l) => l.trim().length > 0)
    .map((l) =>
      l
        .split(sep)
        .map((c) => c.trim())
        .filter((c, i, arr) => c.length > 0 || i < arr.length - 1)
        .join("  "),
    );

  return {
    paginas: [{ pagina: 1, linhas: linhas.map((texto, i) => ({ texto, y: linhas.length - i })) }],
    linhas: linhas.length,
  };

}
