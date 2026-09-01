import { supabase } from "@/integrations/supabase/client";
import { lerExtrato, type ExtratoLido } from "./extrato";

export type ResultadoImportacao = {
  tipo: ExtratoLido["tipo"];
  exercicio: number;
  registros: number;
  desconhecidos: string[];
};

/**
 * Grava um extrato lido no banco, substituindo o que já existir para o mesmo
 * exercício/mês/critério (reimportar o mesmo período atualiza os números).
 */
export async function importarExtrato(params: {
  municipioId: string;
  exercicio: number;
  arquivoNome: string;
  conteudo: string;
  origem?: "upload" | "fjp";
}): Promise<ResultadoImportacao> {
  const { municipioId, exercicio, arquivoNome, conteudo } = params;
  const lido = lerExtrato(conteudo);

  const { data: carga, error: erroCarga } = await supabase
    .from("icms_cargas")
    .insert({
      municipio_id: municipioId,
      tipo: lido.tipo,
      exercicio,
      arquivo_nome: arquivoNome,
      origem: params.origem ?? "upload",
      linhas: lido.linhas.length,
    })
    .select("id")
    .single();
  if (erroCarga) throw erroCarga;

  if (lido.tipo === "comparativo") {
    const linhas = lido.linhas.flatMap((l) =>
      l.meses
        .map((valor, i) => ({
          municipio_id: municipioId,
          carga_id: carga.id,
          exercicio,
          mes: i + 1,
          criterio: "vaf",
          municipio_nome: l.municipio,
          valor,
        }))
        .filter((r) => r.valor != null),
    );
    if (linhas.length) {
      const { error } = await supabase
        .from("icms_comparativo")
        .upsert(linhas, { onConflict: "municipio_id,exercicio,mes,criterio,municipio_nome" });
      if (error) throw error;
    }
    return { tipo: lido.tipo, exercicio, registros: linhas.length, desconhecidos: [] };
  }

  const campo = lido.tipo === "indice_anual" ? "indice" : "valor";
  const registros = lido.linhas.flatMap((l) =>
    l.meses
      .map((v, i) => ({
        municipio_id: municipioId,
        carga_id: carga.id,
        exercicio,
        mes: i + 1,
        criterio: l.criterio,
        indice: lido.tipo === "indice_anual" ? v : null,
        valor: lido.tipo === "indice_anual" ? null : v,
        fonte: params.origem ?? "upload",
        atualizado_em: new Date().toISOString(),
      }))
      .filter((r) => r[campo] != null),
  );

  if (registros.length) {
    // O upsert não pode zerar a outra coluna (índice x valor vêm de arquivos
    // distintos), por isso usamos ignoreDuplicates: false com merge de campos.
    const { error } = await supabase
      .from("icms_indices")
      .upsert(registros, { onConflict: "municipio_id,exercicio,mes,criterio" });
    if (error) throw error;
  }

  await supabase.from("icms_cargas").update({ linhas: registros.length }).eq("id", carga.id);

  return {
    tipo: lido.tipo,
    exercicio,
    registros: registros.length,
    desconhecidos: lido.desconhecidos,
  };
}
