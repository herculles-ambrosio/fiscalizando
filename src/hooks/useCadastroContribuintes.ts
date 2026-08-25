import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chaveIeReceita } from "@/lib/receita/porIe";

export type CadastroContribuinte = { nome: string | null; cnpj: string | null };

/**
 * Cadastro (nome e CNPJ) por inscrição estadual, a partir das apurações já
 * gravadas do município. Usado por telas que só têm a IE (evolução, plano de
 * recuperação) para cruzar com a situação cadastral na Receita Federal.
 */
export function useCadastroContribuintes(municipioId: string | null | undefined) {
  return useQuery({
    queryKey: ["cadastro-contribuintes", municipioId],
    enabled: !!municipioId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, CadastroContribuinte>> => {
      const mapa: Record<string, CadastroContribuinte> = {};
      const PAGINA = 1000;
      // Paginação obrigatória: o Data API limita cada resposta a 1.000 linhas,
      // e municípios grandes têm mais de 10 mil contribuintes apurados.
      for (let inicio = 0; inicio < 60000; inicio += PAGINA) {
        const { data, error } = await supabase
          .from("contribuintes_apurados")
          .select("inscricao_estadual, nome, cnpj")
          .eq("municipio_id", municipioId!)
          .order("inscricao_estadual", { ascending: true })
          .range(inicio, inicio + PAGINA - 1);
        if (error) throw error;
        for (const linha of data ?? []) {
          const k = chaveIeReceita(linha.inscricao_estadual);
          if (!k) continue;
          const atual = mapa[k];
          mapa[k] = {
            nome: atual?.nome ?? linha.nome ?? null,
            cnpj: atual?.cnpj ?? linha.cnpj ?? null,
          };
        }
        if (!data || data.length < PAGINA) break;
      }
      return mapa;
    },

  });
}
