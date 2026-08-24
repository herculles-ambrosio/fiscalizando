import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ApuracaoIndice } from "@/lib/vaf/indice";

export type IndiceSalvo = {
  id: string;
  municipio_id: string;
  carga_id: string | null;
  exercicio: number;
  competencia_mes: number | null;
  competencia_ano: number | null;
  tipo_indice: "provisorio" | "definitivo";
  estimado: boolean;
  origem_vaf_estadual: string | null;
  fator_calibragem: number;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  vaf_proprio: number;
  credito_externo: number;
  credito_interno: number;
  credito_proprio: number;
  debito: number;
  acerto_credito: number;
  acerto_debito: number;
  valor_liquido: number;
  indice: number;
  vaf_estadual: number;
  total_declaracoes: number;
  arquivo_nome: string | null;
  /** "arquivo" (retorno da SEF) ou "planilha" (Portal do VAF) */
  origem_credito_proprio: string | null;
  /** nome do CSV do Portal do VAF usado na projeção */
  arquivo_credito_proprio: string | null;
  /** arquivo JSON no bucket "uploads" com o detalhamento completo da apuração */
  detalhamento_path: string | null;
  criado_em: string;
};

/** Listas de detalhamento gravadas junto com o índice (bucket "uploads"). */
export type DetalhamentoIndice = {
  creditosExternos?: ApuracaoIndice["creditosExternos"];
  creditosPorMunicipio?: ApuracaoIndice["creditosPorMunicipio"];
  debitosPorMunicipio?: ApuracaoIndice["debitosPorMunicipio"];
  contribuintesVaf?: ApuracaoIndice["contribuintesVaf"];
  simei?: ApuracaoIndice["simei"];
  planilha?: unknown;
};

/** Baixa o detalhamento salvo de um índice do histórico. */
export async function baixarDetalhamento(path: string): Promise<DetalhamentoIndice | null> {
  const { data, error } = await supabase.storage.from("uploads").download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text()) as DetalhamentoIndice;
  } catch {
    return null;
  }
}

/**
 * Reconstrói uma apuração de índice a partir do registro salvo, para
 * reabrir o cálculo na tela sem precisar do arquivo original.
 * O detalhamento por município/contribuinte não é armazenado.
 */
export function apuracaoDoHistorico(r: IndiceSalvo, codigoMunicipio: string): ApuracaoIndice {
  return {
    tipoIndice: r.tipo_indice,
    estimado: r.estimado,
    ...(r.origem_vaf_estadual === "arquivo" || r.origem_vaf_estadual === "referencia"
      ? { origemVafEstadual: r.origem_vaf_estadual }
      : {}),
    fatorCalibragem: Number(r.fator_calibragem) || 1,
    codigoMunicipio,
    anoBase: r.exercicio,
    periodoInicio: r.periodo_inicio,
    periodoFim: r.periodo_fim,
    vafProprio: Number(r.vaf_proprio),
    creditoExterno: Number(r.credito_externo),
    creditoInterno: Number(r.credito_interno),
    creditoProprio: Number(r.credito_proprio),
    origemCreditoProprio:
      r.origem_credito_proprio === "planilha" ? "planilha" : "arquivo",
    ...(r.arquivo_credito_proprio ? { arquivoCreditoProprio: r.arquivo_credito_proprio } : {}),
    debito: Number(r.debito),
    acertoCredito: Number(r.acerto_credito),
    acertoDebito: Number(r.acerto_debito),
    valorLiquido: Number(r.valor_liquido),
    indice: Number(r.indice),
    vafEstadual: Number(r.vaf_estadual),
    creditoProprioAf: 0,
    creditoProprioSiare: 0,
    creditosExternos: [],
    creditosPorMunicipio: [],
    debitosPorMunicipio: [],
    contribuintesVaf: [],
    simei: [],
    totalDeclaracoes: r.total_declaracoes,
  };
}

export function useIndicesSalvos(municipioId: string | null) {
  return useQuery({
    queryKey: ["indices-salvos", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<IndiceSalvo[]> => {
      const { data, error } = await supabase
        .from("indices_apurados")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("exercicio", { ascending: false })
        .order("competencia_ano", { ascending: false, nullsFirst: false })
        .order("competencia_mes", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as IndiceSalvo[];
    },
  });
}

export type DadosSalvarIndice = {
  municipioId: string;
  apuracao: ApuracaoIndice;
  exercicio: number;
  competenciaMes: number | null;
  competenciaAno: number | null;
  arquivoNome: string | null;
};

/** Salva (ou substitui) a apuração de índice no histórico do município. */
export function useSalvarIndice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosSalvarIndice) => {
      const { data: userData } = await supabase.auth.getUser();
      const a = d.apuracao;
      // retornos mensais podem trazer período vazio/zerado — só grava data ISO válida
      const dataValida = (v: string | null | undefined) =>
        v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;

      // vincula à carga mensal da mesma competência, quando existir
      let cargaId: string | null = null;
      if (d.competenciaMes && d.competenciaAno) {
        const { data: carga } = await supabase
          .from("cargas")
          .select("id")
          .eq("municipio_id", d.municipioId)
          .eq("competencia_mes", d.competenciaMes)
          .eq("competencia_ano", d.competenciaAno)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        cargaId = carga?.id ?? null;
      }

      const registro = {
        municipio_id: d.municipioId,
        carga_id: cargaId,
        exercicio: d.exercicio,
        competencia_mes: d.competenciaMes,
        competencia_ano: d.competenciaAno,
        tipo_indice: a.tipoIndice,
        estimado: !!a.estimado,
        origem_vaf_estadual: a.origemVafEstadual ?? null,
        fator_calibragem: a.fatorCalibragem ?? 1,
        periodo_inicio: dataValida(a.periodoInicio),
        periodo_fim: dataValida(a.periodoFim),
        vaf_proprio: a.vafProprio,
        credito_externo: a.creditoExterno,
        credito_interno: a.creditoInterno,
        credito_proprio: a.creditoProprio,
        debito: a.debito,
        acerto_credito: a.acertoCredito,
        acerto_debito: a.acertoDebito,
        valor_liquido: a.valorLiquido,
        indice: a.indice,
        vaf_estadual: a.vafEstadual,
        total_declaracoes: a.totalDeclaracoes,
        arquivo_nome: d.arquivoNome,
        origem_credito_proprio: a.origemCreditoProprio ?? "arquivo",
        arquivo_credito_proprio: a.arquivoCreditoProprio ?? null,
        criado_por: userData.user?.id ?? null,
      };

      let consulta = supabase
        .from("indices_apurados")
        .select("id")
        .eq("municipio_id", d.municipioId)
        .eq("exercicio", d.exercicio)
        .eq("tipo_indice", a.tipoIndice);
      consulta = d.competenciaMes
        ? consulta.eq("competencia_mes", d.competenciaMes)
        : consulta.is("competencia_mes", null);
      consulta = d.competenciaAno
        ? consulta.eq("competencia_ano", d.competenciaAno)
        : consulta.is("competencia_ano", null);

      const { data: existente, error: erroBusca } = await consulta.maybeSingle();
      if (erroBusca) throw erroBusca;

      if (existente) {
        const { error } = await supabase
          .from("indices_apurados")
          .update(registro)
          .eq("id", existente.id);
        if (error) throw error;
        return { substituido: true };
      }

      const { error } = await supabase.from("indices_apurados").insert(registro);
      if (error) throw error;
      return { substituido: false };
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["indices-salvos", vars.municipioId] });
    },
  });
}

export function useExcluirIndice(municipioId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("indices_apurados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indices-salvos", municipioId] });
    },
  });
}
