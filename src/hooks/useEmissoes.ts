import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import type { EmissaoRegistro } from "@/lib/oficios/registro";

export type FiltroEmissoes = {
  inscricaoEstadual?: string | undefined;
  cargaId?: string | undefined;
  exercicio?: number | undefined;
  modeloChave?: string | undefined;
  status?: string | undefined;
  busca?: string | undefined;
  limite?: number;
  ativo?: boolean;
};

export function useEmissoes(filtro: FiltroEmissoes = {}) {
  const { municipioId } = useMunicipioAtivo();
  const {
    inscricaoEstadual,
    cargaId,
    exercicio,
    modeloChave,
    status,
    busca,
    limite = 200,
    ativo = true,
  } = filtro;

  return useQuery({
    enabled: ativo && !!municipioId,
    queryKey: [
      "oficios-emitidos",
      municipioId,
      inscricaoEstadual ?? null,
      cargaId ?? null,
      exercicio ?? null,
      modeloChave ?? null,
      status ?? null,
      busca ?? null,
      limite,
    ],
    queryFn: async (): Promise<EmissaoRegistro[]> => {
      let q = supabase
        .from("oficios_emitidos")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false })
        .limit(limite);

      if (inscricaoEstadual) q = q.eq("inscricao_estadual", inscricaoEstadual);
      if (cargaId) q = q.eq("carga_id", cargaId);
      if (exercicio) q = q.eq("exercicio", exercicio);
      if (modeloChave) q = q.eq("modelo_chave", modeloChave);
      if (status) q = q.eq("status_download", status);
      if (busca?.trim()) {
        const termo = `%${busca.trim()}%`;
        q = q.or(
          `nome_contribuinte.ilike.${termo},cnpj.ilike.${termo},inscricao_estadual.ilike.${termo}`,
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EmissaoRegistro[];
    },
  });
}
