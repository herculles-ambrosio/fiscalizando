import { CRITERIOS_PAINEL, CRITERIO_POR_SLUG, type Criterio } from "./criterios";
import { QUADROS, type ItemPontuavel, type QuadroCriterio } from "./itens";
import { montarDiagnostico, type LinhaDiagnostico } from "./diagnostico";
import type { DadosIcms } from "@/hooks/useIcms";

export type SituacaoItem =
  | "atende"
  | "parcial"
  | "nao_atende"
  | "nao_se_aplica"
  | "nao_avaliado";

export const ROTULO_ITEM: Record<SituacaoItem, string> = {
  atende: "Atende",
  parcial: "Parcial",
  nao_atende: "Não atende",
  nao_se_aplica: "Não se aplica",
  nao_avaliado: "Não avaliado",
};

/** Fração da nota considerada conquistada em cada situação. */
const PESO: Record<SituacaoItem, number> = {
  atende: 1,
  parcial: 0.5,
  nao_atende: 0,
  nao_se_aplica: 0,
  nao_avaliado: 0,
};

export type RegistroChecklist = {
  criterio: string;
  item_codigo: string;
  situacao: SituacaoItem;
  observacao: string | null;
  evidencia: string | null;
  responsavel: string | null;
  prazo: string | null;
};

export type LinhaItemPontuacao = {
  item: ItemPontuavel;
  situacao: SituacaoItem;
  registro: RegistroChecklist | null;
  /** Nota (ou parcela %) que o item ainda pode render. */
  notaPerdida: number;
  /** R$/ano estimados presos neste item. */
  potencial: number;
};

export type BlocoPontuacao = {
  criterio: Criterio;
  quadro: QuadroCriterio;
  linhas: LinhaItemPontuacao[];
  notaObtida: number;
  notaPossivel: number;
  /** 0 a 1 */
  aproveitamento: number;
  valorAno: number;
  /** R$/ano que o critério deveria representar segundo o Anexo I. */
  metaValor: number | null;
  /** R$/ano estimados em jogo no critério inteiro. */
  potencial: number;
  diagnostico: LinhaDiagnostico | null;
  pendentes: number;
  avaliados: number;
};

export type PainelPontuacao = {
  exercicio: number;
  totalAno: number;
  valorPorPontoIndice: number | null;
  blocos: BlocoPontuacao[];
  potencialTotal: number;
  itensPendentes: number;
  itensTotal: number;
};

function pesoDoItem(item: ItemPontuavel, quadro: QuadroCriterio): number {
  if (quadro.tipo === "nota") return item.nota ?? 0;
  return item.parcelaPct ?? 100 / quadro.itens.length;
}

export function montarPontuacao(
  dados: DadosIcms,
  exercicio: number,
  registros: RegistroChecklist[],
): PainelPontuacao {
  const diag = montarDiagnostico(dados, exercicio);
  const porCriterio = new Map(diag.linhas.map((l) => [l.criterio.slug, l]));
  const porChave = new Map(registros.map((r) => [`${r.criterio}|${r.item_codigo}`, r]));

  const blocos: BlocoPontuacao[] = [];

  for (const criterio of CRITERIOS_PAINEL) {
    const quadro = QUADROS[criterio.slug];
    if (!quadro) continue;

    const linhaDiag = porCriterio.get(criterio.slug) ?? null;
    const valorAno = linhaDiag?.valorAno ?? 0;
    // Meta = índice do critério (FJP) x valor do ponto de índice do exercício.
    const metaValor = linhaDiag?.metaValor ?? null;
    const potencialCriterio = linhaDiag?.potencialAnual ?? 0;


    const pesos = quadro.itens.map((i) => pesoDoItem(i, quadro));
    const notaPossivel = pesos.reduce((a, b) => a + b, 0);

    let notaObtida = 0;
    let perdidaTotal = 0;
    const parciais: { peso: number; perdida: number }[] = [];

    quadro.itens.forEach((item, i) => {
      const registro = porChave.get(`${criterio.slug}|${item.codigo}`) ?? null;
      const situacao: SituacaoItem = registro?.situacao ?? "nao_avaliado";
      const peso = pesos[i] ?? 0;
      const aplicavel = situacao !== "nao_se_aplica";
      const obtida = aplicavel ? peso * PESO[situacao] : 0;
      const perdida = aplicavel ? Math.max(0, peso - obtida) : 0;
      if (aplicavel) notaObtida += obtida;
      perdidaTotal += perdida;
      parciais.push({ peso, perdida });
    });

    const denominador = quadro.itens.reduce((a, item, i) => {
      const registro = porChave.get(`${criterio.slug}|${item.codigo}`);
      return (registro?.situacao ?? "nao_avaliado") === "nao_se_aplica" ? a : a + (pesos[i] ?? 0);
    }, 0);

    const linhas: LinhaItemPontuacao[] = quadro.itens.map((item, i) => {
      const registro = porChave.get(`${criterio.slug}|${item.codigo}`) ?? null;
      const situacao: SituacaoItem = registro?.situacao ?? "nao_avaliado";
      const perdida = parciais[i]?.perdida ?? 0;
      const potencial =
        perdidaTotal > 0 ? (perdida / perdidaTotal) * potencialCriterio : 0;
      return { item, situacao, registro, notaPerdida: perdida, potencial };
    });

    blocos.push({
      criterio,
      quadro,
      linhas,
      notaObtida,
      notaPossivel: denominador || notaPossivel,
      aproveitamento: denominador > 0 ? notaObtida / denominador : 0,
      valorAno,
      metaValor,
      potencial: potencialCriterio,
      diagnostico: linhaDiag,
      pendentes: linhas.filter(
        (l) => l.situacao === "nao_atende" || l.situacao === "parcial" || l.situacao === "nao_avaliado",
      ).length,
      avaliados: linhas.filter((l) => l.situacao !== "nao_avaliado").length,
    });
  }

  // Maior dinheiro em jogo primeiro; depois o pior aproveitamento.
  blocos.sort((a, b) => b.potencial - a.potencial || a.aproveitamento - b.aproveitamento);

  return {
    exercicio,
    totalAno: diag.totalAno,
    valorPorPontoIndice: diag.valorPorPontoIndice,
    blocos,
    potencialTotal: blocos.reduce((a, b) => a + b.potencial, 0),
    itensPendentes: blocos.reduce((a, b) => a + b.pendentes, 0),
    itensTotal: blocos.reduce((a, b) => a + b.linhas.length, 0),
  };
}

/** Itens que valem mais dinheiro e ainda não estão atendidos. */
export function maioresOportunidades(painel: PainelPontuacao, limite = 8) {
  return painel.blocos
    .flatMap((b) => b.linhas.map((l) => ({ bloco: b, linha: l })))
    .filter(({ linha }) => linha.situacao !== "atende" && linha.situacao !== "nao_se_aplica")
    .sort((a, b) => b.linha.potencial - a.linha.potencial || b.linha.notaPerdida - a.linha.notaPerdida)
    .slice(0, limite);
}

export function nomeDoCriterio(slug: string): string {
  return CRITERIO_POR_SLUG.get(slug)?.nome ?? slug;
}
