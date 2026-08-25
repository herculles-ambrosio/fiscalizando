import { useMemo } from "react";
import { toast } from "sonner";
import { useCadastroContribuintes } from "@/hooks/useCadastroContribuintes";
import { useConsultarReceita, useSituacoesReceita } from "@/hooks/useSituacoesReceita";
import { useFilaReceita } from "@/hooks/useFilaReceita";
import { limparCnpj, type RegistroReceita } from "@/lib/receita/normalizar";
import { chaveIeReceita, rotuloSituacao, type MapaReceitaPorIe } from "@/lib/receita/porIe";

export type EntradaIe = { inscricao_estadual: string; cnpj?: string | null };

/**
 * Situação cadastral na Receita Federal indexada por inscrição estadual.
 * O CNPJ vem do próprio registro (quando existe) ou do cadastro já apurado
 * do município. Leitura do cache em `situacoes_receita`; consulta manual.
 */
export function useReceitaPorIe(
  municipioId: string | null | undefined,
  entradas: EntradaIe[],
) {
  const { data: cadastro } = useCadastroContribuintes(municipioId);

  const cnpjPorIe = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const e of entradas) {
      const k = chaveIeReceita(e.inscricao_estadual);
      if (!k || mapa[k]) continue;
      const cnpj = limparCnpj(e.cnpj) ?? limparCnpj(cadastro?.[k]?.cnpj);
      if (cnpj) mapa[k] = cnpj;
    }
    return mapa;
  }, [entradas, cadastro]);

  const cnpjs = useMemo(() => [...new Set(Object.values(cnpjPorIe))], [cnpjPorIe]);
  const { data: situacoes } = useSituacoesReceita(cnpjs);
  const consulta = useConsultarReceita();
  const fila = useFilaReceita(cnpjs);


  const registroPorIe = useMemo(() => {
    const mapa: Record<string, RegistroReceita | undefined> = {};
    for (const [ie, cnpj] of Object.entries(cnpjPorIe)) mapa[ie] = situacoes?.[cnpj];
    return mapa;
  }, [cnpjPorIe, situacoes]);

  const rotulosPorIe = useMemo<MapaReceitaPorIe>(() => {
    const mapa: MapaReceitaPorIe = {};
    for (const [ie, reg] of Object.entries(registroPorIe)) {
      if (reg) mapa[ie] = rotuloSituacao(reg.situacao);
    }
    return mapa;
  }, [registroPorIe]);

  const totalIes = useMemo(
    () => new Set(entradas.map((e) => chaveIeReceita(e.inscricao_estadual)).filter(Boolean)).size,
    [entradas],
  );
  const semCnpj = Math.max(0, totalIes - Object.keys(cnpjPorIe).length);
  const consultados = Object.values(registroPorIe).filter(Boolean).length;
  const pendentes = Math.max(0, Object.keys(cnpjPorIe).length - consultados);

  const registroDe = (ie: string | null | undefined) => registroPorIe[chaveIeReceita(ie)];
  const cnpjDe = (ie: string | null | undefined) => cnpjPorIe[chaveIeReceita(ie)] ?? null;

  const consultar = (forcar = false) => {
    if (!cnpjs.length) {
      toast.error("Nenhum CNPJ disponível para consulta nesta lista.");
      return;
    }
    consulta.mutate(
      { cnpjs, forcar },
      {
        onSuccess: (r) => {
          const partes = [
            `${r.atualizados} consultado(s)`,
            `${r.cache} em cache`,
            ...(semCnpj ? [`${semCnpj} sem CNPJ`] : []),
            ...(r.naoEncontrados?.length
              ? [`${r.naoEncontrados.length} fora das bases públicas`]
              : []),
            ...(r.falhas.length ? [`${r.falhas.length} sem resposta (tente de novo)`] : []),
          ];
          toast.success(`Receita Federal: ${partes.join(" · ")}.`);

        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Falha ao consultar a Receita Federal."),
      },
    );
  };

  return {
    rotulosPorIe,
    registroDe,
    cnpjDe,
    consultar,
    consultando: consulta.isPending,
    totalCnpjs: cnpjs.length,
    semCnpj,
    consultados,
    pendentes,
    semResposta: fila.total,
    reconsultarFalhas: () => {
      fila.reconsultar(undefined, {
        onSuccess: (r: {
          atualizados: number;
          naoEncontrados: number;
          falhas: number;
          restantes: number;
        }) =>
          toast.success(
            `Reconsulta: ${r.atualizados} atualizado(s) · ${r.naoEncontrados} fora das bases · ${r.falhas} ainda sem resposta (na fila automática).`,
          ),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Falha ao reconsultar a Receita Federal."),
      });
    },
    reconsultando: fila.reconsultando,
  };
}
