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

/** Cada chamada ao servidor aceita no máximo 300 CNPJs (limite do handler). */
const LOTE_CONSULTA = 300;
/** Teto por clique, para o navegador não ficar minutos preso numa fila enorme. */
const MAX_POR_CLIQUE = 3000;

export function useConsultarReceita() {
  const consultar = useServerFn(consultarSituacoesReceita);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entrada: { cnpjs: (string | null | undefined)[]; forcar?: boolean }) => {
      const todos = [...new Set(entrada.cnpjs.map(limparCnpj).filter((c): c is string => !!c))];
      const alvo = todos.slice(0, MAX_POR_CLIQUE);
      const restantes = todos.length - alvo.length;
      const total = {
        atualizados: 0,
        cache: 0,
        falhas: [] as string[],
        naoEncontrados: [] as string[],
        restantes,
      };
      // O servidor trunca em 300 por chamada: processamos em lotes sequenciais
      // para não descartar CNPJs silenciosamente.
      for (let i = 0; i < alvo.length; i += LOTE_CONSULTA) {
        const lote = alvo.slice(i, i + LOTE_CONSULTA);
        const r = await consultar({ data: { cnpjs: lote, forcar: entrada.forcar === true } });
        total.atualizados += r.atualizados;
        total.cache += r.cache;
        total.falhas.push(...(r.falhas ?? []));
        total.naoEncontrados.push(...(r.naoEncontrados ?? []));
        if (i + LOTE_CONSULTA < alvo.length) {
          void queryClient.invalidateQueries({ queryKey: ["situacoes-receita"] });
        }
      }
      return total;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["situacoes-receita"] });
    },
  });
}

