/**
 * Previsão do repasse de ICMS pelo critério VAF no próximo exercício.
 *
 * Conta oficial: repasse do mês = índice do município (em %) x bolada do VAF
 * do mês (os 75% da transferência líquida rateados pelo VAF). Quando a bolada
 * do Estado está cadastrada, é ela que manda; sem ela, a bolada é deduzida de
 * trás para frente pelo que o município recebeu (valor ÷ índice).
 *
 * Nada aqui altera a apuração do município.
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

/** Participação de cada mês no total, sempre somando 1. */
function pesos(valores: (number | null)[]): number[] {
  const informados = valores.filter((v): v is number => v != null && v > 0);
  if (!informados.length) return MESES.map(() => 1 / 12);
  const media = informados.reduce((a, b) => a + b, 0) / informados.length;
  const completos = valores.map((v) => (v != null && v > 0 ? v : media));
  const total = completos.reduce((a, b) => a + b, 0);
  return completos.map((v) => v / total);
}

/** Participação de cada mês no total do exercício, sempre somando 1. */
export function sazonalidade(serie: MesRepasse[]): number[] {
  return pesos(MESES.map((m) => serie.find((s) => s.mes === m)?.valor ?? null));
}

/** Soma anual de uma série mensal, completando os meses vazios pela média. */
export function totalAnual(valores: (number | null)[]): number | null {
  const informados = valores.filter((v): v is number => v != null && v > 0);
  if (!informados.length) return null;
  const media = informados.reduce((a, b) => a + b, 0) / informados.length;
  return media * 12;
}

export type BaseReceita = "ano_anterior" | "crescimento" | "manual";

export type EntradaPrevisao = {
  serie: MesRepasse[];
  /** índice que o município deve alcançar no próximo exercício */
  indiceProjetado: number | null;
  /** índice aplicado hoje */
  indiceAtual: number | null;
  base: BaseReceita;
  /** percentual de crescimento da arrecadação (opção "crescimento") */
  crescimentoPct?: number;
  /** total anual do critério VAF do município informado à mão (sem bolada cadastrada) */
  receitaManual?: number | null;
  /** bolada estadual do VAF mês a mês (75% da transferência líquida) */
  boladaEstado?: (number | null)[];
  /** bolada anual do Estado informada à mão (opção "manual" com bolada cadastrada) */
  boladaManual?: number | null;
};

export type Previsao = {
  atual: ResumoExercicio;
  /** "estado" quando a bolada cadastrada foi usada; "municipio" no cálculo reverso */
  origem: "estado" | "municipio";
  /** bolada anual do VAF usada na previsão (só na origem "estado") */
  boladaAnual: number | null;
  /** R$ por 1 ponto de índice usado na previsão (12 meses) */
  valorPorPontoAnual: number | null;
  previsaoAnual: number | null;
  /** previsão mês a mês do próximo exercício */
  meses: { mes: number; previsto: number | null; recebido: number | null }[];
  diferenca: number | null;
  variacaoPct: number | null;
  /** variação do índice projetado em relação ao aplicado hoje, em % */
  variacaoIndicePct: number | null;
};

export function calcularPrevisao(entrada: EntradaPrevisao): Previsao {
  const atual = resumirExercicio(entrada.serie);
  const bolada = entrada.boladaEstado ?? [];
  const temBolada = bolada.some((v) => v != null && v > 0);
  const origem: "estado" | "municipio" = temBolada ? "estado" : "municipio";
  const fator = entrada.base === "crescimento" ? 1 + (entrada.crescimentoPct ?? 0) / 100 : 1;

  let boladaAnual: number | null = null;
  let valorPorPontoAnual: number | null = null;
  let previsaoAnual: number | null = null;
  let distribuicao: (number | null)[] = MESES.map(
    (m) => entrada.serie.find((s) => s.mes === m)?.valor ?? null,
  );

  if (origem === "estado") {
    boladaAnual =
      entrada.base === "manual"
        ? (entrada.boladaManual ?? null)
        : ((totalAnual(bolada) ?? 0) * fator || null);
    // o índice do VAF é publicado em percentual
    valorPorPontoAnual = boladaAnual != null ? boladaAnual / 100 : null;
    distribuicao = bolada;
  } else if (entrada.base === "manual") {
    const receita = entrada.receitaManual ?? null;
    valorPorPontoAnual =
      receita != null && entrada.indiceAtual != null && entrada.indiceAtual > 0
        ? receita / entrada.indiceAtual
        : null;
  } else {
    valorPorPontoAnual =
      atual.valorPorPontoAnual != null ? atual.valorPorPontoAnual * fator : null;
  }

  previsaoAnual =
    valorPorPontoAnual != null && entrada.indiceProjetado != null && entrada.indiceProjetado > 0
      ? valorPorPontoAnual * entrada.indiceProjetado
      : null;

  const participacao = pesos(distribuicao);
  const meses = MESES.map((m, i) => ({
    mes: m,
    previsto: previsaoAnual != null ? previsaoAnual * (participacao[i] as number) : null,
    recebido: entrada.serie.find((s) => s.mes === m)?.valor ?? null,
  }));

  const comparavel = atual.projecaoAnual;
  const diferenca = previsaoAnual != null && comparavel != null ? previsaoAnual - comparavel : null;
  const variacaoPct =
    diferenca != null && comparavel != null && comparavel !== 0
      ? (diferenca / comparavel) * 100
      : null;

  const variacaoIndicePct =
    entrada.indiceProjetado != null && entrada.indiceAtual != null && entrada.indiceAtual > 0
      ? (entrada.indiceProjetado / entrada.indiceAtual - 1) * 100
      : null;

  return {
    atual,
    origem,
    boladaAnual,
    valorPorPontoAnual,
    previsaoAnual,
    meses,
    diferenca,
    variacaoPct,
    variacaoIndicePct,
  };
}
