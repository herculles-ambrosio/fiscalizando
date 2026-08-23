/**
 * Agregações puras para o menu de Estatísticas.
 * Trabalha sobre as apurações já gravadas (cargas + contribuintes_apurados),
 * sem novas tabelas nem novos uploads.
 */


export type CargaEstat = {
  id: string;
  exercicio: number;
  tipo_retorno: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  mes_referencia?: number | null;
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

/**
 * Ano de referência de uma carga: sempre o EXERCÍCIO da apuração.
 * O ano gravado na competência é o ano de geração do arquivo enviado pela SEF
 * (ex.: arquivo 13/2026 é do exercício 2025), então não serve de eixo temporal.
 */
export function anoDaCarga(c: CargaEstat): number {
  return c.exercicio ?? c.competencia_ano ?? 0;
}

/** Número da remessa (arquivo mensal) dentro do exercício; null no índice definitivo. */
export function remessaDaCarga(c: CargaEstat): number | null {
  if (c.tipo_retorno === "indice_definitivo") return null;
  return c.competencia_mes ?? c.mes_referencia ?? null;
}

/**
 * Uma carga por exercício + número de arquivo: quando a mesma remessa foi
 * reprocessada, fica a mais recente. O índice definitivo vence a mensal equivalente.
 */
export function deduplicarCargas(cargas: CargaEstat[]): CargaEstat[] {
  const mapa = new Map<string, CargaEstat>();
  for (const c of cargas) {
    const chave = `${anoDaCarga(c)}-${remessaDaCarga(c) ?? "def"}`;
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
  const mes = remessaDaCarga(c);
  return {
    cargaId: c.id,
    mes,
    ano,
    ordem: ano * 100 + (mes ?? 99),
    rotulo: mes ? `Arquivo ${mes} · ${ano}` : `Definitivo · ${ano}`,
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

/**
 * VAF que compõe o índice: valores negativos não entram, exatamente como na
 * apuração do índice (Análise do VAF). Mantém os indicadores coerentes entre
 * os dois módulos e impede participações acima de 100%.
 */
export function vafComposto(linha: { vaf_atual: number | null }): number {
  return Math.max(Number(linha.vaf_atual ?? 0), 0);
}

/** Soma o VAF por contribuinte no conjunto de períodos informado. */
export function agregarPorContribuinte(
  linhas: LinhaEstat[],
  periodoPorCarga: Map<string, Periodo>,
): Contribuinte[] {
  const mapa = new Map<string, Contribuinte>();
  for (const l of linhas) {
    const periodo = periodoPorCarga.get(l.carga_id);
    if (!periodo) continue;
    const vaf = vafComposto(l);
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

/**
 * Cargas que representam um exercício: quando existe apuração de índice
 * definitivo naquele exercício, ela é a fonte oficial e substitui as remessas
 * mensais. Sem definitivo, vale apenas a remessa mais recente do exercício,
 * porque cada remessa traz o acumulado do ano (somar 12 + 13 duplicaria o VAF).
 */
export type FonteExercicio = "definitiva" | "mensais";

/** Remessa mensal vencedora do exercício: maior número de arquivo; empate pelo upload mais novo. */
export function remessaVencedora(mensais: CargaEstat[]): CargaEstat | null {
  if (!mensais.length) return null;
  return [...mensais].sort((a, b) => {
    const ra = remessaDaCarga(a) ?? 0;
    const rb = remessaDaCarga(b) ?? 0;
    if (ra !== rb) return rb - ra;
    return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
  })[0]!;
}

export function cargasDoExercicio(
  cargas: CargaEstat[],
  ano: number,
  fonte: FonteExercicio = "definitiva",
): CargaEstat[] {
  const doAno = cargas.filter((c) => anoDaCarga(c) === ano);
  const mensais = doAno.filter((c) => c.tipo_retorno !== "indice_definitivo");
  const definitivas = doAno.filter((c) => c.tipo_retorno === "indice_definitivo");
  if (fonte === "mensais") {
    const vencedora = remessaVencedora(mensais);
    return vencedora ? [vencedora] : definitivas;
  }
  if (definitivas.length) return definitivas;
  const vencedora = remessaVencedora(mensais);
  return vencedora ? [vencedora] : doAno;
}

/** Remessas do exercício que foram substituídas pela fonte vigente. */
export function cargasSubstituidas(
  cargas: CargaEstat[],
  ano: number,
  fonte: FonteExercicio = "definitiva",
): CargaEstat[] {
  const usadas = new Set(cargasDoExercicio(cargas, ano, fonte).map((c) => c.id));
  return cargas.filter((c) => anoDaCarga(c) === ano && !usadas.has(c.id));
}
