import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";

export type AnexoAcao = {
  id: string;
  municipio_id: string;
  referencia: string;
  acao_chave: string;
  inscricao_estadual: string;
  arquivo_path: string;
  arquivo_nome: string;
  tamanho: number | null;
  tipo_mime: string | null;
  descricao: string | null;
  criado_em: string;
};

/** Todos os anexos da análise (referência), agrupados no cliente por ação/contribuinte. */
export function useAnexosAcao(referencia: string | null) {
  const { municipioId } = useMunicipioAtivo();

  return useQuery({
    queryKey: ["acoes-anexos", municipioId, referencia],
    enabled: !!municipioId && !!referencia,
    queryFn: async (): Promise<AnexoAcao[]> => {
      const { data, error } = await supabase
        .from("acoes_recuperacao_anexos")
        .select("*")
        .eq("municipio_id", municipioId!)
        .eq("referencia", referencia!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AnexoAcao[];
    },
  });
}

function nomeSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
}

export type EnvioAnexo = {
  referencia: string;
  acaoChave: string;
  inscricaoEstadual?: string;
  arquivo: File;
  descricao?: string | null;
};

export function useEnviarAnexo() {
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      referencia,
      acaoChave,
      inscricaoEstadual = "",
      arquivo,
      descricao,
    }: EnvioAnexo) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      if (arquivo.size > 20 * 1024 * 1024) throw new Error("Arquivo maior que 20 MB.");
      const { data: sessao } = await supabase.auth.getUser();

      const caminho = `${municipioId}/acoes/${Date.now()}-${nomeSeguro(arquivo.name)}`;
      const up = await supabase.storage.from("uploads").upload(caminho, arquivo, {
        contentType: arquivo.type || "application/octet-stream",
      });
      if (up.error) throw up.error;

      const { error } = await supabase.from("acoes_recuperacao_anexos").insert({
        municipio_id: municipioId,
        referencia,
        acao_chave: acaoChave,
        inscricao_estadual: inscricaoEstadual,
        arquivo_path: caminho,
        arquivo_nome: arquivo.name,
        tamanho: arquivo.size,
        tipo_mime: arquivo.type || null,
        descricao: descricao ?? null,
        criado_por: sessao.user?.id ?? null,
      });
      if (error) {
        await supabase.storage.from("uploads").remove([caminho]);
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["acoes-anexos"] }),
  });
}

export function useExcluirAnexo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (anexo: AnexoAcao) => {
      const { error } = await supabase
        .from("acoes_recuperacao_anexos")
        .delete()
        .eq("id", anexo.id);
      if (error) throw error;
      await supabase.storage.from("uploads").remove([anexo.arquivo_path]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["acoes-anexos"] }),
  });
}

/** Abre o anexo em nova aba usando URL assinada temporária. */
export async function abrirAnexo(anexo: AnexoAcao): Promise<void> {
  const { data, error } = await supabase.storage
    .from("uploads")
    .createSignedUrl(anexo.arquivo_path, 300, { download: anexo.arquivo_nome });
  if (error || !data) throw error ?? new Error("Não foi possível gerar o link do anexo.");
  window.open(data.signedUrl, "_blank", "noopener");
}

export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
