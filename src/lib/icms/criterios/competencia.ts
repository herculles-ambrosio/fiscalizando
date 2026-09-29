/** Publicações trimestrais são complementares; o FQ é uma nota, não um índice de repasse. */
export function competenciaAmbiental(identificacao: string | null): string {
  const nome = (identificacao ?? "").toLowerCase();
  if (/fator[-_ ]?de[-_ ]?qualidade|pontua[cç][aã]o[-_ ]?(?:preliminar|final)[-_ ]?fq|\bfq\b/.test(nome)) return "Fator de Qualidade";
  const trimestre = nome.match(/(?:^|[^\d])([1-4])[º°]?[-_ ]?(?:trimestre|trim)\b|(?:trimestre|trim)[-_ ]?([1-4])/);
  if (trimestre) return `${trimestre[1] ?? trimestre[2]}º trimestre`;
  const sequencia = nome.match(/icms-ecologic[oa][-_]([2-5])(?!\d)/);
  if (sequencia) return `${Number(sequencia[1]) - 1}º trimestre`;
  return "Competência não identificada";
}

export function identidadeAmbiental(identificacao: string | null, hash: string): string {
  if (!identificacao || identificacao.startsWith("texto colado")) return `sha256:${hash}`;
  return identificacao.trim().toLowerCase();
}