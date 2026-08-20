import subclasses from "./cnae-subclasses.json";

const TABELA = subclasses as Record<string, string>;

/** Normaliza o código do CNAE-Fiscal (7 dígitos) vindo dos arquivos da SEF-MG. */
export function normalizarCnae(codigo: string | null | undefined): string | null {
  const d = (codigo ?? "").replace(/[^0-9]/g, "");
  if (!d) return null;
  return d.length >= 7 ? d.slice(-7) : d.padStart(7, "0");
}

/** Descrição oficial (CNAE 2.x / IBGE) ou null quando o código não existe na tabela. */
export function descricaoCnae(codigo: string | null | undefined): string | null {
  const c = normalizarCnae(codigo);
  if (!c) return null;
  const desc = TABELA[c];
  if (!desc) return null;
  return desc.charAt(0) + desc.slice(1).toLowerCase();
}

/** "4781-4/00 — Comércio varejista de artigos do vestuário e acessórios" */
export function formatarCnae(codigo: string | null | undefined): string {
  const c = normalizarCnae(codigo);
  if (!c) return "—";
  const desc = descricaoCnae(c);
  return desc ? `${formatarCodigoCnae(c)} — ${desc}` : formatarCodigoCnae(c);
}

/** 4781400 -> 4781-4/00 */
export function formatarCodigoCnae(codigo: string | null | undefined): string {
  const c = normalizarCnae(codigo);
  if (!c || c.length !== 7) return c ?? "—";
  return `${c.slice(0, 4)}-${c.slice(4, 5)}/${c.slice(5)}`;
}
