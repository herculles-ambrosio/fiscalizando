import { cn } from "@/lib/utils";
import { ROTULO_SITUACAO_RECEITA, type SituacaoReceita } from "@/lib/receita/normalizar";

const CLASSES: Record<SituacaoReceita | "NAO_CONSULTADO", string> = {
  ATIVA: "bg-normal text-normal-foreground border-normal-foreground/20",
  SUSPENSA: "bg-prazo text-prazo-foreground border-prazo-foreground/20",
  INAPTA: "bg-zerado text-zerado-foreground border-zerado-foreground/20",
  BAIXADA: "bg-destructive/15 text-destructive border-destructive/30",
  NULA: "bg-destructive/15 text-destructive border-destructive/30",
  DESCONHECIDA: "bg-muted text-muted-foreground border-border",
  NAO_CONSULTADO: "bg-muted text-muted-foreground border-border border-dashed",
};

export function SituacaoReceitaBadge({
  situacao,
  motivo,
}: {
  situacao: string | null | undefined;
  motivo?: string | null;
}) {
  const bruta = situacao ?? "NAO_CONSULTADO";
  const chave = (bruta in CLASSES ? bruta : "DESCONHECIDA") as SituacaoReceita | "NAO_CONSULTADO";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CLASSES[chave],
      )}
      title={motivo ?? "Situação cadastral na Receita Federal (dados abertos do CNPJ)"}
    >
      {ROTULO_SITUACAO_RECEITA[chave]}
    </span>
  );
}
