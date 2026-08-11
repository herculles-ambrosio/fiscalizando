import { cn } from "@/lib/utils";
import { ROTULO_SITUACAO, type Situacao } from "@/lib/vaf/apurar";

const CLASSES: Record<Situacao, string> = {
  OMISSO: "bg-omisso text-omisso-foreground border-omisso-foreground/20",
  ZERADO: "bg-zerado text-zerado-foreground border-zerado-foreground/20",
  FORA_DO_PRAZO: "bg-prazo text-prazo-foreground border-prazo-foreground/20",
  DISCREPANTE: "bg-discrepante text-discrepante-foreground border-discrepante-foreground/20",
  NORMAL: "bg-normal text-normal-foreground border-normal-foreground/20",
  SIMPLES_NACIONAL: "bg-secondary text-secondary-foreground border-border",
  SIMEI: "bg-accent text-accent-foreground border-border",
  SOMENTE_RETORNO: "bg-destructive text-destructive-foreground border-destructive/30",

};

export function SituacaoBadge({ situacao }: { situacao: string }) {
  const chave = (situacao as Situacao) in CLASSES ? (situacao as Situacao) : "NORMAL";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CLASSES[chave],
      )}
    >
      {ROTULO_SITUACAO[chave]}
    </span>
  );
}
