import { ROTULO_SITUACAO_RECEITA, type SituacaoReceita } from "./normalizar";

/** IE normalizada (só dígitos, sem zeros à esquerda) → rótulo da situação na Receita. */
export type MapaReceitaPorIe = Record<string, string>;

export function chaveIeReceita(ie: string | null | undefined): string {
  return String(ie ?? "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
}

export function rotuloReceitaDe(
  mapa: MapaReceitaPorIe | null | undefined,
  ie: string | null | undefined,
): string | null {
  if (!mapa) return null;
  return mapa[chaveIeReceita(ie)] ?? null;
}

/** Sufixo pronto para textos, DOCX e PDF: " · Receita Federal: Baixada". */
export function sufixoReceita(
  mapa: MapaReceitaPorIe | null | undefined,
  ie: string | null | undefined,
): string {
  const rotulo = rotuloReceitaDe(mapa, ie);
  return rotulo ? ` · Receita Federal: ${rotulo}` : "";
}

export function rotuloSituacao(situacao: string | null | undefined): string {
  const chave = (situacao ?? "NAO_CONSULTADO") as SituacaoReceita | "NAO_CONSULTADO";
  return ROTULO_SITUACAO_RECEITA[chave] ?? ROTULO_SITUACAO_RECEITA.DESCONHECIDA;
}
