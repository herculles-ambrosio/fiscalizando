import { supabase } from "@/integrations/supabase/client";
import { lerExtrato, type ExtratoLido } from "./extrato";

export type ResultadoImportacao = {
  tipo: ExtratoLido["tipo"];
  exercicio: number;
  registros: number;
  desconhecidos: string[];
};

/**
 * Conteúdo guardado junto da carga para que ela possa ser recarregada depois
 * sem precisar do arquivo original nem de nova consulta ao portal.
 */
export type PayloadCarga = {
  tipo: "indice_anual" | "transferencia_anual" | "comparativo";
  indices?: { criterio: string; mes: number; indice: number | null; valor: number | null }[];
  comparativo?: {
    municipio_nome: string;
    mes: number;
    criterio: string;
    valor: number | null;
  }[];
};

async function salvarPayload(cargaId: string, payload: PayloadCarga) {
  await supabase
    .from("icms_cargas")
    .update({ payload: payload as unknown as Record<string, unknown> })
    .eq("id", cargaId);
}

/** Apaga cargas anteriores do mesmo tipo/exercício/origem (substituição). */
async function substituirAnteriores(params: {
  municipioId: string;
  exercicio: number;
  tipo: string;
  origem: string;
  manter?: string;
}) {
  let q = supabase
    .from("icms_cargas")
    .delete()
    .eq("municipio_id", params.municipioId)
    .eq("exercicio", params.exercicio)
    .eq("tipo", params.tipo)
    .eq("origem", params.origem);
  if (params.manter) q = q.neq("id", params.manter);
  await q;
}

/**
 * Regrava no banco os valores guardados numa carga já salva ("dar carga" de
 * novo no arquivo/sincronização que está na lista).
 */
export async function reaplicarCarga(cargaId: string): Promise<number> {
  const { data: carga, error } = await supabase
    .from("icms_cargas")
    .select("id, municipio_id, exercicio, tipo, origem, payload")
    .eq("id", cargaId)
    .single();
  if (error) throw error;
  const payload = carga.payload as PayloadCarga | null;
  if (!payload) {
    throw new Error("Esta carga foi feita antes da gravação dos dados e não pode ser recarregada.");
  }

  if (payload.tipo === "comparativo") {
    const linhas = (payload.comparativo ?? []).map((l) => ({
      municipio_id: carga.municipio_id,
      carga_id: carga.id,
      exercicio: carga.exercicio,
      mes: l.mes,
      criterio: l.criterio,
      municipio_nome: l.municipio_nome,
      valor: l.valor,
    }));
    if (!linhas.length) return 0;
    const { error: e } = await supabase
      .from("icms_comparativo")
      .upsert(linhas, { onConflict: "municipio_id,exercicio,mes,criterio,municipio_nome" });
    if (e) throw e;
    return linhas.length;
  }

  const linhas = (payload.indices ?? []).map((l) => ({
    municipio_id: carga.municipio_id,
    carga_id: carga.id,
    exercicio: carga.exercicio,
    mes: l.mes,
    criterio: l.criterio,
    indice: l.indice,
    valor: l.valor,
    fonte: carga.origem,
    atualizado_em: new Date().toISOString(),
  }));
  if (!linhas.length) return 0;
  const { error: e } = await supabase
    .from("icms_indices")
    .upsert(linhas, { onConflict: "municipio_id,exercicio,mes,criterio" });
  if (e) throw e;
  return linhas.length;
}

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
    await salvarPayload(carga.id, {
      tipo: "comparativo",
      comparativo: linhas.map((l) => ({
        municipio_nome: l.municipio_nome,
        mes: l.mes,
        criterio: l.criterio,
        valor: l.valor,
      })),
    });
    return { tipo: lido.tipo, exercicio, registros: linhas.length, desconhecidos: [] };
  }

  const ehIndice = lido.tipo === "indice_anual";

  // Índice e valor vêm de arquivos diferentes: preservamos a coluna que este
  // arquivo não traz, senão o upsert apagaria o que já estava gravado.
  const { data: existentes } = await supabase
    .from("icms_indices")
    .select("mes, criterio, indice, valor")
    .eq("municipio_id", municipioId)
    .eq("exercicio", exercicio);
  const anterior = new Map(
    (existentes ?? []).map((r) => [`${r.criterio}|${r.mes}`, r as { indice: number | null; valor: number | null }]),
  );

  const registros = lido.linhas.flatMap((l) =>
    l.meses.flatMap((v, i) => {
      if (v == null) return [];
      const antes = anterior.get(`${l.criterio}|${i + 1}`);
      return [
        {
          municipio_id: municipioId,
          carga_id: carga.id,
          exercicio,
          mes: i + 1,
          criterio: l.criterio,
          indice: ehIndice ? v : (antes?.indice ?? null),
          valor: ehIndice ? (antes?.valor ?? null) : v,
          fonte: params.origem ?? "upload",
          atualizado_em: new Date().toISOString(),
        },
      ];
    }),
  );

  if (registros.length) {
    const { error } = await supabase
      .from("icms_indices")
      .upsert(registros, { onConflict: "municipio_id,exercicio,mes,criterio" });
    if (error) throw error;
  }

  await supabase.from("icms_cargas").update({ linhas: registros.length }).eq("id", carga.id);
  await salvarPayload(carga.id, {
    tipo: lido.tipo,
    indices: registros.map((r) => ({
      criterio: r.criterio,
      mes: r.mes,
      indice: r.indice,
      valor: r.valor,
    })),
  });

  return {
    tipo: lido.tipo,
    exercicio,
    registros: registros.length,
    desconhecidos: lido.desconhecidos,
  };
}

