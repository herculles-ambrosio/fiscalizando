import { cn } from "@/lib/utils";
import { ROTULO_SITUACAO_CADASTRAL, type SituacaoCadastral } from "@/lib/vaf/apurar";

const CLASSES: Record<SituacaoCadastral, string> = {
  NORMAL: "bg-normal text-normal-foreground border-normal-foreground/20",
  CANCELADO: "bg-destructive/15 text-destructive border-destructive/30",
  BAIXADO: "bg-destructive/15 text-destructive border-destructive/30",
  BLOQUEADO: "bg-prazo text-prazo-foreground border-prazo-foreground/20",
  ENDERECO_DIVERGENTE: "bg-secondary text-secondary-foreground border-border",
  ENCERROU_ATIVIDADE: "bg-zerado text-zerado-foreground border-zerado-foreground/20",
  AUSENTE_ATIVOS: "bg-destructive/15 text-destructive border-destructive/30",
  DESCONHECIDA: "bg-muted text-muted-foreground border-border",
};

export function SituacaoCadastralBadge({ situacao }: { situacao: string | null | undefined }) {
  const chave = ((situacao ?? "DESCONHECIDA") as SituacaoCadastral) in CLASSES
    ? (situacao as SituacaoCadastral)
    : "DESCONHECIDA";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        CLASSES[chave],
      )}
      title="Situação cadastral na SEF/MG (arquivo de ativos + cruzamento com o retorno)"
    >
      {ROTULO_SITUACAO_CADASTRAL[chave]}
    </span>
  );
}
