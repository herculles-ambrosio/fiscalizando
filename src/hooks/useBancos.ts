/** Dados do módulo Fiscaliza Banco, sempre da prefeitura ativa. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useMunicipioAtivo } from "./useMunicipio";
import { MODELOS_BANCO_PADRAO, type ModeloBanco } from "@/lib/bancos/notificacoes";
import { PLANO_PADRAO, type ContaCfg } from "@/lib/bancos/conferencia";

type Tabela = "bancos_instituicoes" | "bancos_contas_cosif" | "bancos_declaracoes" | "bancos_estban" | "bancos_ifdata" | "bancos_modelos" | "bancos_notificacoes";

function useTabela<T>(tabela: Tabela) {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: [tabela, municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<T[]> => {
      const todas: T[] = [];
      for (let i = 0; i < 200000; i += 1000) {
        const { data, error } = await supabase.from(tabela).select("*").eq("municipio_id", municipioId!).order("criado_em").range(i, i + 999);
        if (error) throw error;
        todas.push(...((data ?? []) as unknown as T[]));
        if (!data || data.length < 1000) break;
      }
      return todas;
    },
  });
}

export type Instituicao = Tables<"bancos_instituicoes">;
export type DeclaracaoGravada = Tables<"bancos_declaracoes">;
export type EstbanGravado = Tables<"bancos_estban">;
export type IfdataGravado = Tables<"bancos_ifdata">;

export const useInstituicoes = () => useTabela<Instituicao>("bancos_instituicoes");
export const useDeclaracoesBanco = () => useTabela<DeclaracaoGravada>("bancos_declaracoes");
export const useEstban = () => useTabela<EstbanGravado>("bancos_estban");
export const useIfdata = () => useTabela<IfdataGravado>("bancos_ifdata");
export const useHistoricoBancos = () => useTabela<Tables<"bancos_notificacoes">>("bancos_notificacoes");

export function usePlanoContas() {
  const q = useTabela<Tables<"bancos_contas_cosif">>("bancos_contas_cosif");
  const plano: ContaCfg[] = q.data?.length
    ? q.data.map((c) => ({ conta: c.conta, descricao: c.descricao, item_lc116: c.item_lc116, aliquota: Number(c.aliquota), tributavel: c.tributavel }))
    : PLANO_PADRAO;
  return { ...q, plano, padrao: !q.data?.length };
}

export function useModelosBanco() {
  const q = useTabela<ModeloBanco>("bancos_modelos");
  const salvos = q.data ?? [];
  const chaves = new Set(salvos.map((m) => m.chave));
  const modelos = [...salvos, ...MODELOS_BANCO_PADRAO.filter((m) => !chaves.has(m.chave))].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { ...q, modelos };
}

/** Grava/atualiza/apaga linhas de uma tabela do módulo e recarrega a tela. */
export function useGravarBancos(tabela: Tabela) {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (acao: { upsert?: Record<string, unknown>[]; onConflict?: string; insert?: Record<string, unknown>[]; excluirIds?: string[]; excluirFiltro?: Record<string, unknown> }) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const com = (l: Record<string, unknown>[]) => l.map((x) => ({ ...x, municipio_id: municipioId }));
      if (acao.excluirIds?.length) {
        const { error } = await supabase.from(tabela).delete().eq("municipio_id", municipioId).in("id", acao.excluirIds);
        if (error) throw error;
      }
      if (acao.excluirFiltro) {
        let q = supabase.from(tabela).delete().eq("municipio_id", municipioId);
        for (const [k, v] of Object.entries(acao.excluirFiltro)) q = q.eq(k, v as never);
        const { error } = await q;
        if (error) throw error;
      }
      for (const lote of chunk(acao.insert ?? [], 500)) {
        const { error } = await supabase.from(tabela).insert(com(lote) as never);
        if (error) throw error;
      }
      for (const lote of chunk(acao.upsert ?? [], 500)) {
        const { error } = await supabase.from(tabela).upsert(com(lote) as never, acao.onConflict ? { onConflict: acao.onConflict } : undefined);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [tabela] }),
  });
}

function chunk<T>(l: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < l.length; i += n) out.push(l.slice(i, i + n));
  return out;
}
