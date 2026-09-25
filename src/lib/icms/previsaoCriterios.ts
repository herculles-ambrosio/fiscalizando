/**
 * Previsão do repasse de ICMS por critério no próximo exercício.
 *
 * Cada critério repassa: bolada do critério × índice do município. Como a
 * bolada do critério é a mesma para todos, a previsão parte do que o
 * município recebeu no exercício (anualizado), corrige pelo crescimento da
 * receita e pela variação do índice: previsto = anual × fator × índice novo ÷ índice atual.
 */

export type EntradaCriterio = {
  slug: string;
  nome: string;
  percentual: number | null;
  /** valores recebidos mês a mês no exercício (jan–dez) */
  valores: (number | null)[];
  indiceAtual: number | null;
  indiceProjetado: number | null;
  indiceRecuperacao: number | null;
};

export type LinhaPrevisaoCriterio = EntradaCriterio & {
  mesesComValor: number;
  recebido: number;
  anual: number | null;
  previsto: number | null;
  comRecuperacao: number | null;
  diferenca: number | null;
  variacaoPct: number | null;
  ganho: number | null;
};

function projetar(anual: number, fator: number, atual: number | null, novo: number | null) {
  if (atual != null && atual > 0 && novo != null && novo >= 0) return anual * fator * (novo / atual);
  return anual * fator;
}

export function preverPorCriterio(
  criterios: EntradaCriterio[],
  fator: number,
): { linhas: LinhaPrevisaoCriterio[]; totais: { anual: number; previsto: number; comRecuperacao: number } } {
  const linhas = criterios.map((c) => {
    const com = c.valores.filter((v): v is number => v != null && v > 0);
    const recebido = com.reduce((a, b) => a + b, 0);
    const anual = com.length ? (recebido / com.length) * 12 : null;
    const previsto = anual != null ? projetar(anual, fator, c.indiceAtual, c.indiceProjetado) : null;
    const comRecuperacao =
      anual != null
        ? projetar(anual, fator, c.indiceAtual, c.indiceRecuperacao ?? c.indiceProjetado)
        : null;
    const diferenca = previsto != null && anual != null ? previsto - anual : null;
    return {
      ...c,
      mesesComValor: com.length,
      recebido,
      anual,
      previsto,
      comRecuperacao,
      diferenca,
      variacaoPct: diferenca != null && anual ? (diferenca / anual) * 100 : null,
      ganho: comRecuperacao != null && previsto != null ? comRecuperacao - previsto : null,
    };
  });
  const soma = (k: "anual" | "previsto" | "comRecuperacao") =>
    linhas.reduce((a, l) => a + (l[k] ?? 0), 0);
  return {
    linhas,
    totais: { anual: soma("anual"), previsto: soma("previsto"), comRecuperacao: soma("comRecuperacao") },
  };
}
