/** Modelos editáveis e histórico das notificações do módulo Empresas. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import { MODELOS_EMPRESA_PADRAO, type ModeloEmpresa } from "@/lib/empresas/notificacoes";

export function useModelosEmpresa() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["empresas-modelos", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ModeloEmpresa[]> => {
      const { data, error } = await supabase.from("empresas_modelos").select("*").eq("municipio_id", municipioId!).order("nome");
      if (error) throw error;
      const salvos = (data ?? []) as unknown as ModeloEmpresa[];
      const chaves = new Set(salvos.map((m) => m.chave));
      return [...salvos, ...MODELOS_EMPRESA_PADRAO.filter((m) => !chaves.has(m.chave))].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  });
}

export function useSalvarModeloEmpresa() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: ModeloEmpresa) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase.from("empresas_modelos").upsert(
        {
          municipio_id: municipioId,
          chave: m.chave,
          nome: m.nome,
          observacao: m.observacao,
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
        { onConflict: "municipio_id,chave" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas-modelos"] }),
  });
}

export function useExcluirModeloEmpresa() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chave: string) => {
      const { error } = await supabase.from("empresas_modelos").delete().eq("municipio_id", municipioId!).eq("chave", chave);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas-modelos"] }),
  });
}

export function useHistoricoNotificacoes() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["empresas-notificacoes", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_notificacoes")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistrarNotificacoes() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itens: { cnpj: string; nome: string | null; observacao: string; modelo_chave: string; modelo_nome: string }[]) => {
      const { data: u } = await supabase.auth.getUser();
      const nome = (u.user?.user_metadata?.nome as string | undefined) ?? u.user?.email ?? null;
      const { error } = await supabase.from("empresas_notificacoes").insert(
        itens.map((i) => ({ ...i, municipio_id: municipioId!, emitido_por: u.user?.id ?? null, emitido_por_nome: nome })),
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["empresas-notificacoes"] }),
  });
}
