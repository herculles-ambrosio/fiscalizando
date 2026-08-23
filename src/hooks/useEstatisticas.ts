import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CargaEstat, LinhaEstat } from "@/lib/vaf/estatisticas";

/** Limite de linhas por resposta da API; páginas maiores voltariam truncadas. */
const PAGINA = 1000;

/** Cargas concluídas do município, da mais recente para a mais antiga. */
export function useCargasEstatisticas(municipioId: string | null) {
  return useQuery({
    queryKey: ["estatisticas-cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<CargaEstat[]> => {
      const { data, error } = await supabase
        .from("cargas")
        .select("id, exercicio, tipo_retorno, competencia_mes, competencia_ano, mes_referencia, criado_em")
        .eq("municipio_id", municipioId!)
        .eq("status", "concluida")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CargaEstat[];
    },
  });
}

/** Contribuintes das cargas informadas (paginado para não estourar o limite da API). */
export function useLinhasEstatisticas(municipioId: string | null, cargaIds: string[]) {
  const chave = [...cargaIds].sort().join(",");
  return useQuery({
    queryKey: ["estatisticas-linhas", municipioId, chave],
    enabled: !!municipioId && cargaIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LinhaEstat[]> => {
      const linhas: LinhaEstat[] = [];
      let de = 0;
      for (;;) {
        const { data, error } = await supabase
          .from("contribuintes_apurados")
          .select(
            "carga_id, inscricao_estadual, nome, cnpj, cnae, vaf_atual, entregou_declaracao, situacoes",
          )
          .eq("municipio_id", municipioId!)
          .in("carga_id", cargaIds)
          .order("id", { ascending: true })
          .range(de, de + PAGINA - 1);
        if (error) throw error;
        const lote = (data ?? []) as unknown as LinhaEstat[];
        linhas.push(...lote);
        if (lote.length < PAGINA) break;
        de += PAGINA;
        if (de > 200000) break;
      }
      return linhas;
    },
  });
}
