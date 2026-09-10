import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemImpugnacao } from "@/lib/vaf/impugnacao";

export type ImpugnacaoSalva = {
  id: string;
  municipio_id: string;
  carga_id: string | null;
  nome: string;
  exercicio: number;
  ano_base: number | null;
  resolucao: string;
  resolucao_data: string | null;
  indice_publicado: number | null;
  observacao: string | null;
  itens: ItemImpugnacao[];
  status: string;
  protocolo_numero: string | null;
  protocolado_em: string | null;
  criado_em: string;
};

/** Etapas do acompanhamento de uma impugnação até a decisão da SEF/MG. */
export const STATUS_IMPUGNACAO = [
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "pronta", rotulo: "Pronta para protocolar" },
  { valor: "protocolada", rotulo: "Protocolada" },
  { valor: "deferida", rotulo: "Deferida" },
  { valor: "indeferida", rotulo: "Indeferida" },
] as const;

export const rotuloStatus = (v: string): string =>
  STATUS_IMPUGNACAO.find((s) => s.valor === v)?.rotulo ?? v;

export function useImpugnacoes(municipioId: string | null) {
  return useQuery({
    queryKey: ["impugnacoes", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ImpugnacaoSalva[]> => {
      const { data, error } = await supabase
        .from("impugnacoes")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ImpugnacaoSalva[];
    },
  });
}

export type DadosSalvarImpugnacao = {
  id?: string | null;
  municipioId: string;
  cargaId?: string | null;
  nome: string;
  exercicio: number;
  anoBase: number | null;
  resolucao: string;
  resolucaoData: string | null;
  indicePublicado: number | null;
  observacao: string;
  itens: ItemImpugnacao[];
};

export function useSalvarImpugnacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosSalvarImpugnacao): Promise<string> => {
      const { data: userData } = await supabase.auth.getUser();
      const registro = {
        municipio_id: d.municipioId,
        carga_id: d.cargaId ?? null,
        nome: d.nome,
        exercicio: d.exercicio,
        ano_base: d.anoBase,
        resolucao: d.resolucao,
        resolucao_data: d.resolucaoData,
        indice_publicado: d.indicePublicado,
        observacao: d.observacao.trim() ? d.observacao.trim() : null,
        itens: d.itens as unknown as never,
      };
      if (d.id) {
        const { error } = await supabase.from("impugnacoes").update(registro).eq("id", d.id);
        if (error) throw error;
        return d.id;
      }
      const { data, error } = await supabase
        .from("impugnacoes")
        .insert({ ...registro, criado_por: userData.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["impugnacoes"] }),
  });
}

export function useExcluirImpugnacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("impugnacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["impugnacoes"] }),
  });
}
