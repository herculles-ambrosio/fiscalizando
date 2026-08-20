import { cn } from "@/lib/utils";

/** Marca abstrata: barras cujas alturas desenham um "V" (VAF + dados). */
export function LogoMark({ className }: { className?: string }) {
  const barras = [
    { x: 2, h: 26, tom: "var(--primary)" },
    { x: 8.5, h: 18, tom: "color-mix(in oklab, var(--primary) 72%, transparent)" },
    { x: 15, h: 11, tom: "var(--gold)" },
    { x: 21.5, h: 18, tom: "color-mix(in oklab, var(--primary) 72%, transparent)" },
    { x: 28, h: 26, tom: "var(--primary)" },
  ];
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-8 w-8", className)}
      role="img"
      aria-label="Apura VAF"
    >
      {barras.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={29 - b.h}
          width={2.6}
          height={b.h}
          rx={1.3}
          fill={b.tom}
        />
      ))}
    </svg>
  );
}

export function Logo({
  className,
  compacto = false,
  tomEscuro = false,
}: {
  className?: string;
  compacto?: boolean;
  tomEscuro?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={compacto ? "h-7 w-7" : "h-8 w-8"} />
      <span
        className={cn(
          "font-display font-bold tracking-tight",
          compacto ? "text-sm" : "text-base",
          tomEscuro ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        Apura VAF
      </span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
          tomEscuro
            ? "bg-sidebar-foreground/10 text-sidebar-foreground/70"
            : "bg-gold-soft text-gold-foreground",
        )}
      >
        2.0
      </span>
    </div>
  );
}
