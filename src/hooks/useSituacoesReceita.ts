import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { consultarSituacoesReceita } from "@/lib/receita/cnpj.functions";
import { limparCnpj, type RegistroReceita } from "@/lib/receita/normalizar";

export type MapaReceita = Record<string, RegistroReceita>;

/** Cache local (tabela) das situações cadastrais da Receita Federal por CNPJ. */
export function useSituacoesReceita(cnpjs: (string | null | undefined)[]) {
  const chaves = [...new Set(cnpjs.map(limparCnpj).filter((c): c is string => !!c))].sort();
  return useQuery({
    queryKey: ["situacoes-receita", chaves],
    enabled: chaves.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MapaReceita> => {
      const mapa: MapaReceita = {};
      for (let i = 0; i < chaves.length; i += 200) {
        const lote = chaves.slice(i, i + 200);
        const { data, error } = await supabase
          .from("situacoes_receita")
          .select(
            "cnpj, situacao, situacao_data, motivo, razao_social, nome_fantasia, uf, municipio, cnae_principal, fonte, consultado_em",
          )
          .in("cnpj", lote);
        if (error) throw error;
        for (const linha of data ?? []) mapa[linha.cnpj] = linha as unknown as RegistroReceita;
      }
      return mapa;
    },
  });
}

export function useConsultarReceita() {
  const consultar = useServerFn(consultarSituacoesReceita);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: { cnpjs: (string | null | undefined)[]; forcar?: boolean }) => {
      const cnpjs = [
        ...new Set(entrada.cnpjs.map(limparCnpj).filter((c): c is string => !!c)),
      ];
      return consultar({ data: { cnpjs, forcar: entrada.forcar === true } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["situacoes-receita"] });
    },
  });
}
