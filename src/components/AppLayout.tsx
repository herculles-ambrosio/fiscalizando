import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  FileUp,
  History,
  GitCompareArrows,
  FileSignature,
  FileClock,
  Landmark,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV_BASE = [
  { to: "/dashboard", rotulo: "Painel", icone: BarChart3 },
  { to: "/nova-apuracao", rotulo: "Nova apuração", icone: FileUp },
  { to: "/historico", rotulo: "Apurações Realizadas", icone: History },
  { to: "/comparacao", rotulo: "Comparar apurações", icone: GitCompareArrows },
  { to: "/modelos", rotulo: "Modelos de ofício", icone: FileSignature },
  { to: "/emissoes", rotulo: "Ofícios emitidos", icone: FileClock },
  { to: "/configuracoes", rotulo: "Configurações", icone: Settings },
];

const NAV_CONSULTORIA = [{ to: "/consultoria/prefeituras", rotulo: "Prefeituras", icone: Building2 }];
const NAV_SUPERADMIN = [{ to: "/consultoria/usuarios", rotulo: "Usuários", icone: Users }];

export function AppLayout({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil();
  const { municipio, municipios, municipioId, podeTrocar, trocar } = useMunicipioAtivo();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (perfil?.precisa_trocar_senha && pathname !== "/trocar-senha") {
      navigate({ to: "/trocar-senha", replace: true });
    }
  }, [perfil?.precisa_trocar_senha, pathname, navigate]);

  const nav = [
    ...(perfil?.ehConsultoria ? NAV_CONSULTORIA : []),
    ...NAV_BASE,
    ...(perfil?.ehSuperadmin ? NAV_SUPERADMIN : []),
  ];

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
              {perfil?.ehConsultoria ? "Consultoria" : (municipio ? `${municipio.nome}/${municipio.uf}` : "—")}
            </p>
          </div>
        </div>

        {podeTrocar && (
          <div className="mt-5">
            <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-sidebar-foreground/50">
              Prefeitura ativa
            </p>
            <Select value={municipioId ?? ""} onValueChange={trocar}>
              <SelectTrigger className="h-9 border-sidebar-border bg-sidebar-accent/40 text-sm text-sidebar-foreground">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {municipios.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}/{m.uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {nav.map((item) => {
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
          <nav className="flex flex-wrap justify-end gap-3">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="text-xs text-muted-foreground">
                {item.rotulo}
              </Link>
            ))}
            <button onClick={sair} className="text-xs text-muted-foreground">
              Sair
            </button>
          </nav>
        </header>
        {podeTrocar && (
          <div className="border-b border-border bg-card px-5 py-2 md:hidden">
            <Select value={municipioId ?? ""} onValueChange={trocar}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Prefeitura" />
              </SelectTrigger>
              <SelectContent>
                {municipios.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}/{m.uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <main className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
