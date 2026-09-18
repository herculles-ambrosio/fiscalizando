import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AtividadeReferencia } from "@/lib/icms/esportes/parser";

export type FonteRelatorio = "preliminar" | "definitivo";

export type RankingEsportes = {
  ano_base: number;
  fonte_relatorio: string;
  municipio: string;
  municipio_nome: string;
  posicao: number | null;
  nota_atividades: number;
  nota_jimi: number;
  nota_jemg: number;
  nota_babt: number;
  nota_final: number;
  indice_percentual: number;
};

export type AtividadeEsportes = {
  id: string;
  municipio: string;
  municipio_nome: string;
  atividade_nome: string;
  atividade_codigo: string | null;
  peso_anexo_v: number | null;
  peso_atividade: number | null;
  peso_rcl: number | null;
  pontuacao_atletas: number | null;
  pontuacao_modalidades: number | null;
  pontuacao: number | null;
  eventos_texto: string;
  qtd_eventos: number;
  total_participantes: number;
  modalidades_texto: string;
};

export function useAtividadesReferencia() {
  return useQuery({
    queryKey: ["esportes-referencia"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<AtividadeReferencia[]> => {
      const { data, error } = await supabase
        .from("esportes_atividades_referencia")
        .select("codigo, nome_oficial, sinonimos, peso, requisito, ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as unknown as (AtividadeReferencia & {
        requisito: string;
        ordem: number;
      })[];
    },
  });
}

export function useEsportesAnos() {
  return useQuery({
    queryKey: ["esportes-anos"],
    queryFn: async (): Promise<{ ano: number; fonte: FonteRelatorio }[]> => {
      const { data, error } = await supabase
        .from("esportes_ranking_municipio")
        .select("ano_base, fonte_relatorio");
      if (error) throw error;
      const chaves = new Map<string, { ano: number; fonte: FonteRelatorio }>();
      for (const linha of data ?? []) {
        const item = {
          ano: linha.ano_base as number,
          fonte: linha.fonte_relatorio as FonteRelatorio,
        };
        chaves.set(`${item.ano}|${item.fonte}`, item);
      }
      return [...chaves.values()].sort((a, b) => b.ano - a.ano || a.fonte.localeCompare(b.fonte));
    },
  });
}

export function useEsportesRanking(ano: number | null, fonte: FonteRelatorio | null) {
  return useQuery({
    queryKey: ["esportes-ranking", ano, fonte],
    enabled: !!ano && !!fonte,
    queryFn: async (): Promise<RankingEsportes[]> => {
      const { data, error } = await supabase
        .from("esportes_ranking_municipio")
        .select("*")
        .eq("ano_base", ano!)
        .eq("fonte_relatorio", fonte!)
        .order("posicao", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as RankingEsportes[];
    },
  });
}

export function useEsportesAtividades(
  ano: number | null,
  fonte: FonteRelatorio | null,
  municipio: string | null,
) {
  return useQuery({
    queryKey: ["esportes-atividades", ano, fonte, municipio],
    enabled: !!ano && !!fonte && !!municipio,
    queryFn: async (): Promise<AtividadeEsportes[]> => {
      const { data, error } = await supabase
        .from("esportes_atividade_municipio")
        .select("*")
        .eq("ano_base", ano!)
        .eq("fonte_relatorio", fonte!)
        .eq("municipio", municipio!)
        .order("pontuacao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AtividadeEsportes[];
    },
  });
}

/**
 * Atividades pontuadas por um grupo de municípios (o município em análise e os
 * seus vizinhos), usado no painel de comparação regional do critério Esportes.
 */
export function useEsportesAtividadesMunicipios(
  ano: number | null,
  fonte: FonteRelatorio | null,
  municipios: string[],
) {
  const chaves = [...new Set(municipios)].sort();
  return useQuery({
    queryKey: ["esportes-atividades-varios", ano, fonte, chaves],
    enabled: !!ano && !!fonte && chaves.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AtividadeEsportes[]> => {
      const { data, error } = await supabase
        .from("esportes_atividade_municipio")
        .select("*")
        .eq("ano_base", ano!)
        .eq("fonte_relatorio", fonte!)
        .in("municipio", chaves)
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as unknown as AtividadeEsportes[];
    },
  });
}
