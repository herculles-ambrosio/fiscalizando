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
  /**
   * Meta do critério = índice do próprio critério (FJP) x valor de 1 ponto de
   * índice do exercício. Nunca peso da lei x repasse do município.
   */
  metaValor: number | null;
  /** Quanto falta para a meta do critério (R$/ano). */
  potencialAnual: number | null;
  recomendacoes: string[];
};

export type OpcoesDiagnostico = {
  /** Valor de 1 ponto de índice do exercício (constante estadual). */
  valorPontoIndice?: number | null;
};

export type Diagnostico = {
  exercicio: number;
  totalAno: number;
  indiceParticipacao: number | null;
  /** R$ do exercício por cada 1 ponto (1%) de índice de participação. */
  valorPorPontoIndice: number | null;
  /** "parametro" quando informado manualmente, "derivado" quando calculado. */
  origemValorPonto: "parametro" | "derivado" | null;
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

export function montarDiagnostico(
  dados: DadosIcms,
  exercicio: number,
  opcoes: OpcoesDiagnostico = {},
): Diagnostico {
  const participacao = dados.series.get("indice_participacao");
  const indiceParticipacao = participacao?.ultimoIndice ?? null;
  const derivado =
    indiceParticipacao && indiceParticipacao > 0 ? dados.totalAno / indiceParticipacao : null;
  const informado =
    opcoes.valorPontoIndice && opcoes.valorPontoIndice > 0 ? opcoes.valorPontoIndice : null;
  const valorPorPontoIndice = informado ?? derivado;
  const origemValorPonto = valorPorPontoIndice == null ? null : informado ? "parametro" : "derivado";

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

      // Meta = índice do critério (FJP) x peso legal do Anexo I x valor de 1
      // ponto de índice do exercício. Conferido com dados reais: o índice da
      // FJP é interno à fatia do critério, por isso o peso legal se aplica.
      const peso = criterio.percentual != null ? criterio.percentual / 100 : null;
      const metaValor =
        indiceAtual != null && valorPorPontoIndice != null && peso != null
          ? indiceAtual * peso * valorPorPontoIndice
          : null;
      const potencialAnual = metaValor != null ? Math.max(0, metaValor - valorAno) : null;


      return {
        criterio,
        valorAno,
        participacao: dados.totalAno > 0 ? (valorAno / dados.totalAno) * 100 : 0,
        indiceAtual,
        indiceAnterior,
        variacaoPct,
        situacao,
        metaValor,
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
    origemValorPonto,
    linhas,
    oportunidades: linhas.filter((l) => l.situacao === "zerado_oportunidade"),
    quedas: linhas.filter((l) => l.situacao === "queda"),
  };
}


/** Média mensal do critério, útil em textos do relatório. */
export function mediaMensal(dados: DadosIcms, slug: string): number | null {
  return media(dados.series.get(slug)?.valores ?? []);
}
