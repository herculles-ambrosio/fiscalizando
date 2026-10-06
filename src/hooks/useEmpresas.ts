import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Empresa = Tables<"empresas">;

export function useEmpresas(municipioId: string | null | undefined) {
  return useQuery({
    queryKey: ["empresas", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<Empresa[]> => {
      const todas: Empresa[] = [];
      const PAGINA = 1000;
      for (let inicio = 0; inicio < 200000; inicio += PAGINA) {
        const { data, error } = await supabase
          .from("empresas")
          .select("*")
          .eq("municipio_id", municipioId!)
          .order("cnpj")
          .range(inicio, inicio + PAGINA - 1);
        if (error) throw error;
        todas.push(...(data ?? []));
        if (!data || data.length < PAGINA) break;
      }
      return todas;
    },
  });
}
