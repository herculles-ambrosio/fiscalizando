import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { reprocessarRegimesDaCarga, type ProgressoReprocesso } from "@/lib/vaf/reprocessar";

/**
 * Preenche Regime / Simples Nacional / SIMEI em apurações antigas relendo o
 * arquivo de ativos já guardado. Roda sozinho uma vez quando a carga está sem os dados.
 */
export function AtualizarRegimes({ cargaId }: { cargaId: string }) {
  const queryClient = useQueryClient();
  const [progresso, setProgresso] = useState<ProgressoReprocesso | null>(null);
  const jaTentou = useRef<string | null>(null);

  const { data: carga, refetch } = useQuery({
    queryKey: ["carga-regime", cargaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("total_simples_nacional, total_simei, arquivo_ativos_path")
        .eq("id", cargaId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const pendente =
    !!carga?.arquivo_ativos_path &&
    (carga.total_simples_nacional == null || carga.total_simei == null);

  async function reprocessar() {
    if (progresso) return;
    setProgresso({ etapa: "Iniciando", percentual: 0 });
    try {
      const r = await reprocessarRegimesDaCarga(cargaId, setProgresso);
      toast.success(
        `Regimes atualizados: ${r.simplesNacional} Simples Nacional e ${r.simei} SIMEI.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contribuintes"] }),
        queryClient.invalidateQueries({ queryKey: ["contagens"] }),
        queryClient.invalidateQueries({ queryKey: ["carga"] }),
        queryClient.invalidateQueries({ queryKey: ["cargas"] }),
        refetch(),
      ]);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao atualizar os regimes.");
    } finally {
      setProgresso(null);
    }
  }

  useEffect(() => {
    if (!pendente || jaTentou.current === cargaId) return;
    jaTentou.current = cargaId;
    void reprocessar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendente, cargaId]);

  if (progresso) {
    return (
      <div className="w-56 space-y-1">
        <p className="truncate text-xs text-muted-foreground">{progresso.etapa}</p>
        <Progress value={progresso.percentual} />
      </div>
    );
  }

  if (!pendente) return null;

  return (
    <Button variant="outline" size="sm" onClick={reprocessar}>
      <RefreshCw className="h-4 w-4" />
      Atualizar regimes
    </Button>
  );
}

export function IconeCarregando() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
