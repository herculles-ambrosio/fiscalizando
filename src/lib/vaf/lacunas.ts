import { anoDaCarga, remessaDaCarga, type CargaEstat } from "@/lib/vaf/estatisticas";

export type Lacuna = {
  ano: number;
  /** Remessas ausentes na sequência (1..maior remessa observada no conjunto). */
  faltantes: number[];
  /** Exercício sem o arquivo 13 (fechamento do ano). */
  semFechamento: boolean;
  /** Exercício com menos remessas do que o exercício mais completo. */
  menosRemessas: boolean;
  remessas: number[];
  /** Gráficos que ficam incompletos por causa dessas lacunas. */
  graficos: string[];
};

/**
 * Compara as apurações consideradas e aponta remessas faltando em cada exercício.
 * A referência é a maior sequência de remessas observada entre os exercícios,
 * porque não há como saber de fora quantos arquivos a SEF já publicou.
 */
export function detectarLacunas(cargas: CargaEstat[]): Lacuna[] {
  const porAno = new Map<number, number[]>();
  for (const c of cargas) {
    const ano = anoDaCarga(c);
    const r = remessaDaCarga(c);
    const lista = porAno.get(ano) ?? [];
    if (r != null) lista.push(r);
    porAno.set(ano, lista);
  }

  const maiorGeral = Math.max(
    0,
    ...[...porAno.values()].map((r) => (r.length ? Math.max(...r) : 0)),
  );

  const lacunas: Lacuna[] = [];
  for (const [ano, remessasBrutas] of [...porAno.entries()].sort((a, b) => b[0] - a[0])) {
    const remessas = [...new Set(remessasBrutas)].sort((a, b) => a - b);
    if (!remessas.length) continue;
    const maiorDoAno = Math.max(...remessas);
    const faltantes: number[] = [];
    for (let i = 1; i <= maiorDoAno; i += 1) if (!remessas.includes(i)) faltantes.push(i);
    const semFechamento = !remessas.includes(13);
    const menosRemessas = maiorGeral > 0 && maiorDoAno < maiorGeral;
    if (!faltantes.length && !semFechamento && !menosRemessas) continue;

    const graficos: string[] = [];
    if (faltantes.length) {
      graficos.push("Maiores contribuintes (soma do exercício)", "Setores e qualidade");
    }
    if (semFechamento || menosRemessas) graficos.push("Comparativo anual");
    if (faltantes.length || menosRemessas) graficos.push("Evolução por remessa");

    lacunas.push({
      ano,
      faltantes,
      semFechamento,
      menosRemessas,
      remessas,
      graficos: [...new Set(graficos)],
    });
  }
  return lacunas;
}

export function descreverLacuna(l: Lacuna): string {
  const partes: string[] = [];
  if (l.faltantes.length) {
    partes.push(
      `falta${l.faltantes.length === 1 ? "" : "m"} o${l.faltantes.length === 1 ? "" : "s"} arquivo${
        l.faltantes.length === 1 ? "" : "s"
      } ${l.faltantes.join(", ")} na sequência`,
    );
  }
  if (l.semFechamento) partes.push("sem o arquivo 13 (fechamento do exercício)");
  if (l.menosRemessas) partes.push("com menos remessas que os demais exercícios");
  return partes.join("; ");
}
