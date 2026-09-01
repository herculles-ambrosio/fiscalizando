import { CRITERIOS_PAINEL, type Criterio } from "./criterios";
import { montarDiagnostico } from "./diagnostico";
import type { DadosIcms } from "@/hooks/useIcms";

/**
 * Painel de metas: compara a composição do repasse recebido pelo município
 * com os percentuais que a Lei 18.030/2009 destina a cada critério.
 *
 * A leitura é: se o município pontuasse em todos os critérios na mesma
 * proporção em que participa do conjunto, cada critério deveria representar
 * o percentual da lei dentro do que ele recebe. O que falta para chegar lá é
 * a meta — em reais e em pontos de índice.
 */

export type StatusMeta = "atingida" | "proxima" | "abaixo" | "zerada" | "sem_meta";

export const ROTULO_STATUS_META: Record<StatusMeta, string> = {
  atingida: "Meta atingida",
  proxima: "Perto da meta",
  abaixo: "Abaixo da meta",
  zerada: "Sem pontuação",
  sem_meta: "Sem percentual na lei",
};

export type LinhaMeta = {
  criterio: Criterio;
  /** percentual da lei (Anexo I) */
  metaPct: number | null;
  /** participação real do critério no repasse do município */
  realPct: number;
  /** R$ que o critério deveria representar no exercício */
  metaValor: number | null;
  valorAno: number;
  /** quanto falta em R$ (0 quando já atingiu) */
  faltaValor: number;
  /** quanto falta em pontos de índice de participação */
  faltaIndice: number | null;
  /** 0 a 1 — o quanto da meta já foi alcançado */
  cumprimento: number | null;
  status: StatusMeta;
  estrutural: boolean;
  recomendacoes: string[];
};

export type PainelMetas = {
  exercicio: number;
  totalAno: number;
  indiceParticipacao: number | null;
  valorPorPontoIndice: number | null;
  linhas: LinhaMeta[];
  /** soma do que falta nos critérios em que cabe ação municipal */
  potencialTotal: number;
  atingidas: number;
  comMeta: number;
};

export function montarMetas(dados: DadosIcms, exercicio: number): PainelMetas {
  const diag = montarDiagnostico(dados, exercicio);
  const porSlug = new Map(diag.linhas.map((l) => [l.criterio.slug, l]));

  const linhas: LinhaMeta[] = CRITERIOS_PAINEL.filter((c) => c.slug !== "indice_participacao").map(
    (criterio) => {
      const base = porSlug.get(criterio.slug);
      const valorAno = base?.valorAno ?? 0;
      const realPct = diag.totalAno > 0 ? (valorAno / diag.totalAno) * 100 : 0;
      const metaPct = criterio.percentual;
      const metaValor = metaPct != null ? (metaPct / 100) * diag.totalAno : null;
      const faltaValor = metaValor != null ? Math.max(0, metaValor - valorAno) : 0;
      const cumprimento = metaValor && metaValor > 0 ? Math.min(valorAno / metaValor, 2) : null;
      const faltaIndice =
        diag.valorPorPontoIndice && diag.valorPorPontoIndice > 0
          ? faltaValor / diag.valorPorPontoIndice
          : null;

      let status: StatusMeta;
      if (metaPct == null) status = "sem_meta";
      else if (valorAno <= 0) status = "zerada";
      else if (cumprimento != null && cumprimento >= 1) status = "atingida";
      else if (cumprimento != null && cumprimento >= 0.8) status = "proxima";
      else status = "abaixo";

      return {
        criterio,
        metaPct,
        realPct,
        metaValor,
        valorAno,
        faltaValor,
        faltaIndice,
        cumprimento,
        status,
        estrutural: !!criterio.estrutural,
        recomendacoes: criterio.comoMelhorar,
      };
    },
  );

  linhas.sort((a, b) => b.faltaValor - a.faltaValor || (b.metaPct ?? 0) - (a.metaPct ?? 0));

  const comMeta = linhas.filter((l) => l.metaPct != null).length;

  return {
    exercicio,
    totalAno: diag.totalAno,
    indiceParticipacao: diag.indiceParticipacao,
    valorPorPontoIndice: diag.valorPorPontoIndice,
    linhas,
    potencialTotal: linhas
      .filter((l) => !l.estrutural)
      .reduce((soma, l) => soma + l.faltaValor, 0),
    atingidas: linhas.filter((l) => l.status === "atingida").length,
    comMeta,
  };
}
