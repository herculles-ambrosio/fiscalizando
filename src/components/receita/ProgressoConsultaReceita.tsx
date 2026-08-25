import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type ProgressoReceita = {
  ativo: boolean;
  total: number;
  processados: number;
  lote: number;
  lotes: number;
  atualizados: number;
  cache: number;
  falhas: number;
  naoEncontrados: number;
};

/** Barra de progresso em tempo real da consulta em lotes à Receita Federal. */
export function ProgressoConsultaReceita({ progresso }: { progresso: ProgressoReceita }) {
  if (!progresso.ativo || progresso.total === 0) return null;
  const pct = Math.min(100, Math.round((progresso.processados / progresso.total) * 100));
  return (
    <div
      className="w-full space-y-1 rounded-md border border-border bg-muted/40 p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Consultando Receita Federal — lote {progresso.lote} de {progresso.lotes}
        </span>
        <span>
          {progresso.processados} de {progresso.total} CNPJ(s) · {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {progresso.atualizados} consultado(s) · {progresso.cache} em cache ·{" "}
        {progresso.naoEncontrados} fora das bases · {progresso.falhas} sem resposta
      </p>
    </div>
  );
}
