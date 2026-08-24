export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

/** Valor monetário sem o símbolo R$ (para grids, onde o cabeçalho indica a unidade). */
export function formatarValorGrid(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatarPercentual(valor: number | null | undefined): string {
  if (valor == null) return "—";
  const sinal = valor > 0 ? "+" : "";
  return `${sinal}${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  const d = cnpj.replace(/\D/g, "").padStart(14, "0");
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Valor curto para eixos de gráfico: 12,3 mil / 4,5 mi / 1,2 bi. */
export function formatarCompacto(valor: number | null | undefined): string {
  if (valor == null || !isFinite(valor)) return "—";
  const abs = Math.abs(valor);
  const fmt = (v: number, s: string) =>
    `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${s}`;
  if (abs >= 1_000_000_000) return fmt(valor / 1_000_000_000, "bi");
  if (abs >= 1_000_000) return fmt(valor / 1_000_000, "mi");
  if (abs >= 1_000) return fmt(valor / 1_000, "mil");
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
