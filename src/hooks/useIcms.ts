import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import { CRITERIO_POR_SLUG } from "@/lib/icms/criterios";
import { reaplicarCarga } from "@/lib/icms/importar";

export type RegistroIndice = {
  criterio: string;
  mes: number;
  indice: number | null;
  valor: number | null;
  fonte: string;
};

export type SerieCriterio = {
  criterio: string;
  /** índice por mês (0 = janeiro) */
  indices: (number | null)[];
  /** valor em R$ por mês */
  valores: (number | null)[];
  totalValor: number;
  /** último mês com índice informado */
  ultimoIndice: number | null;
  indiceAnterior: number | null;
};

export type DadosIcms = {
  series: Map<string, SerieCriterio>;
  meses: number[];
  ultimoMes: number | null;
  totalAno: number;
};

const vazio: DadosIcms = { series: new Map(), meses: [], ultimoMes: null, totalAno: 0 };

export function useIcmsExercicios() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-exercicios", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("icms_indices")
        .select("exercicio")
        .eq("municipio_id", municipioId!);
      if (error) throw error;
      const anos = [...new Set((data ?? []).map((d) => d.exercicio as number))];
      return anos.sort((a, b) => b - a);
    },
  });
}

export function useIcmsDados(exercicio: number | null) {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-dados", municipioId, exercicio],
    enabled: !!municipioId && !!exercicio,
    queryFn: async (): Promise<DadosIcms> => {
      const { data, error } = await supabase
        .from("icms_indices")
        .select("criterio, mes, indice, valor, fonte")
        .eq("municipio_id", municipioId!)
        .eq("exercicio", exercicio!);
      if (error) throw error;
      const registros = (data ?? []) as RegistroIndice[];
      if (!registros.length) return vazio;

      const series = new Map<string, SerieCriterio>();
      const mesesComDado = new Set<number>();
      for (const r of registros) {
        let s = series.get(r.criterio);
        if (!s) {
          s = {
            criterio: r.criterio,
            indices: new Array(12).fill(null),
            valores: new Array(12).fill(null),
            totalValor: 0,
            ultimoIndice: null,
            indiceAnterior: null,
          };
          series.set(r.criterio, s);
        }
        s.indices[r.mes - 1] = r.indice ?? null;
        s.valores[r.mes - 1] = r.valor ?? null;
        if (r.indice != null || r.valor != null) mesesComDado.add(r.mes);
      }

      let totalAno = 0;
      for (const s of series.values()) {
        s.totalValor = s.valores.reduce<number>((a, v) => a + (v ?? 0), 0);
        const comIndice = s.indices
          .map((v, i) => ({ v, i }))
          .filter((x) => x.v != null)
          .map((x) => x.v as number);
        s.ultimoIndice = comIndice.at(-1) ?? null;
        s.indiceAnterior = comIndice.length > 1 ? (comIndice.at(-2) ?? null) : null;
        const cat = CRITERIO_POR_SLUG.get(s.criterio);
        if (!cat?.agregado && !cat?.paiSlug) totalAno += s.totalValor;
      }

      const meses = [...mesesComDado].sort((a, b) => a - b);
      return { series, meses, ultimoMes: meses.at(-1) ?? null, totalAno };
    },
  });
}

export type LinhaComparativoSalva = {
  municipio_nome: string;
  mes: number;
  valor: number | null;
  criterio: string;
};

export function useIcmsComparativo(exercicio: number | null) {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-comparativo", municipioId, exercicio],
    enabled: !!municipioId && !!exercicio,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("icms_comparativo")
        .select("municipio_nome, mes, valor, criterio")
        .eq("municipio_id", municipioId!)
        .eq("exercicio", exercicio!);
      if (error) throw error;
      return (data ?? []) as LinhaComparativoSalva[];
    },
  });
}


export function useIcmsCargas() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("icms_cargas")
        .select("id, tipo, exercicio, arquivo_nome, origem, linhas, criado_em, payload")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, temPayload: c.payload != null }));
    },
  });
}

/** Regrava os dados de uma carga já salva (recarregar o arquivo/sincronização). */
export function useRecarregarCarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reaplicarCarga(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["icms-dados"] });
      qc.invalidateQueries({ queryKey: ["icms-comparativo"] });
      qc.invalidateQueries({ queryKey: ["icms-exercicios"] });
      qc.invalidateQueries({ queryKey: ["icms-cargas"] });
    },
  });
}

