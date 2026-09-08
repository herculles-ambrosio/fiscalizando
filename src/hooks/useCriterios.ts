import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ItemReferencia } from "@/lib/icms/criterios/tabela";

export type FonteRelatorio = "preliminar" | "definitivo";

export type RankingCriterioRow = {
  criterio: string;
  ano_base: number;
  fonte_relatorio: string;
  municipio: string;
  municipio_nome: string;
  posicao: number | null;
  nota_final: number;
  indice_percentual: number;
};

export type ItemCriterioRow = {
  id: string;
  criterio: string;
  ano_base: number;
  fonte_relatorio: string;
  municipio: string;
  municipio_nome: string;
  item_nome: string;
  item_codigo: string | null;
  peso: number | null;
  pontuacao: number | null;
  quantidade: number | null;
  observacao: string | null;
};

export type ImportacaoRow = {
  id: string;
  criterio: string;
  ano_base: number;
  fonte_relatorio: string;
  origem: string;
  url: string | null;
  arquivo_nome: string | null;
  paginas: number;
  registros_ranking: number;
  registros_itens: number;
  municipios: number;
  nao_mapeados: string[];
  divergencias: { municipio: string; esperado: number; obtido: number }[];
  importado_por_nome: string | null;
  criado_em: string;
};

/** Critérios que já têm relatório importado (usado para destacar no catálogo). */
export function useCriteriosComDados() {
  return useQuery({
    queryKey: ["criterios-com-dados"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, { anos: number[]; importacoes: number }>> => {
      const { data, error } = await supabase
        .from("criterio_importacoes")
        .select("criterio, ano_base")
        .order("ano_base", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const mapa: Record<string, { anos: number[]; importacoes: number }> = {};
      for (const l of data ?? []) {
        const slug = l.criterio as string;
        const atual = (mapa[slug] ??= { anos: [], importacoes: 0 });
        atual.importacoes += 1;
        if (!atual.anos.includes(l.ano_base as number)) atual.anos.push(l.ano_base as number);
      }
      return mapa;
    },
  });
}

export function useItensReferencia(criterio: string | null) {

  return useQuery({
    queryKey: ["criterio-referencia", criterio],
    enabled: !!criterio,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<ItemReferencia[]> => {
      const { data, error } = await supabase
        .from("criterio_itens_referencia")
        .select("codigo, nome_oficial, sinonimos, peso, requisito, ordem")
        .eq("criterio", criterio!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as ItemReferencia[];
    },
  });
}

export function useItensReferenciaCompleta(criterio: string | null) {
  return useQuery({
    queryKey: ["criterio-referencia-completa", criterio],
    enabled: !!criterio,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterio_itens_referencia")
        .select("codigo, nome_oficial, sinonimos, peso, requisito, ordem")
        .eq("criterio", criterio!)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as (ItemReferencia & { requisito: string | null; ordem: number })[];
    },
  });
}

export function useCriterioAnos(criterio: string | null) {
  return useQuery({
    queryKey: ["criterio-anos", criterio],
    enabled: !!criterio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterio_ranking_municipio")
        .select("ano_base, fonte_relatorio")
        .eq("criterio", criterio!)
        .order("ano_base", { ascending: false });
      if (error) throw error;
      const combos = new Map<string, { ano: number; fonte: FonteRelatorio }>();
      for (const l of data ?? []) {
        const chave = `${l.ano_base}-${l.fonte_relatorio}`;
        if (!combos.has(chave)) {
          combos.set(chave, { ano: l.ano_base as number, fonte: l.fonte_relatorio as FonteRelatorio });
        }
      }
      return [...combos.values()];
    },
  });
}

export function useCriterioRanking(
  criterio: string | null,
  ano: number | null,
  fonte: FonteRelatorio | null,
) {
  return useQuery({
    queryKey: ["criterio-ranking", criterio, ano, fonte],
    enabled: !!criterio && !!ano && !!fonte,
    queryFn: async (): Promise<RankingCriterioRow[]> => {
      const { data, error } = await supabase
        .from("criterio_ranking_municipio")
        .select("*")
        .eq("criterio", criterio!)
        .eq("ano_base", ano!)
        .eq("fonte_relatorio", fonte!)
        .order("nota_final", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RankingCriterioRow[];
    },
  });
}

export function useCriterioItens(
  criterio: string | null,
  ano: number | null,
  fonte: FonteRelatorio | null,
  municipio: string | null,
) {
  return useQuery({
    queryKey: ["criterio-itens", criterio, ano, fonte, municipio],
    enabled: !!criterio && !!ano && !!fonte && !!municipio,
    queryFn: async (): Promise<ItemCriterioRow[]> => {
      const { data, error } = await supabase
        .from("criterio_item_municipio")
        .select("*")
        .eq("criterio", criterio!)
        .eq("ano_base", ano!)
        .eq("fonte_relatorio", fonte!)
        .eq("municipio", municipio!);
      if (error) throw error;
      return (data ?? []) as unknown as ItemCriterioRow[];
    },
  });
}

export function useImportacoes(criterio?: string | null) {
  return useQuery({
    queryKey: ["criterio-importacoes", criterio ?? "todas"],
    queryFn: async (): Promise<ImportacaoRow[]> => {
      let q = supabase
        .from("criterio_importacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (criterio) q = q.eq("criterio", criterio);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ImportacaoRow[];
    },
  });
}
