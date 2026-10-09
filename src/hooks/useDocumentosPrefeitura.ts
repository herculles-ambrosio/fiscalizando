/** Modelos de documento exclusivos da prefeitura ativa, por módulo. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import type { ModeloPrefeitura, ModuloDocumento } from "@/lib/documentosPrefeitura";

export function useModelosPrefeitura(modulo: ModuloDocumento) {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["documentos-prefeitura", municipioId, modulo],
    enabled: !!municipioId,
    queryFn: async (): Promise<ModeloPrefeitura[]> => {
      const { data, error } = await supabase
        .from("documentos_prefeitura_modelos")
        .select("*")
        .eq("municipio_id", municipioId!)
        .eq("modulo", modulo)
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        modulo,
        destinatario: m.destinatario as ModeloPrefeitura["destinatario"],
        margem_topo: Number(m.margem_topo),
        margem_direita: Number(m.margem_direita),
        margem_inferior: Number(m.margem_inferior),
        margem_esquerda: Number(m.margem_esquerda),
      }));
    },
  });
}

export function useSalvarModeloPrefeitura() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: ModeloPrefeitura) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      if (!m.nome.trim()) throw new Error("Informe o nome do modelo.");
      const { error } = await supabase.from("documentos_prefeitura_modelos").upsert(
        {
          municipio_id: municipioId,
          modulo: m.modulo,
          chave: m.chave,
          nome: m.nome,
          destinatario: m.destinatario,
          titulo: m.titulo,
          corpo: m.corpo,
          ativo: m.ativo,
          margem_topo: m.margem_topo ?? 1.9,
          margem_direita: m.margem_direita ?? 1.9,
          margem_inferior: m.margem_inferior ?? 1.9,
          margem_esquerda: m.margem_esquerda ?? 1.9,
          cabecalho: m.cabecalho?.trim() ? m.cabecalho : null,
          rodape: m.rodape?.trim() ? m.rodape : null,
        },
        { onConflict: "municipio_id,modulo,chave" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-prefeitura"] }),
  });
}

export function useExcluirModeloPrefeitura() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ modulo, chave }: { modulo: ModuloDocumento; chave: string }) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase
        .from("documentos_prefeitura_modelos")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("modulo", modulo)
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-prefeitura"] }),
  });
}
