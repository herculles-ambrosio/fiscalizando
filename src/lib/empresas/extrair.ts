/** Dados de empresa extraídos das fontes públicas do CNPJ e classificação para fiscalização. */

export const TIPOS_EMPRESA = ["MEI", "SIMPLES", "OUTRO", "NAO_CLASSIFICADO"] as const;
export type TipoEmpresa = (typeof TIPOS_EMPRESA)[number];
export const ROTULO_TIPO: Record<TipoEmpresa, string> = {
  MEI: "MEI",
  SIMPLES: "Simples Nacional",
  OUTRO: "Outro",
  NAO_CLASSIFICADO: "Não classificado",
};

function txt(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}
function dt(v: unknown): string | null {
  const t = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return `${t.slice(6)}-${t.slice(3, 5)}-${t.slice(0, 2)}`;
  return null;
}
function bool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  const t = String(v ?? "").trim().toUpperCase();
  if (["S", "SIM", "TRUE", "1"].includes(t)) return true;
  if (["N", "NAO", "NÃO", "FALSE", "0"].includes(t)) return false;
  return null;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export type DadosEmpresa = {
  razao_social: string | null;
  nome_fantasia: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  municipio_nome: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  cnaes_secundarios: string[];
  natureza_juridica: string | null;
  porte: string | null;
  data_inicio: string | null;
  opcao_simples: boolean | null;
  data_opcao_simples: string | null;
  data_exclusao_simples: string | null;
  opcao_mei: boolean | null;
  data_opcao_mei: string | null;
  data_exclusao_mei: string | null;
};

/** Aceita OpenCNPJ, Minha Receita e BrasilAPI. */
export function extrairEmpresa(b: Record<string, unknown>): DadosEmpresa {
  const simples = obj(b["simples"]);
  const tipoLog = txt(b["descricao_tipo_de_logradouro"]) ?? txt(b["tipo_logradouro"]);
  const log = txt(b["logradouro"]);
  const tels: string[] = [];
  if (Array.isArray(b["telefones"])) {
    for (const t of b["telefones"] as Record<string, unknown>[]) {
      const n = `${txt(t["ddd"]) ?? ""}${txt(t["numero"]) ?? ""}`;
      if (n) tels.push(n);
    }
  }
  for (const k of ["ddd_telefone_1", "ddd_telefone_2", "telefone"]) {
    const n = txt(b[k]);
    if (n && !tels.includes(n)) tels.push(n);
  }
  const sec: string[] = [];
  const secs = b["cnaes_secundarios"];
  if (Array.isArray(secs)) {
    for (const s of secs) {
      const c = typeof s === "object" ? obj(s)["codigo"] : s;
      const d = String(c ?? "").replace(/\D/g, "");
      if (d && d !== "0") sec.push(d.padStart(7, "0"));
    }
  }
  const cnae =
    txt(b["cnae_principal"]) ?? txt(b["cnae_fiscal"]) ?? null;
  const natureza = b["natureza_juridica"];
  return {
    razao_social: txt(b["razao_social"]) ?? txt(b["nome"]),
    nome_fantasia: txt(b["nome_fantasia"]),
    logradouro: log ? (tipoLog && !log.startsWith(tipoLog) ? `${tipoLog} ${log}` : log) : null,
    numero: txt(b["numero"]),
    complemento: txt(b["complemento"]),
    bairro: txt(b["bairro"]),
    cep: txt(b["cep"])?.replace(/\D/g, "") ?? null,
    municipio_nome: txt(b["municipio"]),
    uf: txt(b["uf"]),
    email: txt(b["email"])?.toLowerCase() ?? null,
    telefone: tels.join(" / ") || null,
    cnae_principal: cnae ? cnae.replace(/\D/g, "").padStart(7, "0") : null,
    cnae_descricao: txt(b["cnae_fiscal_descricao"]),
    cnaes_secundarios: sec,
    natureza_juridica:
      typeof natureza === "object" ? txt(obj(natureza)["descricao"]) : txt(natureza),
    porte: txt(b["porte"]) ?? txt(b["porte_empresa"]),
    data_inicio: dt(b["data_inicio_atividade"]) ?? dt(b["data_inicio_atividades"]),
    opcao_simples: bool(b["opcao_pelo_simples"] ?? b["opcao_simples"] ?? simples["simples"]),
    data_opcao_simples: dt(b["data_opcao_pelo_simples"] ?? b["data_opcao_simples"]),
    data_exclusao_simples: dt(b["data_exclusao_do_simples"] ?? b["data_exclusao_simples"]),
    opcao_mei: bool(b["opcao_pelo_mei"] ?? b["opcao_mei"] ?? simples["mei"]),
    data_opcao_mei: dt(b["data_opcao_pelo_mei"] ?? b["data_opcao_mei"]),
    data_exclusao_mei: dt(b["data_exclusao_do_mei"] ?? b["data_exclusao_mei"]),
  };
}

export function classificar(d: { opcao_mei: boolean | null; opcao_simples: boolean | null }): TipoEmpresa {
  if (d.opcao_mei) return "MEI";
  if (d.opcao_simples) return "SIMPLES";
  if (d.opcao_mei === false || d.opcao_simples === false) return "OUTRO";
  return "NAO_CLASSIFICADO";
}

/** Divisões CNAE de indústria (05–33) e comércio (45–47): normalmente exigem inscrição estadual. */
export function atividadeExigeIe(cnae: string | null | undefined): boolean {
  const d = Number(String(cnae ?? "").replace(/\D/g, "").padStart(7, "0").slice(0, 2));
  return (d >= 5 && d <= 33) || (d >= 45 && d <= 47);
}
