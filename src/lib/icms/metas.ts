import { CRITERIOS_PAINEL, type Criterio } from "./criterios";
import { montarDiagnostico, type OpcoesDiagnostico } from "./diagnostico";
import type { DadosIcms } from "@/hooks/useIcms";

/**
 * Painel de metas do ICMS.
 *
 * A meta de cada critério NÃO é o peso da lei aplicado ao repasse do próprio
 * município. A distribuição acontece em duas etapas: o Estado fatia a
 * cota-parte por critério (Anexo I da Lei 18.030/2009) e cada fatia é
 * redistribuída pelo índice de participação do município NAQUELE critério.
 *
 * Como o sistema analisa um município por vez, bastam dois números:
 *   - o índice do critério para o município (vem da FJP, interno à fatia do
 *     critério — por isso o peso legal do Anexo I é aplicado aqui);
 *   - o valor de 1 ponto de índice do exercício (constante estadual; quando
 *     não informado, é derivado de repasse total / índice de participação).
 *
 *   Meta_critério = índice_do_critério x peso_legal x valor_de_1_ponto_de_índice

 */

export type StatusMeta = "atingida" | "proxima" | "abaixo" | "zerada" | "sem_meta";

export const ROTULO_STATUS_META: Record<StatusMeta, string> = {
  atingida: "Meta atingida",
  proxima: "Perto da meta",
  abaixo: "Abaixo da meta",
  zerada: "Sem pontuação",
  sem_meta: "Sem índice informado",
};

export type LinhaMeta = {
  criterio: Criterio;
  /** percentual do Anexo I da lei, aplicado na meta */
  pesoLegalPct: number | null;
  /** índice de participação do município naquele critério (FJP) */
  indiceCriterio: number | null;
  /** participação real do critério no repasse do município */
  realPct: number;
  /** R$ que o critério deveria render no exercício */
  metaValor: number | null;
  valorAno: number;
  /** quanto falta em R$ (0 quando já atingiu) */
  faltaValor: number;
  /** quanto falta em pontos de índice */
  faltaIndice: number | null;
  /** 0 a 1 — o quanto da meta já foi alcançado */
  cumprimento: number | null;
  status: StatusMeta;
  estrutural: boolean;
  recomendacoes: string[];
};

export type DepuracaoMeta = {
  criterio: string;
  indiceFjp: number | null;
  pesoLegalAplicado: true;
  valorPontoIndice: number | null;
  origemValorPonto: "parametro" | "derivado" | null;
  metaCalculada: number | null;
  recebido: number;
  /** meta / recebido — perto de 1 confirma a fórmula */
  razaoMetaRecebido: number | null;
};

export type PainelMetas = {
  exercicio: number;
  totalAno: number;
  indiceParticipacao: number | null;
  valorPorPontoIndice: number | null;
  origemValorPonto: "parametro" | "derivado" | null;
  linhas: LinhaMeta[];
  /** soma do que falta nos critérios em que cabe ação municipal */
  potencialTotal: number;
  atingidas: number;
  comMeta: number;
  /** conferência do critério VAF (ver README do módulo) */
  depuracao: DepuracaoMeta[];
};

export function montarMetas(
  dados: DadosIcms,
  exercicio: number,
  opcoes: OpcoesDiagnostico = {},
): PainelMetas {
  const diag = montarDiagnostico(dados, exercicio, opcoes);
  const porSlug = new Map(diag.linhas.map((l) => [l.criterio.slug, l]));

  const linhas: LinhaMeta[] = CRITERIOS_PAINEL.filter((c) => c.slug !== "indice_participacao").map(
    (criterio) => {
      const base = porSlug.get(criterio.slug);
      const valorAno = base?.valorAno ?? 0;
      const realPct = diag.totalAno > 0 ? (valorAno / diag.totalAno) * 100 : 0;
      const metaValor = base?.metaValor ?? null;
      const faltaValor = metaValor != null ? Math.max(0, metaValor - valorAno) : 0;
      const cumprimento = metaValor && metaValor > 0 ? Math.min(valorAno / metaValor, 2) : null;
      const faltaIndice =
        diag.valorPorPontoIndice && diag.valorPorPontoIndice > 0
          ? faltaValor / diag.valorPorPontoIndice
          : null;

      let status: StatusMeta;
      if (metaValor == null) status = "sem_meta";
      else if (valorAno <= 0) status = "zerada";
      else if (cumprimento != null && cumprimento >= 1) status = "atingida";
      else if (cumprimento != null && cumprimento >= 0.8) status = "proxima";
      else status = "abaixo";

      return {
        criterio,
        pesoLegalPct: criterio.percentual,
        indiceCriterio: base?.indiceAtual ?? null,
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

  linhas.sort((a, b) => b.faltaValor - a.faltaValor || (b.metaValor ?? 0) - (a.metaValor ?? 0));

  const comMeta = linhas.filter((l) => l.metaValor != null).length;

  const depuracao: DepuracaoMeta[] = linhas.map((l) => ({
    criterio: l.criterio.nome,
    indiceFjp: l.indiceCriterio,
    pesoLegalAplicado: true as const,
    valorPontoIndice: diag.valorPorPontoIndice,
    origemValorPonto: diag.origemValorPonto,
    metaCalculada: l.metaValor,
    recebido: l.valorAno,
    razaoMetaRecebido: l.metaValor != null && l.valorAno > 0 ? l.metaValor / l.valorAno : null,
  }));

  return {
    exercicio,
    totalAno: diag.totalAno,
    indiceParticipacao: diag.indiceParticipacao,
    valorPorPontoIndice: diag.valorPorPontoIndice,
    origemValorPonto: diag.origemValorPonto,
    linhas,
    potencialTotal: linhas
      .filter((l) => !l.estrutural)
      .reduce((soma, l) => soma + l.faltaValor, 0),
    atingidas: linhas.filter((l) => l.status === "atingida").length,
    comMeta,
    depuracao,
  };
}
