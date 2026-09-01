/**
 * Coleta automática dos dados do portal oficial da Lei Robin Hood (FJP).
 *
 * Só roda no servidor. Usa a API pública que alimenta o próprio portal
 * (robin-hood.fjp.mg.gov.br):
 *   GET /api/municipios                                   -> lista de municípios
 *   GET /api/valores/relatorio?municipio_id&ano&categoria_id=1 -> índices por critério/mês
 *   GET /api/valores/relatorio?municipio_id&ano&categoria_id=2 -> valores (R$) por critério/mês
 *
 * A API oscila (a FJP derruba conexões de vez em quando), por isso cada
 * requisição é repetida algumas vezes antes de desistir. Quando nada
 * responde, a importação manual do extrato continua disponível.
 */

import { acharCriterio, normalizarRotulo, MESES } from "./criterios";

export type RegistroColetado = {
  criterio: string;
  mes: number;
  indice: number | null;
  valor: number | null;
};

export type ColetaRobinHood = {
  registros: RegistroColetado[];
  fonte: "portal" | "historico" | null;
  tentativas: string[];
  mesesComDados: number[];
};

const API = "https://robin-hood-config.fjp.mg.gov.br/api";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** GET com JSON e novas tentativas — a API da FJP falha de forma intermitente. */
async function pegarJson<T>(url: string, vezes = 4): Promise<T> {
  let ultimo: unknown = null;
  for (let i = 0; i < vezes; i++) {
    try {
      const resp = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/json, text/plain, */*" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return (await resp.json()) as T;
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("sem resposta");
}

function numeroBr(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== "string") return null;
  const limpo = bruto.replace(/R\$|\s|\u00a0/g, "").trim();
  if (!limpo || !/[0-9]/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Município                                                           */
/* ------------------------------------------------------------------ */

type MunicipioFjp = { id: number; municipio: string; sef: number | null; ibge6: number | null };

async function acharMunicipio(
  nome: string,
  codigoSef: string | null,
  codigoIbge: string | null,
): Promise<MunicipioFjp | null> {
  const lista = await pegarJson<MunicipioFjp[]>(`${API}/municipios`);
  const sef = codigoSef ? Number(String(codigoSef).replace(/\D/g, "")) : NaN;
  if (Number.isFinite(sef) && sef > 0) {
    const porSef = lista.find((m) => Number(m.sef) === sef);
    if (porSef) return porSef;
  }
  const ibge = codigoIbge ? Number(String(codigoIbge).replace(/\D/g, "")) : NaN;
  if (Number.isFinite(ibge) && ibge > 0) {
    const porIbge = lista.find((m) => Number(m.ibge6) === ibge);
    if (porIbge) return porIbge;
  }
  const chave = normalizarRotulo(nome);
  return (
    lista.find((m) => normalizarRotulo(m.municipio) === chave) ??
    lista.find((m) => normalizarRotulo(m.municipio).startsWith(chave)) ??
    null
  );
}

/* ------------------------------------------------------------------ */
/* Relatório (critério x mês)                                          */
/* ------------------------------------------------------------------ */

type Relatorio = { valores?: Record<string, Record<string, string | number | null>> };

const INDICE_MESES = new Map(MESES.map((m, i) => [normalizarRotulo(m), i + 1]));

/** Converte o mapa "critério -> { MÊS: valor }" em registros por critério/mês. */
function lerRelatorio(
  relatorio: Relatorio,
  campo: "indice" | "valor",
  mesesAlvo: Set<number>,
  destino: Map<string, RegistroColetado>,
): number {
  let lidos = 0;
  for (const [rotulo, porMes] of Object.entries(relatorio.valores ?? {})) {
    const criterio = acharCriterio(rotulo);
    if (!criterio || !porMes) continue;
    for (const [rotuloMes, bruto] of Object.entries(porMes)) {
      const mes = INDICE_MESES.get(normalizarRotulo(rotuloMes));
      if (!mes || !mesesAlvo.has(mes)) continue;
      const numero = numeroBr(bruto);
      if (numero == null) continue;
      const chave = `${criterio.slug}|${mes}`;
      const atual = destino.get(chave) ?? {
        criterio: criterio.slug,
        mes,
        indice: null,
        valor: null,
      };
      atual[campo] = numero;
      destino.set(chave, atual);
      lidos++;
    }
  }
  return lidos;
}

/* ------------------------------------------------------------------ */
/* Orquestração                                                        */
/* ------------------------------------------------------------------ */

export async function coletarRobinHood(params: {
  municipio: string;
  codigoIbge?: string | null;
  codigoSef?: string | null;
  exercicio: number;
  meses?: number[];
}): Promise<ColetaRobinHood> {
  const tentativas: string[] = [];
  const mesesAlvo = new Set(
    (params.meses?.length ? params.meses : Array.from({ length: 12 }, (_, i) => i + 1)).filter(
      (m) => m >= 1 && m <= 12,
    ),
  );

  let municipio: MunicipioFjp | null = null;
  try {
    municipio = await acharMunicipio(
      params.municipio,
      params.codigoSef ?? null,
      params.codigoIbge ?? null,
    );
  } catch (e) {
    tentativas.push(`lista de municípios: ${e instanceof Error ? e.message : "sem resposta"}`);
    return { registros: [], fonte: null, tentativas, mesesComDados: [] };
  }
  if (!municipio) {
    tentativas.push(`o portal não tem o município "${params.municipio}" na lista oficial`);
    return { registros: [], fonte: null, tentativas, mesesComDados: [] };
  }

  const destino = new Map<string, RegistroColetado>();
  const base = `${API}/valores/relatorio?municipio_id=${municipio.id}&ano=${params.exercicio}`;

  for (const [categoria, campo] of [
    [1, "indice"],
    [2, "valor"],
  ] as const) {
    try {
      const relatorio = await pegarJson<Relatorio>(`${base}&categoria_id=${categoria}`);
      const lidos = lerRelatorio(relatorio, campo, mesesAlvo, destino);
      tentativas.push(
        `${campo === "indice" ? "índices" : "valores em R$"}: ${lidos} leituras do portal`,
      );
    } catch (e) {
      tentativas.push(
        `${campo === "indice" ? "índices" : "valores em R$"}: ${e instanceof Error ? e.message : "sem resposta"}`,
      );
    }
  }

  const registros = [...destino.values()].sort(
    (a, b) => a.mes - b.mes || a.criterio.localeCompare(b.criterio),
  );

  return {
    registros,
    fonte: registros.length ? "portal" : null,
    tentativas,
    mesesComDados: [...new Set(registros.map((r) => r.mes))].sort((a, b) => a - b),
  };
}
