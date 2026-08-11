import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, FileUp, History, LogOut, Landmark } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", rotulo: "Painel", icone: BarChart3 },
  { to: "/nova-apuracao", rotulo: "Nova apuração", icone: FileUp },
  { to: "/historico", rotulo: "Histórico", icone: History },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-2">
          <Landmark className="h-5 w-5 text-sidebar-primary" />
          <div>
            <p className="font-display text-sm font-semibold tracking-tight">Apuração VAF</p>
            <p className="text-xs text-sidebar-foreground/60">
              {perfil ? `${perfil.municipio.nome}/${perfil.municipio.uf}` : "—"}
            </p>
          </div>
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const ativo = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  ativo
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icone className="h-4 w-4" />
                {item.rotulo}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border pt-4">
          <p className="px-3 text-xs text-sidebar-foreground/60">{perfil?.nome ?? "Usuário"}</p>
          <button
            onClick={sair}
            className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 md:hidden">
          <span className="font-display text-sm font-semibold">Apuração VAF</span>
          <nav className="flex gap-3">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="text-xs text-muted-foreground">
                {item.rotulo}
              </Link>
            ))}
            <button onClick={sair} className="text-xs text-muted-foreground">
              Sair
            </button>
          </nav>
        </header>
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
