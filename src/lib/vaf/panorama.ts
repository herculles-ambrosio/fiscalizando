/**
 * Regras puras do panorama de municípios: qual apuração representa cada
 * exercício e como comparar o ano-base com o período escolhido.
 */

import type {
  AcaoPanorama,
  ImpugnacaoPanorama,
  IndicePanorama,
  OficioPanorama,
} from "@/hooks/usePanoramaMunicipios";

export type TipoAlvo = "provisorio" | "definitivo";

/** Entre apurações equivalentes vence a maior remessa; empate pelo upload mais novo. */
export function melhorApuracao(lista: IndicePanorama[]): IndicePanorama | null {
  if (!lista.length) return null;
  return [...lista].sort((a, b) => {
    const ma = a.competencia_mes ?? 0;
    const mb = b.competencia_mes ?? 0;
    if (ma !== mb) return mb - ma;
    return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
  })[0]!;
}

/** Apuração que representa o ano-base: a definitiva, quando existir. */
export function apuracaoBase(indices: IndicePanorama[], exercicio: number): IndicePanorama | null {
  const doAno = indices.filter((i) => i.exercicio === exercicio);
  const definitiva = melhorApuracao(doAno.filter((i) => i.tipo_indice === "definitivo"));
  return definitiva ?? melhorApuracao(doAno);
}

export function apuracaoAlvo(
  indices: IndicePanorama[],
  exercicio: number,
  tipo: TipoAlvo,
  remessa: number | null,
): IndicePanorama | null {
  const candidatas = indices.filter(
    (i) =>
      i.exercicio === exercicio &&
      i.tipo_indice === tipo &&
      (remessa == null || i.competencia_mes === remessa),
  );
  return melhorApuracao(candidatas);
}

export type Situacao = "subiu" | "caiu" | "estavel" | "sem_apuracao";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  subiu: "Subiu",
  caiu: "Caiu",
  estavel: "Estável",
  sem_apuracao: "Sem apuração",
};

/** Abaixo de 0,5% de diferença o movimento é tratado como estabilidade. */
export function classificar(variacaoPct: number | null): Situacao {
  if (variacaoPct == null) return "sem_apuracao";
  if (variacaoPct > 0.5) return "subiu";
  if (variacaoPct < -0.5) return "caiu";
  return "estavel";
}

export type Providencias = {
  acoes: number;
  acoesOficio: number;
  acoesConcluidas: number;
  valorRecuperavel: number;
  impugnacoes: ImpugnacaoPanorama[];
  oficios: number;
  /** Ações do plano do exercício comparado, uma por contribuinte. */
  acoesDetalhe: AcaoPanorama[];
};

export type LinhaPanorama = {
  municipioId: string;
  nome: string;
  base: IndicePanorama | null;
  alvo: IndicePanorama | null;
  /** Diferença absoluta entre os índices (em pontos de índice). */
  pontos: number | null;
  /** Variação relativa do índice, em %. */
  variacao: number | null;
  situacao: Situacao;
  providencias: Providencias;
};

/** Índices publicados em resolução da SEF-MG, usados por prefeituras não clientes. */
export type ResolucaoPanorama = {
  municipio_id: string | null;
  resolucao: string;
  ano_a: number;
  indice_a: number | null;
  ano_b: number;
  indice_b: number | null;
  media_indices: number | null;
};

function indiceDaResolucao(
  linhas: ResolucaoPanorama[],
  municipioId: string,
  exercicio: number,
  tipo: TipoAlvo,
): IndicePanorama | null {
  for (const r of linhas.filter((l) => l.municipio_id === municipioId)) {
    const indice =
      r.ano_a === exercicio ? r.indice_a : r.ano_b === exercicio ? r.indice_b : null;
    if (indice == null) continue;
    return {
      id: `resolucao-${r.resolucao}-${municipioId}-${exercicio}`,
      municipio_id: municipioId,
      exercicio,
      tipo_indice: tipo,
      competencia_mes: null,
      competencia_ano: null,
      estimado: false,
      indice: Number(indice),
      valor_liquido: 0,
      vaf_proprio: 0,
      credito_externo: 0,
      credito_interno: 0,
      credito_proprio: 0,
      debito: 0,
      vaf_estadual: 0,
      arquivo_nome: `Resolução SEF ${r.resolucao}`,
      criado_em: new Date(0).toISOString(),
    };
  }
  return null;
}

export function montarPanorama(params: {
  municipios: { id: string; nome: string; cliente?: boolean; fonte_indice?: string }[];
  indices: IndicePanorama[];
  acoes: AcaoPanorama[];
  impugnacoes: ImpugnacaoPanorama[];
  oficios: OficioPanorama[];
  resolucao?: ResolucaoPanorama[];
  anoBase: number;
  anoAlvo: number;
  tipo: TipoAlvo;
  remessa: number | null;
}): LinhaPanorama[] {
  const {
    municipios,
    indices,
    acoes,
    impugnacoes,
    oficios,
    resolucao = [],
    anoBase,
    anoAlvo,
    tipo,
    remessa,
  } = params;

  return municipios.map((m) => {
    const doMunicipio = indices.filter((i) => i.municipio_id === m.id);
    // prefeituras que não são clientes podem usar os índices publicados em resolução
    const usaResolucao = m.cliente === false && m.fonte_indice === "resolucao";
    const base =
      apuracaoBase(doMunicipio, anoBase) ??
      (usaResolucao ? indiceDaResolucao(resolucao, m.id, anoBase, "definitivo") : null);
    const alvo =
      apuracaoAlvo(doMunicipio, anoAlvo, tipo, remessa) ??
      (usaResolucao ? indiceDaResolucao(resolucao, m.id, anoAlvo, tipo) : null);

    const iBase = base ? Number(base.indice) : null;
    const iAlvo = alvo ? Number(alvo.indice) : null;
    const pontos = iBase != null && iAlvo != null ? iAlvo - iBase : null;
    const variacao = iBase != null && iAlvo != null && iBase !== 0 ? (pontos! / iBase) * 100 : null;

    const acoesMun = acoes.filter((a) => a.municipio_id === m.id && a.exercicio === anoAlvo);
    const providencias: Providencias = {
      acoes: acoesMun.length,
      acoesOficio: acoesMun.filter((a) => a.status === "oficio_enviado").length,
      acoesConcluidas: acoesMun.filter((a) => a.status === "concluida").length,
      valorRecuperavel: acoesMun
        .filter((a) => a.status !== "sem_efeito" && a.status !== "concluida")
        .reduce((s, a) => s + Number(a.valor_recuperavel ?? 0), 0),
      impugnacoes: impugnacoes.filter((i) => i.municipio_id === m.id && i.exercicio === anoAlvo),
      oficios: oficios.filter((o) => o.municipio_id === m.id && o.exercicio === anoAlvo).length,
      acoesDetalhe: acoesMun,
    };

    return {
      municipioId: m.id,
      nome: m.nome,
      base,
      alvo,
      pontos,
      variacao,
      situacao: classificar(variacao),
      providencias,
    };
  });
}
