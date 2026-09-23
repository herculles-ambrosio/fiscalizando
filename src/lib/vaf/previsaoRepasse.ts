/**
 * Previsão do repasse de ICMS pelo critério VAF no próximo exercício.
 *
 * Nada aqui altera a apuração do município: são apenas contas sobre o que já
 * está gravado (série mensal da FJP e índices apurados).
 */

export type MesRepasse = {
  /** 1 = janeiro */
  mes: number;
  indice: number | null;
  valor: number | null;
};

export type ResumoExercicio = {
  /** meses que já têm valor recebido */
  mesesComValor: number[];
  /** soma do que já entrou no exercício */
  recebido: number;
  /** média mensal do que já entrou */
  mediaMensal: number | null;
  /** projeção do ano fechado (recebido + meses restantes pela média) */
  projecaoAnual: number | null;
  /** média de R$ por 1 ponto de índice, por mês */
  valorPorPontoMensal: number | null;
  /** R$ por 1 ponto de índice em 12 meses */
  valorPorPontoAnual: number | null;
  /** último índice informado na série */
  ultimoIndice: number | null;
};

const MESES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function resumirExercicio(serie: MesRepasse[]): ResumoExercicio {
  const comValor = serie.filter((m) => m.valor != null && m.valor > 0);
  const recebido = comValor.reduce((a, m) => a + (m.valor as number), 0);
  const mediaMensal = comValor.length ? recebido / comValor.length : null;
  const projecaoAnual = mediaMensal != null ? mediaMensal * 12 : null;

  const pontos = serie
    .filter((m) => m.valor != null && m.valor > 0 && m.indice != null && m.indice > 0)
    .map((m) => (m.valor as number) / (m.indice as number));
  const valorPorPontoMensal = pontos.length
    ? pontos.reduce((a, b) => a + b, 0) / pontos.length
    : null;

  const indices = serie.filter((m) => m.indice != null && m.indice > 0).map((m) => m.indice!);

  return {
    mesesComValor: comValor.map((m) => m.mes),
    recebido,
    mediaMensal,
    projecaoAnual,
    valorPorPontoMensal,
    valorPorPontoAnual: valorPorPontoMensal != null ? valorPorPontoMensal * 12 : null,
    ultimoIndice: indices.at(-1) ?? null,
  };
}

/** Participação de cada mês no total do exercício, sempre somando 1. */
export function sazonalidade(serie: MesRepasse[]): number[] {
  const valores = MESES.map((m) => {
    const linha = serie.find((s) => s.mes === m);
    return linha?.valor != null && linha.valor > 0 ? linha.valor : null;
  });
  const informados = valores.filter((v): v is number => v != null);
  if (!informados.length) return MESES.map(() => 1 / 12);
  const media = informados.reduce((a, b) => a + b, 0) / informados.length;
  const completos = valores.map((v) => v ?? media);
  const total = completos.reduce((a, b) => a + b, 0);
  return completos.map((v) => v / total);
}

export type BaseReceita = "ano_anterior" | "crescimento" | "manual";

export type EntradaPrevisao = {
  serie: MesRepasse[];
  /** índice que o município deve alcançar no próximo exercício */
  indiceProjetado: number | null;
  /** índice aplicado hoje (usado na opção manual) */
  indiceAtual: number | null;
  base: BaseReceita;
  /** percentual de crescimento da arrecadação (opção "crescimento") */
  crescimentoPct?: number;
  /** total anual do critério VAF informado à mão (opção "manual") */
  receitaManual?: number | null;
};

export type Previsao = {
  atual: ResumoExercicio;
  /** R$ por 1 ponto de índice usado na previsão (12 meses) */
  valorPorPontoAnual: number | null;
  previsaoAnual: number | null;
  /** previsão mês a mês do próximo exercício */
  meses: { mes: number; previsto: number | null; recebido: number | null }[];
  diferenca: number | null;
  variacaoPct: number | null;
};

export function calcularPrevisao(entrada: EntradaPrevisao): Previsao {
  const atual = resumirExercicio(entrada.serie);

  let valorPorPontoAnual: number | null = null;
  if (entrada.base === "manual") {
    const receita = entrada.receitaManual ?? null;
    valorPorPontoAnual =
      receita != null && entrada.indiceAtual != null && entrada.indiceAtual > 0
        ? receita / entrada.indiceAtual
        : null;
  } else {
    const fator = entrada.base === "crescimento" ? 1 + (entrada.crescimentoPct ?? 0) / 100 : 1;
    valorPorPontoAnual =
      atual.valorPorPontoAnual != null ? atual.valorPorPontoAnual * fator : null;
  }

  const previsaoAnual =
    valorPorPontoAnual != null && entrada.indiceProjetado != null && entrada.indiceProjetado > 0
      ? valorPorPontoAnual * entrada.indiceProjetado
      : null;

  const pesos = sazonalidade(entrada.serie);
  const meses = MESES.map((m, i) => ({
    mes: m,
    previsto: previsaoAnual != null ? previsaoAnual * (pesos[i] as number) : null,
    recebido: entrada.serie.find((s) => s.mes === m)?.valor ?? null,
  }));

  const comparavel = atual.projecaoAnual;
  const diferenca = previsaoAnual != null && comparavel != null ? previsaoAnual - comparavel : null;
  const variacaoPct =
    diferenca != null && comparavel != null && comparavel !== 0
      ? (diferenca / comparavel) * 100
      : null;

  return { atual, valorPorPontoAnual, previsaoAnual, meses, diferenca, variacaoPct };
}
