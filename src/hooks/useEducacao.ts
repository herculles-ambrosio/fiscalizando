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
      return { linhas, medias, atendidas: etapasAtendidas(linhas) };
    },
  });
}

/** Direção desejada de cada indicador (maior_melhor por padrão). */
export function useMetadadosIndicadores() {
  return useQuery({
    queryKey: ["educacao-metadados-indicador"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Map<string, Direcao>> => {
      const { data, error } = await (supabase as any)
        .from("educacao_metadados_indicador")
        .select("indicador, direcao_desejada");
      if (error) throw error;
      const mapa = new Map<string, Direcao>();
      for (const l of (data ?? []) as { indicador: string; direcao_desejada: Direcao }[]) {
        mapa.set(l.indicador.toLowerCase(), l.direcao_desejada);
      }
      return mapa;
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

/** Todos os calendários cadastrados, para o painel de prazos de recurso. */
export function useCalendariosEducacao() {
  return useQuery({
    queryKey: ["educacao-calendarios"],
    queryFn: async (): Promise<CalendarioEducacao[]> => {
      const { data, error } = await supabase
        .from("educacao_calendario")
        .select("*")
        .order("exercicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CalendarioEducacao[];
    },
  });
}

export type OutlierMunicipio = {
  municipio: string;
  municipioNome: string;
  fora: number;
  total: number;
  piores: { coluna: string; valor: number | null; media: number | null; dif: number | null }[];
};

/**
 * Municípios com números brutos fora da média estadual, calculados no banco
 * (são dezenas de milhares de linhas por exercício).
 */
export function useOutliersEducacao(
  exercicio: number | null,
  versao: VersaoEducacao,
  limite = 40,
) {
  return useQuery({
    queryKey: ["educacao-outliers", exercicio, versao, limite],
    enabled: !!exercicio,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<OutlierMunicipio[]> => {
      const { data, error } = await (supabase.rpc as any)("educacao_outliers", {
        p_exercicio: exercicio!,
        p_versao: versao,
        p_limite: limite,
      });
      if (error) throw error;
      const linhas = (data ?? []) as {
        mun: string;
        mun_nome: string;
        fora: number;
        total: number;
        piores: OutlierMunicipio["piores"];
      }[];
      return linhas
        .map((l) => ({
          municipio: l.mun,
          municipioNome: l.mun_nome,
          fora: Number(l.fora ?? 0),
          total: Number(l.total ?? 0),
          piores: l.piores ?? [],
        }))
        .sort((a, b) => b.fora - a.fora || a.municipioNome.localeCompare(b.municipioNome, "pt-BR"));
    },
  });
}

/** Versões (provisório/definitivo) que já têm dados importados no exercício. */
export function useVersoesEducacao(exercicio: number | null) {
  return useQuery({
    queryKey: ["educacao-versoes", exercicio],
    enabled: !!exercicio,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<VersaoEducacao[]> => {
      const achadas: VersaoEducacao[] = [];
      for (const v of ["provisorio", "definitivo"] as VersaoEducacao[]) {
        const { data, error } = await supabase
          .from("educacao_dados_constitutivos")
          .select("id")
          .eq("exercicio", exercicio!)
          .eq("fonte_versao", v)
          .limit(1);
        if (error) throw error;
        if (data?.length) achadas.push(v);
      }
      return achadas;
    },
  });
}
