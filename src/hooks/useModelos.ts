import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import {
  MODELOS_PADRAO,
  type ModeloOficio,
  type SituacaoOficio,
} from "@/lib/oficios/modelos";

export type ModeloRegistro = ModeloOficio & { id: string; municipio_id: string };

/** Modelos salvos no banco, completados com os modelos padrão ainda não personalizados. */
export function useModelos() {
  const { municipioId } = useMunicipioAtivo();

  return useQuery({
    queryKey: ["modelos-oficio", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ModeloOficio[]> => {
      const { data, error } = await supabase
        .from("modelos_oficio")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("nome");
      if (error) throw error;

      const salvos = (data ?? []) as unknown as ModeloRegistro[];
      const chaves = new Set(salvos.map((m) => m.chave));
      const padroes = MODELOS_PADRAO.filter((m) => !chaves.has(m.chave));
      return [...salvos, ...padroes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}

export function useSalvarModelo() {
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modelo: ModeloOficio) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase.from("modelos_oficio").upsert(
        {
          municipio_id: municipioId,
          chave: modelo.chave,
          nome: modelo.nome,
          situacao: modelo.situacao,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["modelos-oficio"] }),
  });
}

export function useExcluirModelo() {
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chave: string) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase
        .from("modelos_oficio")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["modelos-oficio"] }),
  });
}

export function modelosParaSituacoes(
  modelos: ModeloOficio[] | undefined,
  situacoes: string[],
): ModeloOficio[] {
  if (!modelos) return [];
  return modelos.filter(
    (m) =>
      m.ativo &&
      (m.situacao === "GERAL" || situacoes.includes(m.situacao as SituacaoOficio)),
  );
}

export function novaChave(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || `modelo_${Date.now()}`;
}
