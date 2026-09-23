import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MesEstado } from "@/lib/icms/transferenciasFjp";

export type RepasseEstado = {
  exercicio: number;
  mes: number;
  transferencia_liquida: number | null;
  vaf_75: number | null;
  robin_hood_25: number | null;
};

/** Bolada estadual mês a mês de um exercício (12 posições, jan a dez). */
export function useRepassesEstado(exercicio: number | null) {
  return useQuery({
    queryKey: ["repasses-estado", exercicio],
    enabled: exercicio != null,
    queryFn: async (): Promise<MesEstado[]> => {
      const { data, error } = await supabase
        .from("repasses_estado")
        .select("exercicio, mes, transferencia_liquida, vaf_75, robin_hood_25")
        .eq("exercicio", exercicio!)
        .order("mes");
      if (error) throw error;
      const linhas = (data ?? []) as RepasseEstado[];
      return Array.from({ length: 12 }, (_, i) => {
        const l = linhas.find((x) => x.mes === i + 1);
        return {
          mes: i + 1,
          transferenciaLiquida: l?.transferencia_liquida ?? null,
          vaf75: l?.vaf_75 ?? null,
          robinHood25: l?.robin_hood_25 ?? null,
        };
      });
    },
  });
}

/** Exercícios que já têm bolada cadastrada. */
export function useExerciciosEstado() {
  return useQuery({
    queryKey: ["repasses-estado-exercicios"],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("repasses_estado")
        .select("exercicio")
        .order("exercicio", { ascending: false });
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((l) => l.exercicio as number)));
    },
  });
}

export function useSalvarRepassesEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exercicio, meses }: { exercicio: number; meses: MesEstado[] }) => {
      const linhas = meses
        .filter(
          (m) =>
            m.vaf75 != null || m.transferenciaLiquida != null || m.robinHood25 != null,
        )
        .map((m) => ({
          exercicio,
          mes: m.mes,
          transferencia_liquida: m.transferenciaLiquida,
          vaf_75: m.vaf75,
          robin_hood_25: m.robinHood25,
        }));
      if (!linhas.length) return 0;
      const { error } = await supabase
        .from("repasses_estado")
        .upsert(linhas, { onConflict: "exercicio,mes" });
      if (error) throw error;
      return linhas.length;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["repasses-estado"] });
      void qc.invalidateQueries({ queryKey: ["repasses-estado-exercicios"] });
    },
  });
}