export type RegistroRobinHood = {
  criterio: string;
  mes: number;
  indice: number | null;
  valor: number | null;
};

/**
 * Grava os índices/valores coletados direto do portal Robin Hood.
 * Mantém o que já existia na coluna que a coleta não trouxe.
 */
export async function importarColetaRobinHood(params: {
  municipioId: string;
  exercicio: number;
  registros: RegistroRobinHood[];
  rotulo: string;
}): Promise<number> {
  const { municipioId, exercicio, registros } = params;
  if (!registros.length) return 0;

  const { data: carga, error: erroCarga } = await supabase
    .from("icms_cargas")
    .insert({
      municipio_id: municipioId,
      tipo: "indice_anual",
      exercicio,
      arquivo_nome: params.rotulo,
      origem: "fjp",
      linhas: registros.length,
    })
    .select("id")
    .single();
  if (erroCarga) throw erroCarga;

  const { data: existentes } = await supabase
    .from("icms_indices")
    .select("mes, criterio, indice, valor")
    .eq("municipio_id", municipioId)
    .eq("exercicio", exercicio);
  const anterior = new Map(
    (existentes ?? []).map((r) => [
      `${r.criterio}|${r.mes}`,
      r as { indice: number | null; valor: number | null },
    ]),
  );

  const linhas = registros.map((r) => {
    const antes = anterior.get(`${r.criterio}|${r.mes}`);
    return {
      municipio_id: municipioId,
      carga_id: carga.id,
      exercicio,
      mes: r.mes,
      criterio: r.criterio,
      indice: r.indice ?? antes?.indice ?? null,
      valor: r.valor ?? antes?.valor ?? null,
      fonte: "fjp",
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("icms_indices")
    .upsert(linhas, { onConflict: "municipio_id,exercicio,mes,criterio" });
  if (error) throw error;

  return linhas.length;
}

/**
 * Grava no comparativo os valores coletados direto do portal Robin Hood
 * para vários municípios de uma vez.
 */
export async function importarComparativoFjp(params: {
  municipioId: string;
  exercicio: number;
  resultados: {
    nome: string;
    registros: { criterio: string; mes: number; valor: number | null }[];
  }[];
}): Promise<number> {
  const { municipioId, exercicio } = params;

  const linhas = params.resultados.flatMap((r) =>
    r.registros
      .filter((x) => x.valor != null)
      .map((x) => ({
        municipio_id: municipioId,
        exercicio,
        mes: x.mes,
        criterio: x.criterio,
        municipio_nome: r.nome,
        valor: x.valor,
      })),
  );
  if (!linhas.length) return 0;

  const { data: carga, error: erroCarga } = await supabase
    .from("icms_cargas")
    .insert({
      municipio_id: municipioId,
      tipo: "comparativo",
      exercicio,
      arquivo_nome: `Portal Robin Hood — comparativo ${exercicio} (${params.resultados.length} municípios)`,
      origem: "fjp",
      linhas: linhas.length,
    })
    .select("id")
    .single();
  if (erroCarga) throw erroCarga;

  const comCarga = linhas.map((l) => ({ ...l, carga_id: carga.id }));
  const { error } = await supabase
    .from("icms_comparativo")
    .upsert(comCarga, { onConflict: "municipio_id,exercicio,mes,criterio,municipio_nome" });
  if (error) throw error;

  return comCarga.length;
}
