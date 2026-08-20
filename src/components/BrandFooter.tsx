import logoAsset from "@/assets/Htechminas_transparente.png.asset.json";
import { cn } from "@/lib/utils";

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
          tamanho === "sm" ? "h-8" : "h-14",
          escuro && "brightness-110",
        )}
      />
      <div className={cn("text-[10px] leading-tight", escuro ? "text-sidebar-foreground/50" : "text-muted-foreground/70")}>
        <p>© {new Date().getFullYear()} H-Tech Minas.</p>
        <p>Consultoria Tributária · Desenvolvimento de Sistemas.</p>
      </div>
    </div>
  );
}

