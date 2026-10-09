/** Cadastro econômico exportado do sistema da prefeitura e cruzamento com a base da Receita. */

export type LinhaPrefeitura = {
  documento: string;
  tipo_documento: "CNPJ" | "CPF" | "OUTRO";
  inscricao_municipal: string | null;
  nome: string | null;
  regime: string | null;
  simples_optante: boolean | null;
  situacao: string | null;
  situacao_normalizada: "ATIVA" | "BAIXADA" | "SUSPENSA" | "OUTRA";
  municipio_endereco: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  alerta_municipio: "OUTRO_MUNICIPIO" | "PROVAVEL_ERRO" | null;
  repetido: boolean;
};

export const ROTULO_ALERTA_MUNICIPIO = {
  OUTRO_MUNICIPIO: "Endereço em outro município",
  PROVAVEL_ERRO: "Provável erro de digitação",
} as const;

export function semAcento(t: string | null | undefined) {
  return String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function normalizarSituacao(s: string | null | undefined): LinhaPrefeitura["situacao_normalizada"] {
  const c = situacaoComum(s);
  return c === "ATIVA" || c === "BAIXADA" || c === "SUSPENSA" ? c : "OUTRA";
}


export function simplesDe(s: string | null | undefined): boolean | null {
  const t = semAcento(s);
  if (!t) return null;
  if (t.startsWith("nao")) return false;
  if (t.startsWith("optante")) return true;
  return null;
}

export function regimeEhMei(r: string | null | undefined) {
  const t = semAcento(r);
  return /\bmei\b|micro empreendedor individual/.test(t);
}

function v(x: unknown): string | null {
  const t = String(x ?? "").trim();
  return t ? t : null;
}

/** Converte as linhas do Excel (cabeçalhos por nome) e aplica a regra de município. */
export function lerCadastroPrefeitura(
  linhas: Record<string, unknown>[],
  municipioAtivo: string,
): { ok: true; linhas: LinhaPrefeitura[]; municipioPlanilha: string } | { ok: false; erro: string } {
  if (!linhas.length) return { ok: false, erro: "A planilha está vazia." };
  if (!("N. Documento" in (linhas[0] ?? {}))) return { ok: false, erro: "Coluna “N. Documento” não encontrada na planilha." };

  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const m = v(l["Município"]);
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const predominante = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  if (semAcento(predominante) !== semAcento(municipioAtivo)) {
    return { ok: false, erro: `Esta planilha não é da prefeitura ativa (${municipioAtivo}). A maior parte das linhas é de ${predominante || "município não informado"}.` };
  }
  const ceps = new Map<string, number>();
  for (const l of linhas) {
    const cep = String(l["CEP"] ?? "").replace(/\D/g, "");
    if (cep.length === 8 && semAcento(v(l["Município"])) === semAcento(municipioAtivo)) ceps.set(cep, (ceps.get(cep) ?? 0) + 1);
  }
  const cepPrefeitura = [...ceps.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const vistos = new Set<string>();
  const saida = linhas.map((l): LinhaPrefeitura => {
    const doc = String(l["N. Documento"] ?? "").replace(/\D/g, "");
    const cep = String(l["CEP"] ?? "").replace(/\D/g, "") || null;
    const mun = v(l["Município"]);
    let alerta: LinhaPrefeitura["alerta_municipio"] = null;
    if (mun && semAcento(mun) !== semAcento(municipioAtivo)) alerta = cep && cep === cepPrefeitura ? "PROVAVEL_ERRO" : "OUTRO_MUNICIPIO";
    const repetido = !!doc && vistos.has(doc);
    if (doc) vistos.add(doc);
    return {
      documento: doc,
      tipo_documento: doc.length === 14 ? "CNPJ" : doc.length === 11 ? "CPF" : "OUTRO",
      inscricao_municipal: v(l["Inscrição Municipal"]),
      nome: v(l["Nome do Contribuinte"]),
      regime: v(l["Regime Tributário"]),
      simples_optante: simplesDe(v(l["Simples Nacional"])),
      situacao: v(l["Situação"]),
      situacao_normalizada: normalizarSituacao(v(l["Situação"])),
      municipio_endereco: mun,
      cep,
      endereco: [v(l["Tipo do Logradouro"]), v(l["Logradouro"]), v(l["N. Métrico"])].filter(Boolean).join(" ") || null,
      bairro: v(l["Bairro"]),
      alerta_municipio: alerta,
      repetido,
    };
  }).filter((l) => l.documento);
  return { ok: true, linhas: saida, municipioPlanilha: predominante };
}

export type EmpresaReceita = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: string | null;
  opcao_simples: boolean | null;
  opcao_mei: boolean | null;
};

export type Divergencia = "SIMPLES" | "MEI" | "SITUACAO";
export const ROTULO_DIVERGENCIA: Record<Divergencia, string> = {
  SIMPLES: "Simples Nacional divergente",
  MEI: "MEI divergente",
  SITUACAO: "Situação divergente",
};

export function divergencias(p: Pick<LinhaPrefeitura, "simples_optante" | "regime" | "situacao_normalizada">, r: EmpresaReceita): Divergencia[] {
  const d: Divergencia[] = [];
  if (p.simples_optante != null && r.opcao_simples != null && p.simples_optante !== r.opcao_simples) d.push("SIMPLES");
  if (r.opcao_mei != null && regimeEhMei(p.regime) !== r.opcao_mei) d.push("MEI");
  const ra = r.situacao === "ATIVA";
  if (r.situacao && p.situacao_normalizada !== "OUTRA" && (p.situacao_normalizada === "ATIVA") !== ra) d.push("SITUACAO");
  return d;
}

/** Situação em uma escala única, usada para filtrar o cruzamento dos dois cadastros. */
export type SituacaoComum = "ATIVA" | "BAIXADA" | "SUSPENSA" | "INAPTA" | "NULA" | "OUTRA";

export const ROTULO_SITUACAO_COMUM: Record<SituacaoComum, string> = {
  ATIVA: "Ativa",
  BAIXADA: "Baixada",
  SUSPENSA: "Suspensa",
  INAPTA: "Inapta",
  NULA: "Nula",
  OUTRA: "Outra",
};

/** Normaliza a situação livre (texto da planilha ou código da Receita) para os dois cadastros serem comparáveis. */
export function situacaoComum(s: string | null | undefined): SituacaoComum | null {
  const t = semAcento(s);
  if (!t) return null;
  if (t.startsWith("ativo") || t.startsWith("ativa") || t.startsWith("provisorio")) return "ATIVA";
  if (t.startsWith("baixad")) return "BAIXADA";
  if (t.startsWith("suspens")) return "SUSPENSA";
  if (t.startsWith("inapt")) return "INAPTA";
  if (t.startsWith("nula")) return "NULA";
  return "OUTRA";
}


/** Situações presentes na linha, vindas do cadastro da prefeitura e/ou da base da Receita. */
export function situacoesDaLinha(
  p: { situacao: string | null } | undefined,
  r: { situacao: string | null } | undefined,
): SituacaoComum[] {
  const out: SituacaoComum[] = [];
  for (const s of [situacaoComum(p?.situacao), situacaoComum(r?.situacao)]) {
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

