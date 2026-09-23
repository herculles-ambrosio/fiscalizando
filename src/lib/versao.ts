declare const __BUILD_TIME__: string;

/** Versão principal do sistema — aumente ao liberar mudanças grandes. */
export const VERSAO_BASE = "2.0";

const iso = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();
const d = new Date(iso);
const p = (n: number) => String(n).padStart(2, "0");

/** Número da versão gerado a cada publicação: 2.0.AAAAMMDD.HHMM (horário de Brasília). */
const br = new Date(d.getTime() - 3 * 3600 * 1000);
export const VERSAO = `${VERSAO_BASE}.${br.getUTCFullYear()}${p(br.getUTCMonth() + 1)}${p(br.getUTCDate())}.${p(br.getUTCHours())}${p(br.getUTCMinutes())}`;

export const DATA_VERSAO = `${p(br.getUTCDate())}/${p(br.getUTCMonth() + 1)}/${br.getUTCFullYear()} ${p(br.getUTCHours())}:${p(br.getUTCMinutes())}`;
