import logoAsset from "@/assets/Htechminas_transparente-2.png.asset.json";
import { cn } from "@/lib/utils";
import { DATA_VERSAO, VERSAO } from "@/lib/versao";

interface BrandFooterProps {
  variante?: "escuro" | "claro";
  tamanho?: "sm" | "md";
  className?: string;
}

export function BrandFooter({ variante = "claro", tamanho = "sm", className }: BrandFooterProps) {
  const escuro = variante === "escuro";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoAsset.url}
        alt="H-Tech Minas"
        className={cn(
          "w-auto object-contain",
          tamanho === "sm" ? "h-10" : "h-16",
          escuro && "brightness-110",
        )}
      />
      <div className={cn("text-[10px] leading-tight", escuro ? "text-sidebar-foreground/50" : "text-muted-foreground/70")}>
        <p className="font-medium text-foreground/80">H-Tech Minas</p>
        <p>Consultoria Tributária · Desenvolvimento de Sistemas</p>
        <p>© {new Date().getFullYear()}</p>
        <p className="mt-0.5 font-mono">Versão {VERSAO}</p>
        <p>Atualizada em {DATA_VERSAO}</p>
      </div>
    </div>
  );
}

