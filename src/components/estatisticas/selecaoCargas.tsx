import { createContext, useContext } from "react";
import type { CargaEstat } from "@/lib/vaf/estatisticas";

export type SelecaoCargas = {
  /** Todas as apurações concluídas disponíveis (já deduplicadas). */
  todas: CargaEstat[];
  /** IDs atualmente considerados nos gráficos. */
  selecionadas: string[];
  /** Confirma uma nova seleção e recalcula os gráficos. */
  aplicar: (ids: string[]) => void;
};

export const SelecaoCargasContext = createContext<SelecaoCargas | null>(null);

export function useSelecaoCargas(): SelecaoCargas | null {
  return useContext(SelecaoCargasContext);
}
