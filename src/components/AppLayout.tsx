import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  FileUp,
  History,
  FileSignature,
  PieChart,
  LogOut,
  MapPin,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { BrandFooter } from "@/components/BrandFooter";
import { Timbrado } from "@/components/Timbrado";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NAV_OPERACAO = [
  { to: "/dashboard", rotulo: "Painel", icone: BarChart3 },
  { to: "/nova-apuracao", rotulo: "Nova apuração", icone: FileUp },
  { to: "/historico", rotulo: "Apurações Realizadas", icone: History },
];

const NAV_ANALISE = [
  { to: "/contribuintes", rotulo: "Contribuintes", icone: Users },
  { to: "/analises", rotulo: "Análises do VAF", icone: TrendingUp },
  { to: "/estatisticas", rotulo: "Estatísticas", icone: PieChart },
  { to: "/oficios", rotulo: "Ofícios", icone: FileSignature },
];

const NAV_ADMIN = [{ to: "/configuracoes", rotulo: "Configurações", icone: Settings }];

const NAV_CONSULTORIA = [{ to: "/consultoria/prefeituras", rotulo: "Prefeituras", icone: Building2 }];
const NAV_SUPERADMIN = [
  { to: "/consultoria/usuarios", rotulo: "Usuários", icone: Users },
  { to: "/consultoria/codigos-sef", rotulo: "Códigos SEF", icone: MapPin },
];


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

  const grupos = [
    {
      rotulo: "Operação",
      itens: [...(perfil?.ehConsultoria ? NAV_CONSULTORIA : []), ...NAV_OPERACAO],
    },
    { rotulo: "Análise", itens: NAV_ANALISE },
    {
      rotulo: "Administração",
      itens: [...NAV_ADMIN, ...(perfil?.ehSuperadmin ? NAV_SUPERADMIN : [])],
    },
  ];
  const nav = grupos.flatMap((g) => g.itens);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const inicial = (municipio?.nome ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-66 shrink-0 flex-col bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <div className="px-1.5">
          <Logo tomEscuro />
          <p className="mt-2 pl-[42px] text-xs text-sidebar-foreground/50">
            {perfil?.ehConsultoria
              ? "Consultoria"
              : municipio
                ? `${municipio.nome}/${municipio.uf}`
                : "—"}
          </p>
        </div>

        {podeTrocar && (
          <div className="mt-6 rounded-xl border border-sidebar-border bg-white/5 p-2.5 shadow-soft">
            <p className="px-1 pb-1.5 text-[10px] tracking-[0.08em] text-sidebar-foreground/45 uppercase">
              Prefeitura ativa
            </p>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 font-display text-sm font-bold text-gold">
                {inicial}
              </span>
              <Select value={municipioId ?? ""} onValueChange={trocar}>
                <SelectTrigger className="h-9 min-w-0 flex-1 rounded-lg border-transparent bg-transparent text-sm text-sidebar-foreground shadow-none">
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
          </div>
        )}

        <nav className="mt-7 flex flex-1 flex-col gap-6">
          {grupos.map((grupo) => (
            <div key={grupo.rotulo} className="flex flex-col gap-1">
              <p className="mb-1 px-3 text-[10px] font-medium tracking-[0.1em] text-sidebar-foreground/35 uppercase">
                {grupo.rotulo}
              </p>
              {grupo.itens.map((item) => {
                const ativo = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-all",
                      ativo
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-soft"
                        : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icone className="h-4 w-4" strokeWidth={1.75} />
                    {item.rotulo}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-6 border-t border-sidebar-border pt-4">
          <p className="px-3 text-xs text-sidebar-foreground/55">{perfil?.nome ?? "Usuário"}</p>
          <button
            onClick={sair}
            className="mt-2 flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-white/8 hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Sair
          </button>
          <BrandFooter variante="escuro" className="mt-4 px-3" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 md:hidden">
          <Logo compacto />
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
          <div className="no-print border-b border-border bg-card px-5 py-2 md:hidden">
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
        <main className="min-w-0 flex-1 px-5 py-7 md:px-9 md:py-10">
          <Timbrado>{children}</Timbrado>
        </main>



      </div>
    </div>
  );
}
