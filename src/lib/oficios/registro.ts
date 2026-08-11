import { supabase } from "@/integrations/supabase/client";
import type { ContribuinteOficio } from "./zerados";
import type { ModeloOficio } from "./modelos";

export type StatusDownload = "gerado" | "baixado" | "erro";

export type EmissaoRegistro = {
  id: string;
  municipio_id: string;
  carga_id: string | null;
  contribuinte_id: string | null;
  inscricao_estadual: string;
  cnpj: string | null;
  nome_contribuinte: string | null;
  exercicio: number;
  modelo_chave: string;
  modelo_nome: string;
  situacao: string;
  tipo_emissao: string;
  arquivo_nome: string | null;
  status_download: StatusDownload;
  erro_mensagem: string | null;
  emitido_por: string | null;
  emitido_por_nome: string | null;
  criado_em: string;
  baixado_em: string | null;
};

type Alvo = ContribuinteOficio & { id?: string | undefined };

async function autor(): Promise<{ id: string | null; nome: string | null }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { id: null, nome: null };
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();
  return { id: user.id, nome: perfil?.nome ?? user.email ?? null };
}

/** Grava uma linha de histórico por contribuinte, com status inicial "gerado". */
export async function registrarEmissoes(params: {
  contribuintes: Alvo[];
  modelo: ModeloOficio;
  municipioId: string;
  cargaId?: string | null;
  exercicio: number;
  tipo: "individual" | "lote";
  arquivoNome?: string | null;
}): Promise<string[]> {
  const { contribuintes, modelo, municipioId, cargaId, exercicio, tipo, arquivoNome } = params;
  if (!contribuintes.length || !municipioId) return [];
  const { id: emitidoPor, nome } = await autor();
  if (!emitidoPor) return [];

  const linhas = contribuintes.map((c) => ({
    municipio_id: municipioId,
    carga_id: cargaId ?? null,
    contribuinte_id: c.id ?? null,
    inscricao_estadual: c.inscricao_estadual,
    cnpj: c.cnpj ?? null,
    nome_contribuinte: c.nome ?? null,
    exercicio,
    modelo_chave: modelo.chave,
    modelo_nome: modelo.nome,
    situacao: modelo.situacao,
    tipo_emissao: tipo,
    arquivo_nome: arquivoNome ?? null,
    status_download: "gerado",
    emitido_por: emitidoPor,
    emitido_por_nome: nome,
  }));

  const { data, error } = await supabase.from("oficios_emitidos").insert(linhas).select("id");
  if (error) {
    console.error("Falha ao registrar histórico de ofícios", error);
    return [];
  }
  return (data ?? []).map((d) => d.id as string);
}

export async function marcarStatusEmissoes(
  ids: string[],
  status: StatusDownload,
  erro?: string,
): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from("oficios_emitidos")
    .update({
      status_download: status,
      baixado_em: status === "baixado" ? new Date().toISOString() : null,
      erro_mensagem: erro ?? null,
    })
    .in("id", ids);
  if (error) console.error("Falha ao atualizar status do ofício", error);
}

export const ROTULO_STATUS_DOWNLOAD: Record<StatusDownload, string> = {
  gerado: "Gerado",
  baixado: "Baixado",
  erro: "Falha",
};
