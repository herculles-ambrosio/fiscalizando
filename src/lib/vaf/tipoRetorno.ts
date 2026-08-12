export const TIPOS_RETORNO = ["mensal", "indice_provisorio", "indice_definitivo"] as const;
export type TipoRetorno = (typeof TIPOS_RETORNO)[number];

export const ROTULO_TIPO_RETORNO: Record<TipoRetorno, string> = {
  mensal: "Retorno mensal",
  indice_provisorio: "Índice provisório",
  indice_definitivo: "Índice definitivo",
};

export const ROTULO_TIPO_RETORNO_CURTO: Record<TipoRetorno, string> = {
  mensal: "Mensal",
  indice_provisorio: "Provisório",
  indice_definitivo: "Definitivo",
};

export function rotuloTipoRetorno(tipo: string | null | undefined): string {
  return ROTULO_TIPO_RETORNO[(tipo ?? "mensal") as TipoRetorno] ?? "Retorno mensal";
}

/**
 * Nome padrão da SEF-MG: P{codigo}RT{remessa}{ano}.txt — ex.: P443RT1226.
 * A remessa 13 é a que traz o fechamento (índice definitivo).
 */
export function remessaDoArquivo(nome: string): number | null {
  const m = /RT(\d{2})(\d{2})/i.exec(nome.replace(/\s+/g, ""));
  if (!m) return null;
  const remessa = Number(m[1]);
  return remessa >= 1 && remessa <= 13 ? remessa : null;
}

export function sugerirTipoRetorno(nome: string): { tipo: TipoRetorno; mes: number | null } {
  const remessa = remessaDoArquivo(nome);
  if (remessa === 13) return { tipo: "indice_definitivo", mes: null };
  return { tipo: "mensal", mes: remessa };
}
