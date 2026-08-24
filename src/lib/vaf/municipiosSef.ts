import tabela from "./municipios-sef.json";
import { normalizarCodigoSef } from "./municipioArquivo";

/**
 * Relação oficial código SEF-MG → nome do município (todos os 853 municípios
 * mineiros), extraída da tabela "Códigos dos Municípios" da SEF-MG.
 */
const MUNICIPIOS_SEF = tabela as Record<string, string>;

/** Nome do município a partir do código SEF-MG (aceita "047", "47", 47). */
export function nomeMunicipioSef(codigo: string | number | null | undefined): string | null {
  const normalizado = normalizarCodigoSef(codigo == null ? null : String(codigo));
  if (!normalizado) return null;
  return MUNICIPIOS_SEF[normalizado] ?? null;
}

export { MUNICIPIOS_SEF };
