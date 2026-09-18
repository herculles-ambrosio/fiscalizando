import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LinhaResolucao } from "@/lib/vaf/resolucao";

/** Resolução da SEF-MG cadastrada, com os anos de apuração e de aplicação. */
export type ResolucaoSef = {
  id: string;
  numero: string;
  data_publicacao: string | null;
  url: string | null;
  ano_apuracao: number;
  ano_aplicacao: number;
  ano_a: number | null;
  ano_b: number | null;
  observacao: string | null;
  municipios: number;
  criado_em: string;
};

function ehErroPermissao(error: { code?: string; message?: string }): boolean {
  return error.code === "42501" || (error.message ?? "").includes("permission denied");
}

export function useResolucoesSef() {
  return useQuery({
    queryKey: ["resolucoes-sef"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ResolucaoSef[]> => {
      const { data, error } = await supabase
        .from("resolucoes_sef")
        .select("*")
        .order("ano_aplicacao", { ascending: false });
      if (error) {
        if (ehErroPermissao(error)) return [];
        throw error;
      }
      return (data ?? []) as unknown as ResolucaoSef[];
    },
  });
}

export type DadosResolucao = {
  numero: string;
  dataPublicacao: string | null;
  url: string | null;
  anoApuracao: number;
  anoAplicacao: number;
  anoA: number | null;
  anoB: number | null;
  observacao: string | null;
  linhas: { linha: LinhaResolucao; municipioId: string | null }[];
};

/** Grava (ou regrava) a resolução e as linhas do Anexo Único. */
export function useSalvarResolucaoSef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosResolucao) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: resolucao, error: erroRes } = await supabase
        .from("resolucoes_sef")
        .upsert(
          {
            numero: d.numero,
            data_publicacao: d.dataPublicacao,
            url: d.url,
            ano_apuracao: d.anoApuracao,
            ano_aplicacao: d.anoAplicacao,
            ano_a: d.anoA,
            ano_b: d.anoB,
            observacao: d.observacao,
            municipios: d.linhas.length,
            criado_por: userData.user?.id ?? null,
          },
          { onConflict: "numero" },
        )
        .select("id")
        .single();
      if (erroRes) throw erroRes;

      const registros = d.linhas.map(({ linha, municipioId }) => ({
        resolucao_id: resolucao.id,
        municipio_id: municipioId,
        codigo_mun: linha.codigoMun,
        municipio_nome: linha.municipioNome,
        resolucao: d.numero,
        exercicio_aplicacao: d.anoAplicacao,
        ano_a: d.anoA ?? d.anoApuracao - 1,
        vaf_a: linha.vafA,
        indice_a: linha.indiceA,
        ano_b: d.anoB ?? d.anoApuracao,
        vaf_b: linha.vafB,
        indice_b: linha.indiceB,
        media_indices: linha.mediaIndices,
        fonte_url: d.url,
      }));

      for (let i = 0; i < registros.length; i += 500) {
        const { error } = await supabase
          .from("indices_resolucao")
          .upsert(registros.slice(i, i + 500), { onConflict: "resolucao,codigo_mun" });
        if (error) throw error;
      }
      return resolucao.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resolucoes-sef"] });
      qc.invalidateQueries({ queryKey: ["indices-resolucao"] });
      qc.invalidateQueries({ queryKey: ["indice-aplicado"] });
      qc.invalidateQueries({ queryKey: ["resolucoes-carregadas"] });
    },
  });
}

export function useExcluirResolucaoSef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: ResolucaoSef) => {
      const { error: erroLinhas } = await supabase
        .from("indices_resolucao")
        .delete()
        .eq("resolucao", r.numero);
      if (erroLinhas) throw erroLinhas;
      const { error } = await supabase.from("resolucoes_sef").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resolucoes-sef"] });
      qc.invalidateQueries({ queryKey: ["indices-resolucao"] });
      qc.invalidateQueries({ queryKey: ["indice-aplicado"] });
      qc.invalidateQueries({ queryKey: ["resolucoes-carregadas"] });
    },
  });
}

/** Índices publicados de um município numa resolução cadastrada. */
export type IndiceDaResolucao = {
  municipio_nome: string;
  ano_a: number;
  indice_a: number | null;
  vaf_a: number | null;
  ano_b: number;
  indice_b: number | null;
  vaf_b: number | null;
  media_indices: number | null;
};

export function useIndiceDaResolucao(resolucaoNumero: string | null, municipioId: string | null) {
  return useQuery({
    queryKey: ["indice-da-resolucao", resolucaoNumero, municipioId],
    enabled: !!resolucaoNumero && !!municipioId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<IndiceDaResolucao | null> => {
      const { data, error } = await supabase
        .from("indices_resolucao")
        .select("municipio_nome, ano_a, indice_a, vaf_a, ano_b, indice_b, vaf_b, media_indices")
        .eq("resolucao", resolucaoNumero!)
        .eq("municipio_id", municipioId!)
        .limit(1);
      if (error) {
        if (ehErroPermissao(error)) return null;
        throw error;
      }
      return ((data ?? [])[0] as unknown as IndiceDaResolucao) ?? null;
    },
  });
}
