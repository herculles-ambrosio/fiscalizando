/** Modelos editáveis dos documentos de fiscalização de cartório. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import { MODELOS_CARTORIO_PADRAO, type ModeloCartorio } from "@/lib/cartorios/modelos";

export function useModelosCartorio() {
  const { municipioId } = useMunicipioAtivo();

  return useQuery({
    queryKey: ["cartorio-modelos", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ModeloCartorio[]> => {
      const { data, error } = await supabase
        .from("cartorio_modelos")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("nome");
      if (error) throw error;
      const salvos = (data ?? []) as unknown as ModeloCartorio[];
      const chaves = new Set(salvos.map((m) => m.chave));
      const padroes = MODELOS_CARTORIO_PADRAO.filter((m) => !chaves.has(m.chave));
      return [...salvos, ...padroes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}

export function useSalvarModeloCartorio() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (modelo: ModeloCartorio) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase.from("cartorio_modelos").upsert(
        {
          municipio_id: municipioId,
          chave: modelo.chave,
          nome: modelo.nome,
          tipo: modelo.tipo,
          titulo: modelo.titulo,
          corpo: modelo.corpo,
          ativo: modelo.ativo,
          margem_topo: modelo.margem_topo ?? 1.9,
          margem_direita: modelo.margem_direita ?? 1.9,
          margem_inferior: modelo.margem_inferior ?? 1.9,
          margem_esquerda: modelo.margem_esquerda ?? 1.9,
          cabecalho: modelo.cabecalho?.trim() ? modelo.cabecalho : null,
          rodape: modelo.rodape?.trim() ? modelo.rodape : null,
        },
        { onConflict: "municipio_id,chave" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-modelos"] }),
  });
}

export function useExcluirModeloCartorio() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (chave: string) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase
        .from("cartorio_modelos")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-modelos"] }),
  });
}
