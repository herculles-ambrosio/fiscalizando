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
  criado_em: string;
};

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
        periodo_inicio: a.periodoInicio,
        periodo_fim: a.periodoFim,
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
