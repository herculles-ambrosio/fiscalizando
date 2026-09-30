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
  identidade_fonte: string | null;
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
  competencia: string | null;
  identidade_fonte: string | null;
  hash_arquivo: string | null;
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
      return (data ?? []) as unknown as (ItemReferencia & {
        requisito: string | null;
        ordem: number;
      })[];
    },
  });
}

export function useCriterioAnos(criterio: string | null) {
  return useQuery({
    queryKey: ["criterio-anos", criterio],
    enabled: !!criterio,
    queryFn: async () => {
      const [rk, imp] = await Promise.all([
        supabase
          .from("criterio_ranking_municipio")
          .select("ano_base, fonte_relatorio")
          .eq("criterio", criterio!)
          .order("ano_base", { ascending: false })
          .limit(20000),
        supabase
          .from("criterio_importacoes")
          .select("ano_base, fonte_relatorio")
          .eq("criterio", criterio!)
          .limit(1000),
      ]);
      if (rk.error) throw rk.error;
      const combos = new Map<string, { ano: number; fonte: FonteRelatorio }>();
      for (const l of [...(rk.data ?? []), ...(imp.data ?? [])]) {
        const fonte = (l.fonte_relatorio === "definitivo" ? "definitivo" : "preliminar") as FonteRelatorio;
        const chave = `${l.ano_base}-${fonte}`;
        if (!combos.has(chave)) combos.set(chave, { ano: l.ano_base as number, fonte });
      }
      return [...combos.values()].sort(
        (a, b) => b.ano - a.ano || (a.fonte === "definitivo" ? -1 : 1),
      );
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

/**
 * Itens pontuados por um conjunto de municípios (o município em análise e os
 * seus vizinhos), usado no painel de comparação regional.
 */
export function useItensCriterioMunicipios(
  criterio: string | null,
  ano: number | null,
  fonte: FonteRelatorio | null,
  municipios: string[],
) {
  const chaves = [...new Set(municipios)].sort();
  return useQuery({
    queryKey: ["criterio-itens-varios", criterio, ano, fonte, chaves],
    enabled: !!criterio && !!ano && !!fonte && chaves.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ItemCriterioRow[]> => {
      const resultado: ItemCriterioRow[] = [];
      for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await supabase
          .from("criterio_item_municipio")
          .select("*")
          .eq("criterio", criterio!)
          .eq("ano_base", ano!)
          .eq("fonte_relatorio", fonte!)
          .in("municipio", chaves)
          .order("id")
          .range(inicio, inicio + 999);
        if (error) throw error;
        resultado.push(...((data ?? []) as unknown as ItemCriterioRow[]));
        if (!data || data.length < 1000) break;
      }
      return resultado;
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

/**
 * Índice de cada município em todos os critérios que já têm relatório
 * importado. Para cada critério usa o ano-base mais recente e, dentro dele,
 * prefere o relatório definitivo ao preliminar.
 */
export function useRankingTodosCriterios(municipios: string[]) {
  const chaves = [...new Set(municipios)].sort();
  return useQuery({
    queryKey: ["criterio-ranking-todos", chaves],
    enabled: chaves.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RankingCriterioRow[]> => {
      const { data, error } = await supabase
        .from("criterio_ranking_municipio")
        .select(
          "criterio, ano_base, fonte_relatorio, municipio, municipio_nome, posicao, nota_final, indice_percentual",
        )
        .in("municipio", chaves)
        .order("ano_base", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const linhas = (data ?? []) as unknown as RankingCriterioRow[];
      const melhor = new Map<string, { ano: number; fonte: string }>();
      for (const l of linhas) {
        const atual = melhor.get(l.criterio);
        const ganha =
          !atual ||
          l.ano_base > atual.ano ||
          (l.ano_base === atual.ano && l.fonte_relatorio === "definitivo");
        if (ganha) melhor.set(l.criterio, { ano: l.ano_base, fonte: l.fonte_relatorio });
      }
      return linhas.filter((l) => {
        const m = melhor.get(l.criterio);
        return m && l.ano_base === m.ano && l.fonte_relatorio === m.fonte;
      });
    },
  });
}

export type PotencialItem = {
  /** Maior pontuação registrada neste item entre todos os municípios do relatório. */
  maximo: number;
  /** Pontuação típica (mediana) entre os municípios que já pontuam o item. */
  tipico: number;
  /** Quantos municípios já pontuam o item. */
  municipios: number;
};

/**
 * Quanto cada item pode render, medido no próprio relatório oficial: o teto é a
 * maior pontuação alcançada por um município mineiro e a expectativa realista é
 * a mediana entre quem já pontua. Serve para mostrar, num item que hoje está
 * zerado, o que o município passaria a somar se cumprisse a exigência.
 */
export function usePotencialItens(
  criterio: string | null,
  ano: number | null,
  fonte: FonteRelatorio | null,
) {
  return useQuery({
    queryKey: ["criterio-potencial", criterio, ano, fonte],
    enabled: !!criterio && !!ano && !!fonte,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Map<string, PotencialItem>> => {
      const passo = 1000;
      const valores = new Map<string, number[]>();
      for (let inicio = 0; inicio < 60000; inicio += passo) {
        const { data, error } = await supabase
          .from("criterio_item_municipio")
          .select("item_codigo, pontuacao")
          .eq("criterio", criterio!)
          .eq("ano_base", ano!)
          .eq("fonte_relatorio", fonte!)
          .range(inicio, inicio + passo - 1);
        if (error) throw error;
        const lote = data ?? [];
        for (const l of lote as { item_codigo: string | null; pontuacao: number | null }[]) {
          if (!l.item_codigo || !l.pontuacao || l.pontuacao <= 0) continue;
          const lista = valores.get(l.item_codigo) ?? [];
          lista.push(Number(l.pontuacao));
          valores.set(l.item_codigo, lista);
        }
        if (lote.length < passo) break;
      }
      const mapa = new Map<string, PotencialItem>();
      for (const [codigo, lista] of valores) {
        lista.sort((a, b) => a - b);
        const meio = Math.floor(lista.length / 2);
        const tipico =
          lista.length % 2 ? lista[meio]! : ((lista[meio - 1] ?? 0) + (lista[meio] ?? 0)) / 2;
        mapa.set(codigo, { maximo: lista[lista.length - 1]!, tipico, municipios: lista.length });
      }
      return mapa;
    },
  });
}