export type ComparativoSalvo = {
  id: string;
  nome: string;
  exercicio: number;
  criterio: string;
  municipios: string[];
  observacao: string | null;
  criado_em: string;
};

export function useComparativosSalvos() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-comparativos-salvos", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ComparativoSalvo[]> => {
      const { data, error } = await supabase
        .from("icms_comparativos_salvos")
        .select("id, nome, exercicio, criterio, municipios, observacao, criado_em")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ComparativoSalvo[];
    },
  });
}

export function useSalvarComparativo() {
  const qc = useQueryClient();
  const { municipioId } = useMunicipioAtivo();
  return useMutation({
    mutationFn: async (dados: {
      nome: string;
      exercicio: number;
      criterio: string;
      municipios: string[];
      observacao?: string | null;
    }) => {
      if (!municipioId) throw new Error("Selecione uma prefeitura.");
      const { error } = await supabase
        .from("icms_comparativos_salvos")
        .insert({ ...dados, municipio_id: municipioId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-comparativos-salvos"] }),
  });
}

export function useApagarComparativoSalvo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("icms_comparativos_salvos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-comparativos-salvos"] }),
  });
}

/** Remove um município da comparação de um exercício. */
export function useRemoverMunicipioComparativo() {
  const qc = useQueryClient();
  const { municipioId } = useMunicipioAtivo();
  return useMutation({
    mutationFn: async ({ exercicio, nome }: { exercicio: number; nome: string }) => {
      if (!municipioId) throw new Error("Selecione uma prefeitura.");
      const { error } = await supabase
        .from("icms_comparativo")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("exercicio", exercicio)
        .eq("municipio_nome", nome);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-comparativo"] }),
  });
}

/** Limpa todo o comparativo gravado de um exercício (novo comparativo). */
export function useLimparComparativo() {
  const qc = useQueryClient();
  const { municipioId } = useMunicipioAtivo();
  return useMutation({
    mutationFn: async (exercicio: number) => {
      if (!municipioId) throw new Error("Selecione uma prefeitura.");
      const { error } = await supabase
        .from("icms_comparativo")
        .delete()
        .eq("municipio_id", municipioId)
        .eq("exercicio", exercicio);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-comparativo"] }),
  });
}

export function useApagarCarga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("icms_cargas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["icms-cargas"] });
      qc.invalidateQueries({ queryKey: ["icms-dados"] });
      qc.invalidateQueries({ queryKey: ["icms-exercicios"] });
    },
  });
}

export type AcaoIcms = {
  id: string;
  criterio: string;
  exercicio: number;
  titulo: string;
  descricao: string | null;
  orgao: string | null;
  responsavel: string | null;
  prazo: string | null;
  impacto_estimado: number | null;
  status: "prevista" | "em_andamento" | "concluida" | "descartada";
  observacao: string | null;
};

export function useIcmsAcoes(exercicio: number | null) {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["icms-acoes", municipioId, exercicio],
    enabled: !!municipioId && !!exercicio,
    queryFn: async (): Promise<AcaoIcms[]> => {
      const { data, error } = await supabase
        .from("icms_acoes")
        .select(
          "id, criterio, exercicio, titulo, descricao, orgao, responsavel, prazo, impacto_estimado, status, observacao",
        )
        .eq("municipio_id", municipioId!)
        .eq("exercicio", exercicio!)
        .order("criado_em");
      if (error) throw error;
      return (data ?? []) as AcaoIcms[];
    },
  });
}

export function useSalvarAcao() {
  const qc = useQueryClient();
  const { municipioId } = useMunicipioAtivo();
  return useMutation({
    mutationFn: async (acao: Partial<AcaoIcms> & { exercicio: number; criterio: string; titulo: string }) => {
      if (!municipioId) throw new Error("Selecione uma prefeitura.");
      const { id, ...campos } = acao;
      if (id) {
        const { error } = await supabase.from("icms_acoes").update(campos).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("icms_acoes")
          .insert({ ...campos, municipio_id: municipioId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-acoes"] }),
  });
}

export function useApagarAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("icms_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["icms-acoes"] }),
  });
}
