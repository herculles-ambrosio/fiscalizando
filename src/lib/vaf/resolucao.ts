/**
 * Leitura do Anexo Único das resoluções da SEF-MG que publicam os índices
 * provisórios/definitivos de participação dos municípios no ICMS.
 *
 * Colunas do anexo:
 *   Cód. Mun. | Nome do Município | VAF Individual A | Índice A |
 *   VAF Individual B | Índice B | Média dos Índices A/B
 *
 * A função aceita tanto o HTML da página oficial quanto o conteúdo colado
 * pelo usuário (tabela copiada do navegador).
 */

import { normalizarCodigoSef } from "./municipioArquivo";
import { nomeMunicipioSef } from "./municipiosSef";

export type LinhaResolucao = {
  codigoMun: string;
  municipioNome: string;
  vafA: number | null;
  indiceA: number | null;
  vafB: number | null;
  indiceB: number | null;
  mediaIndices: number | null;
};

export type AnexoResolucao = {
  /** Número da resolução, quando identificado no texto (ex.: "6069/2026"). */
  resolucao: string | null;
  /** Exercício de aplicação dos índices (ex.: 2027). */
  exercicioAplicacao: number | null;
  anoA: number | null;
  anoB: number | null;
  linhas: LinhaResolucao[];
};

/** Remove acentos e pontuação para comparar nomes de municípios. */
export function chaveNome(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function numeroBr(valor: string): number | null {
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const ehNumero = (t: string) => /^-?[\d.]+(,\d+)?$/.test(t) && /\d/.test(t);
const ehNome = (t: string) => /[A-Za-zÀ-ÿ]{3}/.test(t) && t.length <= 80;

function tokenizar(conteudo: string): string[] {
  const texto = conteudo.includes("<")
    ? conteudo
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, "\n")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
    : conteudo.replace(/\t/g, "\n");

  return texto
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseAnexoResolucao(conteudo: string): AnexoResolucao {
  const tokens = tokenizar(conteudo);
  const plano = tokens.join(" ");

  const mResolucao = /Resolu[çc][ãa]o\s*n[º°o]?\s*([\d.]+)[^\d]{0,10}(\d{4})?/i.exec(plano);
  const mExercicio = /exerc[íi]cio de (\d{4})/i.exec(plano);
  const anos = [...plano.matchAll(/Individual\s*(\d{4})/gi)].map((m) => Number(m[1]));

  const linhas: LinhaResolucao[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const codigo = tokens[i]!;
    if (!/^\d{1,4}$/.test(codigo)) continue;
    const nome = tokens[i + 1];
    if (!nome || !ehNome(nome)) continue;
    const valores = tokens.slice(i + 2, i + 7);
    if (valores.length < 5 || !valores.every(ehNumero)) continue;

    const nums = valores.map(numeroBr);
    // descarta blocos que não são linhas do anexo (ex.: lista de anos no menu):
    // índices são percentuais pequenos e o VAF individual é sempre grande
    const indicesOk = [nums[1], nums[3], nums[4]].every((n) => n != null && n >= 0 && n <= 100);
    const vafOk = [nums[0], nums[2]].every((n) => n != null && n >= 1000);
    if (!indicesOk || !vafOk) continue;

    linhas.push({
      codigoMun: codigo,
      municipioNome: nome,
      vafA: numeroBr(valores[0]!),
      indiceA: numeroBr(valores[1]!),
      vafB: numeroBr(valores[2]!),
      indiceB: numeroBr(valores[3]!),
      mediaIndices: numeroBr(valores[4]!),
    });
    i += 6;
  }

  const anoA = anos[0] ?? null;
  const anoB = anos[1] ?? null;

  return {
    resolucao: mResolucao
      ? `${mResolucao[1]!.replace(/\./g, "")}${mResolucao[2] ? `/${mResolucao[2]}` : ""}`
      : null,
    exercicioAplicacao: mExercicio ? Number(mExercicio[1]) : anoB ? anoB + 2 : null,
    anoA,
    anoB,
    linhas,
  };
}

/** Ignora as preposições ("Amparo da Serra" x "Amparo do Serra"). */
function chaveSemConectivos(valor: string): string {
  return chaveNome(valor.replace(/\b(de|do|da|dos|das|d)\b/gi, " "));
}

/**
 * Casa as linhas do anexo com os municípios cadastrados. O código SEF publicado
 * na resolução vale mais que o nome, porque o anexo traz grafias divergentes
 * ("Amparo da Serra", "Barão de Monte Alto"). O nome oficial da tabela da SEF
 * substitui o nome lido, para que a gravação fique padronizada.
 */
export function casarMunicipios(
  linhas: LinhaResolucao[],
  municipios: { id: string; nome: string; codigo_sef?: string | null }[],
): { linha: LinhaResolucao; municipioId: string | null }[] {
  const porCodigo = new Map<string, string>();
  const porNome = new Map<string, string>();
  const semConectivos = new Map<string, string>();
  for (const m of municipios) {
    const codigo = normalizarCodigoSef(m.codigo_sef ?? null);
    if (codigo) porCodigo.set(codigo, m.id);
    porNome.set(chaveNome(m.nome), m.id);
    const chave = chaveSemConectivos(m.nome);
    if (semConectivos.has(chave)) semConectivos.set(chave, "");
    else semConectivos.set(chave, m.id);
  }

  return linhas.map((bruta) => {
    const codigo = normalizarCodigoSef(bruta.codigoMun);
    const nomeOficial = nomeMunicipioSef(bruta.codigoMun);
    const linha: LinhaResolucao = nomeOficial
      ? { ...bruta, municipioNome: nomeOficial }
      : { ...bruta };
    const porNomeOficial = nomeOficial ? porNome.get(chaveNome(nomeOficial)) : undefined;
    const municipioId =
      (codigo ? porCodigo.get(codigo) : undefined) ??
      porNomeOficial ??
      porNome.get(chaveNome(bruta.municipioNome)) ??
      semConectivos.get(chaveSemConectivos(bruta.municipioNome)) ??
      null;
    return { linha, municipioId: municipioId || null };
  });
}
