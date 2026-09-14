import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dados do panorama comparativo entre municípios: índices apurados e as
 * providências (plano de recuperação, impugnações e ofícios) de cada um.
 * As consultas não filtram por município: a visibilidade já é decidida pelas
 * regras de acesso (consultoria vê todas as prefeituras, prefeitura vê a sua).
 */

export type IndicePanorama = {
  id: string;
  municipio_id: string;
  exercicio: number;
  tipo_indice: "provisorio" | "definitivo";
  competencia_mes: number | null;
  competencia_ano: number | null;
  estimado: boolean;
  indice: number;
  valor_liquido: number;
  vaf_proprio: number;
  credito_externo: number;
  credito_interno: number;
  credito_proprio: number;
  debito: number;
  vaf_estadual: number;
  arquivo_nome: string | null;
  criado_em: string;
};

export function useIndicesPanorama() {
  return useQuery({
    queryKey: ["panorama-indices"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<IndicePanorama[]> => {
      const { data, error } = await supabase
        .from("indices_apurados")
        .select(
          "id, municipio_id, exercicio, tipo_indice, competencia_mes, competencia_ano, estimado, indice, valor_liquido, vaf_proprio, credito_externo, credito_interno, credito_proprio, debito, vaf_estadual, arquivo_nome, criado_em",
        )
        .order("exercicio", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IndicePanorama[];
    },
  });
}

export type AcaoPanorama = {
  id: string;
  municipio_id: string;
  exercicio: number | null;
  status: string;
  valor_recuperavel: number;
  acao_titulo: string;
  inscricao_estadual: string;
  nome_contribuinte: string | null;
  cnpj: string | null;
  observacao: string | null;
  atualizado_em: string;
};

export function useAcoesPanorama() {
  return useQuery({
    queryKey: ["panorama-acoes"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AcaoPanorama[]> => {
      const { data, error } = await supabase
        .from("acoes_recuperacao")
        .select(
          "id, municipio_id, exercicio, status, valor_recuperavel, acao_titulo, inscricao_estadual, nome_contribuinte, cnpj, observacao, atualizado_em",
        );
      if (error) throw error;
      return (data ?? []) as unknown as AcaoPanorama[];
    },
  });
}

export type ImpugnacaoPanorama = {
  id: string;
  municipio_id: string;
  exercicio: number;
  ano_base: number | null;
  nome: string;
  status: string;
  protocolo_numero: string | null;
  protocolado_em: string | null;
  itens: ItemImpugnacao[] | null;
};

export function useImpugnacoesPanorama() {
  return useQuery({
    queryKey: ["panorama-impugnacoes"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ImpugnacaoPanorama[]> => {
      const { data, error } = await supabase
        .from("impugnacoes")
        .select(
          "id, municipio_id, exercicio, ano_base, nome, status, protocolo_numero, protocolado_em, itens",
        )
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ImpugnacaoPanorama[];
    },
  });
}

export type OficioPanorama = { municipio_id: string; exercicio: number };

export function useOficiosPanorama() {
  return useQuery({
    queryKey: ["panorama-oficios"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<OficioPanorama[]> => {
      const { data, error } = await supabase
        .from("oficios_emitidos")
        .select("municipio_id, exercicio");
      if (error) throw error;
      return (data ?? []) as unknown as OficioPanorama[];
    },
  });
}
