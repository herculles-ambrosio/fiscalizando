import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ArquivoEvolucao } from "@/lib/vaf/evolucao";

export type EvolucaoSalva = {
  id: string;
  municipio_id: string;
  nome: string;
  observacao: string | null;
  vaf_referencia: string | null;
  arquivo_base_nome: string;
  arquivo_atual_nome: string;
  base: ArquivoEvolucao;
  atual: ArquivoEvolucao;
  criado_em: string;
};

export function useEvolucoesSalvas(municipioId: string | null) {
  return useQuery({
    queryKey: ["evolucoes-salvas", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<EvolucaoSalva[]> => {
      if (!municipioId) return [];
      const { data, error } = await supabase
        .from("evolucoes_salvas")
        .select("*")
        .eq("municipio_id", municipioId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EvolucaoSalva[];
    },
  });
}

export type DadosSalvarEvolucao = {
  municipioId: string;
  nome: string;
  observacao?: string;
  vafReferencia: string;
  base: ArquivoEvolucao;
  atual: ArquivoEvolucao;
};

export function useSalvarEvolucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosSalvarEvolucao) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("evolucoes_salvas").insert({
        municipio_id: d.municipioId,
        nome: d.nome,
        observacao: d.observacao?.trim() ? d.observacao.trim() : null,
        vaf_referencia: d.vafReferencia || null,
        arquivo_base_nome: d.base.nome,
        arquivo_atual_nome: d.atual.nome,
        base: d.base as unknown as never,
        atual: d.atual as unknown as never,
        criado_por: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["evolucoes-salvas", vars.municipioId] });
    },
  });
}

export function useExcluirEvolucao(municipioId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evolucoes_salvas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evolucoes-salvas", municipioId] });
    },
  });
}
