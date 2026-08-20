import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chaveIe, type MapaSituacoesCadastrais } from "@/lib/vaf/recuperacao";

/**
 * Situação cadastral mais recente conhecida por inscrição estadual do município.
 * Usada para não notificar quem já está cancelado/baixado/bloqueado na SEF/MG.
 */
export function useSituacoesCadastrais(municipioId: string | null | undefined) {
  return useQuery({
    queryKey: ["situacoes-cadastrais", municipioId],
    enabled: !!municipioId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MapaSituacoesCadastrais> => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("inscricao_estadual, situacao_cadastral, criado_em")
        .eq("municipio_id", municipioId!)
        .not("situacao_cadastral", "is", null)
        .order("criado_em", { ascending: true })
        .limit(50000);
      if (error) throw error;
      const mapa: MapaSituacoesCadastrais = {};
      for (const linha of data ?? []) {
        const ie = chaveIe(linha.inscricao_estadual);
        if (!ie) continue;
        mapa[ie] = (linha as { situacao_cadastral: string | null }).situacao_cadastral;
      }
      return mapa;
    },
  });
}
