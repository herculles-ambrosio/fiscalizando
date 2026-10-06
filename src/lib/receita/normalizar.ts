/**
 * Situação cadastral na Receita Federal (dados abertos do CNPJ).
 * Fontes públicas e gratuitas: OpenCNPJ, Minha Receita e BrasilAPI.
 */

export const SITUACOES_RECEITA = [
  "ATIVA",
  "SUSPENSA",
  "INAPTA",
  "BAIXADA",
  "NULA",
  "DESCONHECIDA",
] as const;
export type SituacaoReceita = (typeof SITUACOES_RECEITA)[number];

export const ROTULO_SITUACAO_RECEITA: Record<SituacaoReceita | "NAO_CONSULTADO", string> = {
  ATIVA: "Ativa",
  SUSPENSA: "Suspensa",
  INAPTA: "Inapta",
  BAIXADA: "Baixada",
  NULA: "Nula",
  DESCONHECIDA: "Não encontrada",
  NAO_CONSULTADO: "Não consultado",
};

/** Situações em que o ofício provavelmente não será recebido. */
export const SITUACOES_RECEITA_ENCERRADAS: SituacaoReceita[] = ["BAIXADA", "NULA"];

export type RegistroReceita = {
  cnpj: string;
  situacao: SituacaoReceita;
  situacao_data: string | null;
  motivo: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  uf: string | null;
  municipio: string | null;
  cnae_principal: string | null;
  fonte: string;
  consultado_em?: string;
};

export function limparCnpj(valor: string | null | undefined): string | null {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  return digitos.length === 14 ? digitos : null;
}

/** Valida os dígitos verificadores; arquivos de retorno trazem CNPJs inexistentes. */
export function cnpjValido(valor: string | null | undefined): boolean {
  const c = limparCnpj(valor);
  if (!c || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (tamanho: number) => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(c[i]) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** CNPJ limpo apenas quando válido. */
export function cnpjUtil(valor: string | null | undefined): string | null {
  return cnpjValido(valor) ? limparCnpj(valor) : null;
}


const MAPA: Record<string, SituacaoReceita> = {
  "1": "NULA",
  "2": "ATIVA",
  "3": "SUSPENSA",
  "4": "INAPTA",
  "8": "BAIXADA",
  NULA: "NULA",
  ATIVA: "ATIVA",
  SUSPENSA: "SUSPENSA",
  INAPTA: "INAPTA",
  BAIXADA: "BAIXADA",
};

function semAcento(txt: string): string {
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function situacaoReceitaDe(valor: unknown): SituacaoReceita {
  const bruto = semAcento(String(valor ?? ""));
  if (!bruto) return "DESCONHECIDA";
  return MAPA[bruto] ?? "DESCONHECIDA";
}

function texto(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  return t.length ? t : null;
}


function valida(iso: string): string | null {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || a < 1800 || !m || m > 12 || !d || d > 31) return null;
  const x = new Date(Date.UTC(a, m - 1, d));
  return x.getUTCMonth() === m - 1 ? iso : null;
}

function data(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return valida(t.slice(0, 10));
  if (/^\d{8}$/.test(t)) return valida(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`);
  return null;
}

/** Aceita as variações de nome de campo entre OpenCNPJ, Minha Receita e BrasilAPI. */
export function normalizarRetorno(
  cnpj: string,
  fonte: string,
  bruto: Record<string, unknown>,
): RegistroReceita {
  const situacaoBruta =
    bruto["descricao_situacao_cadastral"] ??
    bruto["situacao_cadastral"] ??
    bruto["situacao"] ??
    bruto["codigo_situacao_cadastral"];

  const cnae =
    bruto["cnae_principal"] ??
    bruto["cnae_fiscal"] ??
    (Array.isArray(bruto["cnaes"])
      ? ((bruto["cnaes"] as Record<string, unknown>[]).find((c) => c["is_principal"])?.["codigo"] ??
        null)
      : null);

  return {
    cnpj,
    situacao: situacaoReceitaDe(situacaoBruta),
    situacao_data: data(bruto["data_situacao_cadastral"]),
    motivo:
      texto(bruto["descricao_motivo_situacao_cadastral"]) ??
      texto(bruto["motivo_situacao_cadastral"]),
    razao_social: texto(bruto["razao_social"]) ?? texto(bruto["nome"]),
    nome_fantasia: texto(bruto["nome_fantasia"]),
    uf: texto(bruto["uf"]),
    municipio: texto(bruto["municipio"]),
    cnae_principal: texto(cnae) ? String(cnae).replace(/\D/g, "") : null,
    fonte,
  };
}
