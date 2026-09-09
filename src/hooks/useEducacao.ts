import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VersaoEducacao = "provisorio" | "definitivo";

export type CalendarioEducacao = {
  exercicio: number;
  data_publicacao_provisorio: string | null;
  data_limite_recurso: string | null;
  data_publicacao_definitivo: string | null;
  peso_irap: number;
  peso_ire: number;
  peso_iae: number;
  peso_ige: number;
  resolucao_referencia: string | null;
  nota_tecnica: string | null;
  email_recurso: string;
};

export type DadoConstitutivoRow = {
  municipio: string;
  municipio_nome: string;
  coluna_origem: string;
  valor_num: number | null;
  valor_texto: string | null;
};

export function useCalendarioEducacao(exercicio: number | null) {
  return useQuery({
    queryKey: ["educacao-calendario", exercicio],
    enabled: !!exercicio,
    queryFn: async (): Promise<CalendarioEducacao | null> => {
      const { data, error } = await supabase
        .from("educacao_calendario")
        .select("*")
        .eq("exercicio", exercicio!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as CalendarioEducacao | null;
    },
  });
}

/**
 * Dados constitutivos do município e a média estadual de cada coluna, para
 * destacar números fora da curva antes de decidir se cabe recurso.
 */
export function useDadosConstitutivos(
  exercicio: number | null,
  versao: VersaoEducacao,
  municipio: string | null,
) {
  return useQuery({
    queryKey: ["educacao-dados", exercicio, versao, municipio],
    enabled: !!exercicio && !!municipio,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: doMunicipio, error: e1 } = await supabase
        .from("educacao_dados_constitutivos")
        .select("municipio, municipio_nome, coluna_origem, valor_num, valor_texto")
        .eq("exercicio", exercicio!)
        .eq("fonte_versao", versao)
        .eq("municipio", municipio!);
      if (e1) throw e1;
      const linhas = (doMunicipio ?? []) as unknown as DadoConstitutivoRow[];

      // Média estadual por coluna, lida em blocos para não estourar o limite.
      const soma = new Map<string, { total: number; n: number }>();
      const passo = 1000;
      for (let inicio = 0; inicio < 100000; inicio += passo) {
        const { data, error } = await supabase
          .from("educacao_dados_constitutivos")
          .select("coluna_origem, valor_num")
          .eq("exercicio", exercicio!)
          .eq("fonte_versao", versao)
          .range(inicio, inicio + passo - 1);
        if (error) throw error;
        const lote = (data ?? []) as { coluna_origem: string; valor_num: number | null }[];
        for (const l of lote) {
          if (l.valor_num == null) continue;
          const atual = soma.get(l.coluna_origem) ?? { total: 0, n: 0 };
          atual.total += Number(l.valor_num);
          atual.n += 1;
          soma.set(l.coluna_origem, atual);
        }
        if (lote.length < passo) break;
      }
      const medias = new Map<string, number>();
      for (const [coluna, s] of soma) medias.set(coluna, s.n ? s.total / s.n : 0);
      return { linhas, medias };
    },
  });
}

export function useRecursosEducacao(exercicio: number | null, municipio: string | null) {
  return useQuery({
    queryKey: ["educacao-recursos", exercicio, municipio],
    enabled: !!exercicio,
    queryFn: async () => {
      let q = supabase
        .from("educacao_recursos")
        .select("municipio, municipio_nome, item_contestado, resultado")
        .eq("exercicio", exercicio!)
        .limit(500);
      if (municipio) q = q.eq("municipio", municipio);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as {
        municipio: string;
        municipio_nome: string;
        item_contestado: string;
        resultado: string | null;
      }[];
    },
  });
}
