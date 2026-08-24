import type { Campo } from "./layouts";

// Campos numéricos que na verdade carregam datas (não têm decimais implícitas).
const CAMPOS_DATA = [
  "data_entrega",
  "data_processamento",
  "data_primeira_entrega",
  "data_entrada_vaf",
];

/**
 * Os arquivos da SEF-MG traizem os valores em reais inteiros (sem centavos
 * implícitos) — o mesmo critério usado na apuração do índice e no registro 40.
 */
export const DECIMAIS_IMPLICITAS = 0;

export function parseLinha(linha: string, layout: Campo[]): Record<string, any> {
  const maxEnd = Math.max(...layout.map((c) => c[1]));
  if (linha.length < maxEnd) linha = linha.padEnd(maxEnd, " ");
  const out: Record<string, any> = {};
  for (const [inicio, fim, tipo, nome] of layout) {
    const raw = linha.slice(inicio - 1, fim);
    out[nome] = raw.trim();
    if (tipo === "N" && !CAMPOS_DATA.includes(nome)) {
      const digits = raw.replace(/[^0-9]/g, "");
      out[nome + "_num"] = digits ? Number(digits) / 10 ** DECIMAIS_IMPLICITAS : null;
    }
  }
  return out;
}

/**
 * Os arquivos da SEF-MG vêm em Latin-1. Se o conteúdo for UTF-8 válido
 * (algum município pode reenviar convertido), usamos UTF-8.
 */
export function decodificarArquivo(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return utf8;
  } catch {
    return new TextDecoder("iso-8859-1").decode(bytes);
  }
}

export function separarLinhas(texto: string): string[] {
  return texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

/** "DDMMAAAA" -> "AAAA-MM-DD" (null quando inválida/zerada) */
export function dataSefParaISO(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const d = valor.replace(/[^0-9]/g, "");
  if (d.length !== 8 || d === "00000000") return null;
  const dia = d.slice(0, 2);
  const mes = d.slice(2, 4);
  const ano = d.slice(4, 8);
  if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
  return `${ano}-${mes}-${dia}`;
}

/** Chave comparável para ordenar datas no formato DDMMAAAA. */
export function chaveData(valor: string | undefined | null): number {
  const iso = dataSefParaISO(valor);
  return iso ? Number(iso.replace(/-/g, "")) : 0;
}
