/** Leitura do ESTBAN (Banco Central) e das declarações dos bancos (planilha ou DES-IF). */

import { digitos, type Declaracao } from "./conferencia";

export const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export type LinhaEstban = {
  competencia_ano: number;
  competencia_mes: number;
  cnpj_raiz: string;
  nome: string;
  agencias: number | null;
  verbete_710: number | null;
  verbete_711: number | null;
  verbete_712: number | null;
  depositos: number | null;
  operacoes_credito: number | null;
};

const num = (s: string | undefined) => {
  if (s == null || s.trim() === "") return null;
  const t = s.trim();
  const v = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(v) ? v : null;
};

/** Lê o CSV mensal do ESTBAN por município e devolve as instituições de um município. */
export function lerEstban(texto: string, municipioNome: string, uf: string): LinhaEstban[] {
  const linhas = texto.split(/\r?\n/);
  const iCab = linhas.findIndex((l) => l.startsWith("#DATA_BASE") || l.startsWith("DATA_BASE"));
  if (iCab < 0) throw new Error("Arquivo ESTBAN sem cabeçalho reconhecido.");
  const cab = linhas[iCab]!.replace(/^#/, "").split(";");
  const col = (pred: (c: string) => boolean) => cab.findIndex(pred);
  const c = {
    data: col((x) => x === "DATA_BASE"),
    uf: col((x) => x === "UF"),
    mun: col((x) => x === "MUNICIPIO"),
    cnpj: col((x) => x === "CNPJ"),
    nome: col((x) => x === "NOME_INSTITUICAO"),
    ag: col((x) => x === "AGEN_PROCESSADAS"),
    v710: col((x) => x.startsWith("VERBETE_710")),
    v711: col((x) => x.startsWith("VERBETE_711")),
    v712: col((x) => x.startsWith("VERBETE_712")),
    vista: col((x) => x.startsWith("VERBETE_401")),
    poup: col((x) => x.startsWith("VERBETE_420")),
    prazo: col((x) => x.startsWith("VERBETE_432")),
    cred: col((x) => x.startsWith("VERBETE_160")),
  };
  const alvo = semAcento(municipioNome);
  const out: LinhaEstban[] = [];
  for (const l of linhas.slice(iCab + 1)) {
    const f = l.split(";");
    if (f.length < 5) continue;
    if ((f[c.uf] ?? "").trim().toUpperCase() !== uf.toUpperCase()) continue;
    if (semAcento(f[c.mun] ?? "") !== alvo) continue;
    const data = digitos(f[c.data]);
    const dep = [c.vista, c.poup, c.prazo].map((i) => (i >= 0 ? num(f[i]) ?? 0 : 0)).reduce((a, b) => a + b, 0);
    out.push({
      competencia_ano: Number(data.slice(0, 4)),
      competencia_mes: Number(data.slice(4, 6)),
      cnpj_raiz: digitos(f[c.cnpj]).padStart(8, "0").slice(0, 8),
      nome: (f[c.nome] ?? "").trim(),
      agencias: num(f[c.ag]),
      verbete_710: num(f[c.v710]),
      verbete_711: num(f[c.v711]),
      verbete_712: num(f[c.v712]),
      depositos: dep,
      operacoes_credito: c.cred >= 0 ? num(f[c.cred]) : null,
    });
  }
  return out;
}

const chave = (t: string) => semAcento(t).toLowerCase();
const achar = (reg: Record<string, unknown>, nomes: string[]) => {
  for (const [k, v] of Object.entries(reg)) if (nomes.some((n) => chave(k).includes(n))) return v;
  return undefined;
};

const valorBr = (v: unknown): number => {
  if (typeof v === "number") return v;
  return num(String(v ?? "").replace(/[R$\s]/g, "")) ?? 0;
};

const simNao = (v: unknown): boolean | null => {
  const t = chave(String(v ?? ""));
  if (!t) return null;
  if (["s", "sim", "true", "1", "t", "tributavel"].includes(t)) return true;
  if (["n", "nao", "false", "0", "f", "naotributavel", "isento"].includes(t)) return false;
  return null;
};

/** Planilha com colunas de banco/CNPJ, competência, conta, valor e (opcional) tributável, alíquota e ISS. */
export function lerPlanilhaDeclaracoes(
  registros: Record<string, unknown>[],
  padrao: { cnpj?: string; nome?: string; ano?: number; mes?: number },
): { linhas: Declaracao[]; ignoradas: number } {
  const linhas: Declaracao[] = [];
  let ignoradas = 0;
  for (const r of registros) {
    const cnpj = digitos(String(achar(r, ["cnpj"]) ?? padrao.cnpj ?? ""));
    let ano = Number(achar(r, ["ano"]) ?? padrao.ano ?? 0);
    let mes = Number(achar(r, ["mes"]) ?? padrao.mes ?? 0);
    const comp = String(achar(r, ["competencia", "periodo"]) ?? "");
    const m = comp.match(/(\d{1,2})\D(\d{4})/) ?? comp.match(/(\d{4})(\d{2})/);
    if (m) {
      if (m[1]!.length === 4) { ano = Number(m[1]); mes = Number(m[2]); } else { mes = Number(m[1]); ano = Number(m[2]); }
    }
    const valorBruto = achar(r, ["valor", "saldo", "receita", "base"]);
    if (!cnpj || !ano || !mes || mes > 12 || valorBruto === undefined || valorBruto === "") { ignoradas++; continue; }
    const aliq = achar(r, ["aliquota"]);
    const iss = achar(r, ["iss"]);
    linhas.push({
      cnpj,
      instituicao_nome: String(achar(r, ["banco", "instituicao", "razao", "nome"]) ?? padrao.nome ?? "") || null,
      competencia_ano: ano,
      competencia_mes: mes,
      conta: String(achar(r, ["conta", "cosif", "subtitulo"]) ?? "TOTAL").trim() || "TOTAL",
      descricao: String(achar(r, ["descricao", "historico"]) ?? "") || null,
      valor: valorBr(valorBruto),
      tributavel_declarado: simNao(achar(r, ["tributavel", "tributacao"])),
      aliquota_declarada: aliq === undefined || aliq === "" ? null : valorBr(aliq),
      iss_declarado: iss === undefined || iss === "" ? null : valorBr(iss),
    });
  }
  return { linhas, ignoradas };
}

const COSIF = /^\d\.\d\.\d\.\d{2}\.\d{2}-?\d$|^\d{8}$/;

/**
 * Leitura experimental de arquivo texto da DES-IF (ABRASF): procura, em cada
 * linha separada por | ; ou tabulação, um código COSIF e o valor monetário.
 */
export function lerDesif(
  texto: string,
  padrao: { cnpj: string; nome?: string; ano: number; mes: number },
): { linhas: Declaracao[]; ignoradas: number } {
  const linhas: Declaracao[] = [];
  let ignoradas = 0;
  for (const l of texto.split(/\r?\n/)) {
    const f = l.split(/[|;\t]/).map((x) => x.trim());
    const iConta = f.findIndex((x) => COSIF.test(x));
    if (iConta < 0) { if (l.trim()) ignoradas++; continue; }
    const valores = f.slice(iConta + 1).filter((x) => /^-?[\d.]+,\d{2}$|^-?\d+\.\d{2}$/.test(x)).map(valorBr);
    if (!valores.length) { ignoradas++; continue; }
    const desc = f.slice(iConta + 1).find((x) => /[A-Za-zÀ-ÿ]{3}/.test(x)) ?? null;
    const trib = f.map(simNao).find((x) => x !== null) ?? null;
    linhas.push({
      cnpj: padrao.cnpj,
      instituicao_nome: padrao.nome ?? null,
      competencia_ano: padrao.ano,
      competencia_mes: padrao.mes,
      conta: f[iConta]!,
      descricao: desc,
      valor: valores[0]!,
      tributavel_declarado: trib,
      aliquota_declarada: null,
      iss_declarado: null,
    });
  }
  return { linhas, ignoradas };
}
