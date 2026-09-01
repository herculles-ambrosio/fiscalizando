import { CRITERIOS_PAINEL, CRITERIO_POR_SLUG, type Criterio } from "./criterios";
import type { DadosIcms } from "@/hooks/useIcms";

export type SituacaoCriterio = "zerado_oportunidade" | "zerado_estrutural" | "queda" | "alta" | "estavel";

export type LinhaDiagnostico = {
  criterio: Criterio;
  valorAno: number;
  participacao: number;
  indiceAtual: number | null;
  indiceAnterior: number | null;
  variacaoPct: number | null;
  situacao: SituacaoCriterio;
  /** Estimativa de receita anual perdida enquanto o critério estiver zerado. */
  potencialAnual: number | null;
  recomendacoes: string[];
};

export type Diagnostico = {
  exercicio: number;
  totalAno: number;
  indiceParticipacao: number | null;
  /** R$ recebidos no ano por cada 1 ponto (1%) de índice de participação. */
  valorPorPontoIndice: number | null;
  linhas: LinhaDiagnostico[];
  oportunidades: LinhaDiagnostico[];
  quedas: LinhaDiagnostico[];
};

export const ROTULO_SITUACAO: Record<SituacaoCriterio, string> = {
  zerado_oportunidade: "Zerado — oportunidade",
  zerado_estrutural: "Zerado — estrutural",
  queda: "Em queda",
  alta: "Em alta",
  estavel: "Estável",
};

function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function montarDiagnostico(dados: DadosIcms, exercicio: number): Diagnostico {
  const participacao = dados.series.get("indice_participacao");
  const indiceParticipacao = participacao?.ultimoIndice ?? null;
  const valorPorPontoIndice =
    indiceParticipacao && indiceParticipacao > 0 ? dados.totalAno / indiceParticipacao : null;

  const linhas: LinhaDiagnostico[] = CRITERIOS_PAINEL.filter((c) => c.slug !== "indice_participacao").map(
    (criterio) => {
      const serie = dados.series.get(criterio.slug);
      // Meio Ambiente vem consolidado no índice e quebrado no extrato de valores.
      const filhos = [...dados.series.values()].filter(
        (s) => CRITERIO_POR_SLUG.get(s.criterio)?.paiSlug === criterio.slug,
      );
      const valorAno = (serie?.totalValor ?? 0) + filhos.reduce((a, f) => a + f.totalValor, 0);
      const indiceAtual = serie?.ultimoIndice ?? null;
      const indiceAnterior = serie?.indiceAnterior ?? null;
      const variacaoPct =
        indiceAtual != null && indiceAnterior != null && indiceAnterior > 0
          ? ((indiceAtual - indiceAnterior) / indiceAnterior) * 100
          : null;

      const zerado = (indiceAtual == null || indiceAtual === 0) && valorAno === 0;
      let situacao: SituacaoCriterio;
      if (zerado) {
        situacao = criterio.estrutural ? "zerado_estrutural" : "zerado_oportunidade";
      } else if (variacaoPct != null && variacaoPct < -1) {
        situacao = "queda";
      } else if (variacaoPct != null && variacaoPct > 1) {
        situacao = "alta";
      } else {
        situacao = "estavel";
      }

      // Potencial: se o critério é zerado e tem peso conhecido, estimamos o
      // que ele renderia com uma participação equivalente à média do município.
      const potencialAnual =
        situacao === "zerado_oportunidade" && criterio.percentual && valorPorPontoIndice
          ? (criterio.percentual / 100) * valorPorPontoIndice * (indiceParticipacao ?? 0)
          : null;

      return {
        criterio,
        valorAno,
        participacao: dados.totalAno > 0 ? (valorAno / dados.totalAno) * 100 : 0,
        indiceAtual,
        indiceAnterior,
        variacaoPct,
        situacao,
        potencialAnual,
        recomendacoes: criterio.comoMelhorar,
      };
    },
  );

  linhas.sort((a, b) => b.valorAno - a.valorAno);

  return {
    exercicio,
    totalAno: dados.totalAno,
    indiceParticipacao,
    valorPorPontoIndice,
    linhas,
    oportunidades: linhas.filter((l) => l.situacao === "zerado_oportunidade"),
    quedas: linhas.filter((l) => l.situacao === "queda"),
  };
}

/** Média mensal do critério, útil em textos do relatório. */
export function mediaMensal(dados: DadosIcms, slug: string): number | null {
  return media(dados.series.get(slug)?.valores ?? []);
}
