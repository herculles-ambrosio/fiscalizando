import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TEXTO =
  "“Remessa” é o número do arquivo retorno enviado pela SEF (1 a 13) — não é competência mensal. Cada remessa traz o acumulado do exercício e a 13 é o fechamento do ano.";

/**
 * Nota padrão explicando o conceito de remessa nas telas de análise.
 * variant "inline" mostra só o ícone; "texto" mostra o rótulo com o ícone.
 */
export function NotaRemessa({
  variant = "inline",
  className,
  label = "O que é Remessa?",
}: {
  variant?: "inline" | "texto";
  className?: string;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={TEXTO}
          className={cn(
            "inline-flex items-center gap-1 align-middle text-muted-foreground hover:text-foreground transition-colors",
            variant === "texto" ? "text-xs" : "",
            className,
          )}
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {variant === "texto" ? <span>{label}</span> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{TEXTO}</TooltipContent>
    </Tooltip>
  );
}

export default NotaRemessa;
