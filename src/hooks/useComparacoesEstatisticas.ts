/**
 * Dados da comparação de Estatísticas alimentada pelas resoluções da SEF-MG
 * (lado base) contra as evoluções salvas de cada prefeitura (lado atual).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function ehErroPermissao(error: { code?: string; message?: string }): boolean {
  return error.code === "42501" || (error.message ?? "").includes("permission denied");
}

/** Evolução salva, só com os números necessários à comparação. */
export type EvolucaoResumo = {
  id: string;
  municipio_id: string;
  nome: string;
  criado_em: string;
  arquivo_base_nome: string;
  arquivo_atual_nome: string;
  indiceBase: number | null;
  indiceAtual: number | null;
  anoApuracaoBase: number | null;
  anoAplicacaoBase: number | null;
  anoApuracaoAtual: number | null;
  anoAplicacaoAtual: number | null;
};

type ApuracaoParcial = { indice?: number | null } | null;

const numeroOuNulo = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Todas as evoluções salvas visíveis ao usuário (a visibilidade é decidida pelas regras de acesso). */
export function useEvolucoesResumo() {
  return useQuery({
    queryKey: ["evolucoes-resumo"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<EvolucaoResumo[]> => {
      const { data, error } = await supabase
        .from("evolucoes_salvas")
        .select(
          "id, municipio_id, nome, criado_em, arquivo_base_nome, arquivo_atual_nome, apuracao_base:base->apuracao, apuracao_atual:atual->apuracao, ano_apuracao_base:base->anoApuracao, ano_aplicacao_base:base->anoAplicacao, ano_apuracao_atual:atual->anoApuracao, ano_aplicacao_atual:atual->anoAplicacao",
        )
        .order("criado_em", { ascending: false });
      if (error) {
        if (ehErroPermissao(error)) return [];
        throw error;
      }
      return (data ?? []).map((r) => {
        const linha = r as unknown as Record<string, unknown>;
        const base = linha["apuracao_base"] as ApuracaoParcial;
        const atual = linha["apuracao_atual"] as ApuracaoParcial;
        return {
          id: String(linha["id"]),
          municipio_id: String(linha["municipio_id"]),
          nome: String(linha["nome"]),
          criado_em: String(linha["criado_em"]),
          arquivo_base_nome: String(linha["arquivo_base_nome"] ?? ""),
          arquivo_atual_nome: String(linha["arquivo_atual_nome"] ?? ""),
          indiceBase: numeroOuNulo(base?.indice),
          indiceAtual: numeroOuNulo(atual?.indice),
          anoApuracaoBase: numeroOuNulo(linha["ano_apuracao_base"]),
          anoAplicacaoBase: numeroOuNulo(linha["ano_aplicacao_base"]),
          anoApuracaoAtual: numeroOuNulo(linha["ano_apuracao_atual"]),
          anoAplicacaoAtual: numeroOuNulo(linha["ano_aplicacao_atual"]),
        };
      });
    },
  });
}

/** Linhas publicadas de uma resolução, para todos os municípios. */
export type LinhaResolucaoMunicipio = {
  municipio_id: string | null;
  codigo_mun: string;
  municipio_nome: string;
  ano_a: number;
  indice_a: number | null;
  ano_b: number;
  indice_b: number | null;
  media_indices: number | null;
};

export function useIndicesDaResolucao(resolucaoNumero: string | null) {
  return useQuery({
    queryKey: ["indices-da-resolucao", resolucaoNumero],
    enabled: !!resolucaoNumero,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LinhaResolucaoMunicipio[]> => {
      const { data, error } = await supabase
        .from("indices_resolucao")
        .select(
          "municipio_id, codigo_mun, municipio_nome, ano_a, indice_a, ano_b, indice_b, media_indices",
        )
        .eq("resolucao", resolucaoNumero!);
      if (error) {
        if (ehErroPermissao(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as LinhaResolucaoMunicipio[];
    },
  });
}

/** Números congelados no momento em que a comparação foi gravada. */
export type LinhaComparacaoGravada = {
  municipioId: string;
  municipio: string;
  evolucaoId: string;
  evolucaoNome: string;
  mediaResolucao: number | null;
  indiceBase: number | null;
  indiceAtual: number | null;
  mediaAtual: number | null;
  pontos: number | null;
  variacao: number | null;
};

export type ComparacaoSalva = {
  id: string;
  nome: string;
  observacao: string | null;
  resolucao_numero: string;
  evolucao_ids: string[];
  linhas: LinhaComparacaoGravada[];
  criado_em: string;
};

export function useComparacoesSalvas() {
  return useQuery({
    queryKey: ["estatisticas-comparacoes"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ComparacaoSalva[]> => {
      const { data, error } = await supabase
        .from("estatisticas_comparacoes")
        .select("id, nome, observacao, resolucao_numero, evolucao_ids, linhas, criado_em")
        .order("criado_em", { ascending: false });
      if (error) {
        if (ehErroPermissao(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as ComparacaoSalva[];
    },
  });
}

export type DadosComparacao = {
  nome: string;
  observacao?: string;
  resolucaoNumero: string;
  evolucaoIds: string[];
  linhas: LinhaComparacaoGravada[];
};

export function useSalvarComparacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosComparacao) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("estatisticas_comparacoes").insert({
        nome: d.nome,
        observacao: d.observacao?.trim() ? d.observacao.trim() : null,
        resolucao_numero: d.resolucaoNumero,
        evolucao_ids: d.evolucaoIds,
        linhas: d.linhas as unknown as never,
        criado_por: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estatisticas-comparacoes"] }),
  });
}

export function useExcluirComparacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estatisticas_comparacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estatisticas-comparacoes"] }),
  });
}
