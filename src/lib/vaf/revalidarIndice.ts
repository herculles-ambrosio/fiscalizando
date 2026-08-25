import { supabase } from "@/integrations/supabase/client";
import { decodificarArquivo } from "./parser";
import { apurarIndice, estimarIndiceProvisorio, possuiIndice } from "./indice";
import type { DetalhamentoIndice, IndiceSalvo } from "@/hooks/useIndicesHistorico";

type CargaRetorno = {
  id: string;
  municipio_id: string;
  exercicio: number;
  tipo_retorno: string | null;
  competencia_mes: number | null;
  arquivo_retorno_path: string | null;
};

/** Cargas do município que ainda têm o arquivo de retorno guardado. */
export async function cargasComRetorno(municipioId: string): Promise<CargaRetorno[]> {
  const { data, error } = await supabase
    .from("cargas")
    .select("id, municipio_id, exercicio, tipo_retorno, competencia_mes, arquivo_retorno_path")
    .eq("municipio_id", municipioId)
    .not("arquivo_retorno_path", "is", null)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CargaRetorno[];
}

/**
 * Localiza a carga que originou o índice: pelo vínculo direto e, na falta dele,
 * pelo mesmo exercício + tipo de retorno equivalente ao tipo do índice.
 */
export function cargaDeOrigem(r: IndiceSalvo, cargas: CargaRetorno[]): CargaRetorno | null {
  if (r.carga_id) {
    const vinculada = cargas.find((c) => c.id === r.carga_id);
    if (vinculada?.arquivo_retorno_path) return vinculada;
  }

  const doExercicio = cargas.filter((c) => c.exercicio === r.exercicio && c.arquivo_retorno_path);

  if (r.tipo_indice === "definitivo") {
    return (
      doExercicio.find((c) => c.tipo_retorno === "indice_definitivo") ??
      doExercicio.find((c) => c.competencia_mes === 13) ??
      null
    );
  }

  // provisório veio de retorno mensal — prefere a mesma remessa, senão a mais recente
  return (
    doExercicio.find(
      (c) => r.competencia_mes != null && c.competencia_mes === r.competencia_mes,
    ) ??
    doExercicio.find((c) => c.tipo_retorno === "mensal") ??
    null
  );
}

/** true quando o detalhamento pode ser reconstruído sozinho a partir do armazenamento. */
export function podeRevalidar(r: IndiceSalvo, cargas: CargaRetorno[]): boolean {
  return !r.detalhamento_path && !!cargaDeOrigem(r, cargas);
}

/**
 * Reconstrói o detalhamento (créditos externos, entre municípios, contribuintes
 * e SIMEI) reprocessando o arquivo de retorno guardado e o grava no
 * armazenamento, vinculando ao registro do histórico.
 *
 * A aba "Crédito próprio" vinda da planilha do Portal do VAF não é
 * reconstruível: o CSV não é guardado no sistema.
 */
export async function revalidarDetalhamento(
  r: IndiceSalvo,
  cargas: CargaRetorno[],
): Promise<DetalhamentoIndice> {
  const carga = cargaDeOrigem(r, cargas);
  if (!carga?.arquivo_retorno_path) {
    throw new Error("O arquivo de retorno deste índice não está guardado no sistema.");
  }

  const { data, error } = await supabase.storage
    .from("uploads")
    .download(carga.arquivo_retorno_path);
  if (error || !data) {
    throw error ?? new Error("Arquivo de retorno não encontrado no armazenamento.");
  }

  const texto = decodificarArquivo(await data.arrayBuffer());
  const a = possuiIndice(texto)
    ? apurarIndice(texto)
    : r.tipo_indice === "provisorio"
      ? estimarIndiceProvisorio(texto, {
          vafEstadualReferencia: Number(r.vaf_estadual) || 0,
          fatorCalibragem: Number(r.fator_calibragem) || 1,
        })
      : null;

  if (!a) {
    throw new Error("O arquivo guardado não contém os registros de apuração do índice.");
  }

  const detalhe: DetalhamentoIndice = {
    creditosExternos: a.creditosExternos,
    creditosPorMunicipio: a.creditosPorMunicipio,
    debitosPorMunicipio: a.debitosPorMunicipio,
    contribuintesVaf: a.contribuintesVaf,
    simei: a.simei,
  };

  const path = `${r.municipio_id}/indices/${r.id}.json`;
  const { error: erroUpload } = await supabase.storage
    .from("uploads")
    .upload(path, new Blob([JSON.stringify(detalhe)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (erroUpload) throw erroUpload;

  const { error: erroVinculo } = await supabase
    .from("indices_apurados")
    .update({ detalhamento_path: path })
    .eq("id", r.id);
  if (erroVinculo) throw erroVinculo;

  return detalhe;
}

export type { CargaRetorno };
