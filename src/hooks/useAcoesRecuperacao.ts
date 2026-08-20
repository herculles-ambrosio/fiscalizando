import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";

export const STATUS_ACAO = [
  "prevista",
  "oficio_enviado",
  "resposta_recebida",
  "concluida",
  "sem_efeito",
] as const;

export type StatusAcao = (typeof STATUS_ACAO)[number];

export const ROTULO_STATUS_ACAO: Record<StatusAcao, string> = {
  prevista: "Prevista",
  oficio_enviado: "Ofício enviado",
  resposta_recebida: "Resposta recebida",
  concluida: "Concluída",
  sem_efeito: "Sem efeito",
};

export const CORES_STATUS_ACAO: Record<StatusAcao, string> = {
  prevista: "border-border bg-muted text-muted-foreground",
  oficio_enviado: "border-primary/40 bg-primary/10 text-primary",
  resposta_recebida: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  concluida: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  sem_efeito: "border-border bg-muted text-muted-foreground line-through",
};

export type AcaoRegistro = {
  id: string;
  municipio_id: string;
  carga_id: string | null;
  referencia: string;
  exercicio: number | null;
  acao_chave: string;
  acao_titulo: string;
  inscricao_estadual: string;
  nome_contribuinte: string | null;
  cnpj: string | null;
  valor_recuperavel: number;
  status: StatusAcao;
  observacao: string | null;
  oficio_enviado_em: string | null;
  resposta_em: string | null;
  concluida_em: string | null;
  atualizado_em: string;
};

/** Chave local usada nos mapas de status: ação + contribuinte ("" = ação inteira). */
export function chaveStatus(acaoChave: string, inscricao = ""): string {
  return `${acaoChave}::${inscricao}`;
}

export function useAcoesRecuperacao(referencia: string | null) {
  const { municipioId } = useMunicipioAtivo();

  return useQuery({
    queryKey: ["acoes-recuperacao", municipioId, referencia],
    enabled: !!municipioId && !!referencia,
    queryFn: async (): Promise<AcaoRegistro[]> => {
      const { data, error } = await supabase
        .from("acoes_recuperacao")
        .select("*")
        .eq("municipio_id", municipioId!)
        .eq("referencia", referencia!);
      if (error) throw error;
      return (data ?? []) as unknown as AcaoRegistro[];
    },
  });
}

export type EntradaStatus = {
  referencia: string;
  cargaId?: string | null;
  exercicio?: number | null;
  acaoChave: string;
  acaoTitulo: string;
  inscricaoEstadual?: string;
  nomeContribuinte?: string | null;
  cnpj?: string | null;
  valorRecuperavel?: number;
  status: StatusAcao;
  observacao?: string | null;
};

function carimbos(status: StatusAcao) {
  const agora = new Date().toISOString();
  return {
    oficio_enviado_em: status === "oficio_enviado" ? agora : null,
    resposta_em: status === "resposta_recebida" ? agora : null,
    concluida_em: status === "concluida" ? agora : null,
  };
}

export function useSalvarStatusAcao() {
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entradas: EntradaStatus | EntradaStatus[]) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const lista = Array.isArray(entradas) ? entradas : [entradas];
      if (!lista.length) return;
      const { data: sessao } = await supabase.auth.getUser();

      const linhas = lista.map((e) => ({
        municipio_id: municipioId,
        carga_id: e.cargaId ?? null,
        referencia: e.referencia,
        exercicio: e.exercicio ?? null,
        acao_chave: e.acaoChave,
        acao_titulo: e.acaoTitulo,
        inscricao_estadual: e.inscricaoEstadual ?? "",
        nome_contribuinte: e.nomeContribuinte ?? null,
        cnpj: e.cnpj ?? null,
        valor_recuperavel: e.valorRecuperavel ?? 0,
        status: e.status,
        observacao: e.observacao ?? null,
        atualizado_por: sessao.user?.id ?? null,
        ...carimbos(e.status),
      }));

      const { error } = await supabase
        .from("acoes_recuperacao")
        .upsert(linhas, {
          onConflict: "municipio_id,referencia,acao_chave,inscricao_estadual",
        });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["acoes-recuperacao"] }),
  });
}
