import { supabase } from "@/integrations/supabase/client";
import { apurar, type OpcoesApuracao } from "./apurar";
import { decodificarArquivo } from "./parser";
import type { TipoRetorno } from "./tipoRetorno";

export type ProgressoEtapa = {
  etapa: string;
  percentual: number;
};

const TAMANHO_LOTE = 500;

async function lerArquivo(file: File): Promise<string> {
  return decodificarArquivo(await file.arrayBuffer());
}

export async function processarApuracao(params: {
  municipioId: string;
  usuarioId: string;
  arquivoAtivos: File;
  arquivoRetorno: File;
  opcoes: OpcoesApuracao;
  tipoRetorno?: TipoRetorno;
  mesReferencia?: number | null;
  competenciaMes?: number | null;
  competenciaAno?: number | null;
  competenciaMotivo?: string | null;
  competenciaDetectadaMes?: number | null;
  competenciaDetectadaAno?: number | null;
  onProgresso?: (p: ProgressoEtapa) => void;
}): Promise<string> {
  const {
    municipioId,
    usuarioId,
    arquivoAtivos,
    arquivoRetorno,
    opcoes,
    tipoRetorno = "mensal",
    mesReferencia = null,
    competenciaMes = null,
    competenciaAno = null,
    competenciaMotivo = null,
    competenciaDetectadaMes = null,
    competenciaDetectadaAno = null,
    onProgresso,
  } = params;
  const progresso = onProgresso ?? (() => {});


  progresso({ etapa: "Lendo arquivos", percentual: 5 });
  const [textoAtivos, textoRetorno] = await Promise.all([
    lerArquivo(arquivoAtivos),
    lerArquivo(arquivoRetorno),
  ]);

  progresso({ etapa: "Apurando contribuintes", percentual: 15 });
  const resultado = apurar(textoAtivos, textoRetorno, opcoes);

  const dataLimite = opcoes.dataLimiteEntrega || `${resultado.exercicio + 1}-05-31`;

  const { data: carga, error: erroCarga } = await supabase
    .from("cargas")
    .insert({
      municipio_id: municipioId,
      exercicio: resultado.exercicio,
      status: "processando",
      limiar_discrepancia: opcoes.limiarDiscrepancia ?? 0.3,
      data_limite_entrega: dataLimite,
      criado_por: usuarioId,
      tipo_retorno: tipoRetorno,
      mes_referencia: mesReferencia,
      competencia_mes: competenciaMes ?? (tipoRetorno === "mensal" ? mesReferencia : null),
      competencia_ano: competenciaAno ?? resultado.exercicio,
      competencia_detectada_mes: competenciaDetectadaMes,
      competencia_detectada_ano: competenciaDetectadaAno,
      competencia_ajustada: Boolean(competenciaMotivo?.trim()),
      competencia_motivo: competenciaMotivo?.trim() || null,
      competencia_ajustada_por: competenciaMotivo?.trim() ? usuarioId : null,
      competencia_ajustada_em: competenciaMotivo?.trim() ? new Date().toISOString() : null,
    })

    .select("id")
    .single();
  if (erroCarga || !carga) throw erroCarga ?? new Error("Não foi possível criar a carga.");

  const cargaId = carga.id;

  try {
    progresso({ etapa: "Enviando arquivos", percentual: 25 });
    const baseCaminho = `${municipioId}/${cargaId}`;
    const caminhoAtivos = `${baseCaminho}/ativos.txt`;
    const caminhoRetorno = `${baseCaminho}/retorno.txt`;
    const up1 = await supabase.storage.from("uploads").upload(caminhoAtivos, arquivoAtivos);
    if (up1.error) throw up1.error;
    const up2 = await supabase.storage.from("uploads").upload(caminhoRetorno, arquivoRetorno);
    if (up2.error) throw up2.error;

    await supabase
      .from("cargas")
      .update({ arquivo_ativos_path: caminhoAtivos, arquivo_retorno_path: caminhoRetorno })
      .eq("id", cargaId);

    const linhas = resultado.contribuintes.map((c) => ({
      carga_id: cargaId,
      municipio_id: municipioId,
      inscricao_estadual: c.inscricao_estadual,
      cnpj: c.cnpj,
      nome: c.nome,
      endereco: c.endereco,
      cnae: c.cnae,
      entregou_declaracao: c.entregou_declaracao,
      vaf_atual: c.vaf_atual,
      vaf_anterior: c.vaf_anterior,
      variacao_pct: c.variacao_pct,
      data_entrega: c.data_entrega,
      regime_recolhimento: c.regime_recolhimento,
      situacoes: c.situacoes,
      situacao_cadastral: c.situacao_cadastral,
      situacao_cadastral_data: c.situacao_cadastral_data,
      mes_inicio_atividade: c.mes_inicio_atividade,
      mes_fim_atividade: c.mes_fim_atividade,
    }));

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
      const lote = linhas.slice(i, i + TAMANHO_LOTE);
      const { error } = await supabase.from("contribuintes_apurados").insert(lote);
      if (error) throw error;
      const pct = 30 + Math.round(((i + lote.length) / Math.max(linhas.length, 1)) * 65);
      progresso({
        etapa: `Gravando contribuintes (${Math.min(i + TAMANHO_LOTE, linhas.length)}/${linhas.length})`,
        percentual: pct,
      });
    }

    const { error: erroFinal } = await supabase
      .from("cargas")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
        total_ativos: resultado.totais.ativos,
        total_omissos: resultado.totais.omisso,
        total_zerados: resultado.totais.zerado,
        total_fora_prazo: resultado.totais.fora_do_prazo,
        total_discrepantes: resultado.totais.discrepante,
        total_normais: resultado.totais.normal,
        total_simples_nacional: resultado.totais.simples_nacional,
        total_simei: resultado.totais.simei,
      })
      .eq("id", cargaId);
    if (erroFinal) throw erroFinal;

    progresso({ etapa: "Concluída", percentual: 100 });
    return cargaId;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida no processamento.";
    await supabase
      .from("cargas")
      .update({ status: "erro", mensagem_erro: mensagem })
      .eq("id", cargaId);
    throw erro;
  }
}
