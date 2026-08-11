import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROTULO_STATUS_DOWNLOAD, type StatusDownload } from "@/lib/oficios/registro";

const CLASSES: Record<StatusDownload, string> = {
  baixado: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  gerado: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  erro: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StatusEmissaoBadge({ status }: { status: string }) {
  const chave = (["baixado", "gerado", "erro"] as const).includes(status as StatusDownload)
    ? (status as StatusDownload)
    : "gerado";
  return (
    <Badge variant="outline" className={cn("font-medium", CLASSES[chave])}>
      {ROTULO_STATUS_DOWNLOAD[chave]}
    </Badge>
  );
}
