/**
 * Agregações puras para o menu de Estatísticas.
 * Trabalha sobre as apurações já gravadas (cargas + contribuintes_apurados),
 * sem novas tabelas nem novos uploads.
 */

import { competenciaOrdenavel, formatarCompetencia } from "@/lib/vaf/tipoRetorno";

export type CargaEstat = {
  id: string;
  exercicio: number;
  tipo_retorno: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  criado_em: string;
};

export type LinhaEstat = {
  carga_id: string;
  inscricao_estadual: string;
  nome: string | null;
  cnpj: string | null;
  cnae: string | null;
  vaf_atual: number | null;
  entregou_declaracao: boolean;
  situacoes: string[];
};

export type Periodo = {
  cargaId: string;
  mes: number | null;
  ano: number;
  ordem: number;
  rotulo: string;
};

export const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--gold)",
  "var(--primary)",
  "var(--omisso-foreground)",
  "var(--prazo-foreground)",
  "var(--discrepante-foreground)",
] as const;

export function corSerie(indice: number): string {
  return PALETA[indice % PALETA.length]!;
}

export function nomeCurto(nome: string | null, ie: string, limite = 26): string {
  const base = (nome ?? "").trim() || `IE ${ie}`;
  return base.length > limite ? `${base.slice(0, limite - 1)}…` : base;
}

/** Ano de referência de uma carga (usa a competência quando existe). */
export function anoDaCarga(c: CargaEstat): number {
  return c.competencia_ano ?? c.exercicio;
}

/**
 * Uma carga por competência: quando a mesma competência foi reprocessada,
 * fica a mais recente. Cargas de índice definitivo vencem as mensais do mesmo mês.
 */
export function deduplicarCargas(cargas: CargaEstat[]): CargaEstat[] {
  const mapa = new Map<string, CargaEstat>();
  for (const c of cargas) {
    const chave = `${anoDaCarga(c)}-${c.competencia_mes ?? "x"}`;
    const atual = mapa.get(chave);
    if (!atual) {
      mapa.set(chave, c);
      continue;
    }
    const prioridade = (x: CargaEstat) => (x.tipo_retorno === "indice_definitivo" ? 1 : 0);
    const melhor =
      prioridade(c) !== prioridade(atual)
        ? prioridade(c) > prioridade(atual)
          ? c
          : atual
        : new Date(c.criado_em) > new Date(atual.criado_em)
          ? c
          : atual;
    mapa.set(chave, melhor);
  }
  return [...mapa.values()];
}

export function periodoDaCarga(c: CargaEstat): Periodo {
  const ano = anoDaCarga(c);
  const mes = c.competencia_mes;
  return {
    cargaId: c.id,
    mes,
    ano,
    ordem: competenciaOrdenavel(mes, ano),
    rotulo: formatarCompetencia(mes, ano) || String(ano),
  };
}

export type Contribuinte = {
  ie: string;
  nome: string | null;
  cnpj: string | null;
  cnae: string | null;
  total: number;
  porPeriodo: Map<string, number>;
};

/** Soma o VAF por contribuinte no conjunto de períodos informado. */
export function agregarPorContribuinte(
  linhas: LinhaEstat[],
  periodoPorCarga: Map<string, Periodo>,
): Contribuinte[] {
  const mapa = new Map<string, Contribuinte>();
  for (const l of linhas) {
    const periodo = periodoPorCarga.get(l.carga_id);
    if (!periodo) continue;
    const vaf = Number(l.vaf_atual ?? 0);
    const atual = mapa.get(l.inscricao_estadual) ?? {
      ie: l.inscricao_estadual,
      nome: l.nome,
      cnpj: l.cnpj,
      cnae: l.cnae,
      total: 0,
      porPeriodo: new Map<string, number>(),
    };
    if (!atual.nome && l.nome) atual.nome = l.nome;
    if (!atual.cnpj && l.cnpj) atual.cnpj = l.cnpj;
    if (!atual.cnae && l.cnae) atual.cnae = l.cnae;
    atual.total += vaf;
    atual.porPeriodo.set(periodo.rotulo, (atual.porPeriodo.get(periodo.rotulo) ?? 0) + vaf);
    mapa.set(l.inscricao_estadual, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** Curva de Pareto: participação acumulada dos contribuintes ordenados por VAF. */
export function curvaPareto(
  contribuintes: Contribuinte[],
  maxPontos = 60,
): { posicao: number; acumulado: number; participacao: number; nome: string; ie: string }[] {
  const total = contribuintes.reduce((s, c) => s + Math.max(c.total, 0), 0);
  if (total <= 0) return [];
  let acumulado = 0;
  const pontos = contribuintes.slice(0, maxPontos).map((c, i) => {
    acumulado += Math.max(c.total, 0);
    return {
      posicao: i + 1,
      acumulado: (acumulado / total) * 100,
      participacao: (Math.max(c.total, 0) / total) * 100,
      nome: nomeCurto(c.nome, c.ie),
      ie: c.ie,
    };
  });
  return pontos;
}

/** Quantos contribuintes são necessários para atingir cada fatia do VAF. */
export function empresasParaAtingir(contribuintes: Contribuinte[], alvoPct: number): number {
  const total = contribuintes.reduce((s, c) => s + Math.max(c.total, 0), 0);
  if (total <= 0) return 0;
  let acumulado = 0;
  for (let i = 0; i < contribuintes.length; i++) {
    acumulado += Math.max(contribuintes[i]!.total, 0);
    if ((acumulado / total) * 100 >= alvoPct) return i + 1;
  }
  return contribuintes.length;
}

export function variacaoPct(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
