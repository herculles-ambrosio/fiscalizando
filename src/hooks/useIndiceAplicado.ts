import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Índices publicados em resolução da SEF-MG e aplicados em um exercício.
 * Serve apenas como referência de comparação: nada da apuração própria muda.
 */
export type IndiceAplicado = {
  resolucao: string;
  exercicio_aplicacao: number;
  municipio_nome: string;
  ano_a: number;
  vaf_a: number | null;
  indice_a: number | null;
  ano_b: number;
  vaf_b: number | null;
  indice_b: number | null;
  media_indices: number | null;
  fonte_url: string | null;
  criado_em: string;
};

function ehErroPermissao(error: { code?: string; message?: string }): boolean {
  return error.code === "42501" || (error.message ?? "").includes("permission denied");
}

const CAMPOS =
  "resolucao, exercicio_aplicacao, municipio_nome, ano_a, vaf_a, indice_a, ano_b, vaf_b, indice_b, media_indices, fonte_url, criado_em";

/**
 * Índice médio aplicado no exercício para o município.
 * Havendo mais de uma resolução (provisória e definitiva), vale a mais recente.
 */
export function useIndiceAplicado(municipioId: string | null, exercicioAplicacao: number | null) {
  return useQuery({
    queryKey: ["indice-aplicado", municipioId, exercicioAplicacao],
    enabled: !!municipioId && !!exercicioAplicacao,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<IndiceAplicado | null> => {
      const { data, error } = await supabase
        .from("indices_resolucao")
        .select(CAMPOS)
        .eq("municipio_id", municipioId!)
        .eq("exercicio_aplicacao", exercicioAplicacao!)
        .order("criado_em", { ascending: false })
        .limit(1);
      if (error) {
        if (ehErroPermissao(error)) return null;
        throw error;
      }
      return ((data ?? [])[0] as unknown as IndiceAplicado) ?? null;
    },
  });
}

export type ResolucaoCarregada = {
  resolucao: string;
  exercicio_aplicacao: number;
  ano_a: number;
  ano_b: number;
  municipios: number;
  criado_em: string;
};

/** Resoluções já importadas, para conferência na tela de carga. */
export function useResolucoesCarregadas() {
  return useQuery({
    queryKey: ["resolucoes-carregadas"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ResolucaoCarregada[]> => {
      const { data, error } = await supabase
        .from("indices_resolucao")
        .select("resolucao, exercicio_aplicacao, ano_a, ano_b, criado_em")
        .order("exercicio_aplicacao", { ascending: false })
        .limit(5000);
      if (error) {
        if (ehErroPermissao(error)) return [];
        throw error;
      }
      const mapa = new Map<string, ResolucaoCarregada>();
      for (const r of (data ?? []) as unknown as ResolucaoCarregada[]) {
        const atual = mapa.get(r.resolucao);
        if (atual) {
          atual.municipios += 1;
          if (r.criado_em > atual.criado_em) atual.criado_em = r.criado_em;
        } else {
          mapa.set(r.resolucao, { ...r, municipios: 1 });
        }
      }
      return [...mapa.values()].sort((a, b) => b.exercicio_aplicacao - a.exercicio_aplicacao);
    },
  });
}
