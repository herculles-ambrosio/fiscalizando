import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function chave(ie: string | null | undefined): string {
  return (ie ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

/**
 * Nome do contribuinte por inscrição estadual, a partir das apurações já
 * gravadas do município. Usado para exibir nome em telas que só recebem a IE
 * (ex.: remetentes da planilha de crédito próprio do Portal do VAF).
 */
export function useNomesContribuintes(municipioId: string | null | undefined) {
  return useQuery({
    queryKey: ["nomes-contribuintes", municipioId],
    enabled: !!municipioId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("inscricao_estadual, nome")
        .eq("municipio_id", municipioId!)
        .not("nome", "is", null)
        .limit(50000);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const linha of data ?? []) {
        const k = chave(linha.inscricao_estadual);
        if (k && linha.nome && !mapa[k]) mapa[k] = linha.nome;
      }
      return mapa;
    },
  });
}
