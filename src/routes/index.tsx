import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BrandFooter } from "@/components/BrandFooter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Apura VAF 2.0 | Acesso das prefeituras" },
      {
        name: "description",
        content:
          "Sistema de apuração do Valor Adicionado Fiscal (VAF) para prefeituras de Minas Gerais: omissos, zerados, fora do prazo e discrepantes.",
      },
      { property: "og:title", content: "Apura VAF 2.0 | Acesso das prefeituras" },
      {
        property: "og:description",
        content:
          "Apure o VAF municipal a partir dos arquivos da SEF-MG e identifique contribuintes omissos, zerados e discrepantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-12 text-sidebar-foreground lg:flex">
        <div className="bg-grid-pattern pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          <Logo tomEscuro />
        </div>

        <div className="relative max-w-lg">
          <h1 className="font-display text-[2.75rem] leading-[1.08] font-bold">
            Controle do{" "}
            <span className="text-gold">Valor Adicionado Fiscal</span>
            <br />
            do seu município
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-sidebar-foreground/70">
            Envie os arquivos da SEF-MG e identifique em minutos os contribuintes omissos, zerados,
            fora do prazo e com variação atípica de VAF.
          </p>

          <div className="mt-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-3">
              {[
                { r: "Omissos", v: "128" },
                { r: "Zerados", v: "64" },
                { r: "Discrepantes", v: "37" },
              ].map((k) => (
                <div key={k.r} className="rounded-xl bg-white/8 px-3 py-2.5">
                  <p className="text-[10px] tracking-wide text-sidebar-foreground/60 uppercase">
                    {k.r}
                  </p>
                  <p className="font-display text-xl font-bold">{k.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-20 items-end gap-2">
              {[38, 62, 45, 88, 54, 72, 30, 66].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gold/70"
                  style={{ height: `${h}%`, opacity: 0.35 + i * 0.07 }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-4">
          <p className="flex items-center gap-1.5 text-xs text-sidebar-foreground/45">
            <Lock className="h-3.5 w-3.5" />
            Acesso restrito às prefeituras cadastradas.
          </p>
          <BrandFooter variante="escuro" />
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold">Entrar</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use as credenciais fornecidas pelo administrador do sistema.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="font-medium">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>


          <div className="space-y-2">
            <Label htmlFor="senha" className="font-medium">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="senha"
                type={mostrarSenha ? "text" : "password"}
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {erro && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          <Button type="submit" className="h-11 w-full text-sm" disabled={enviando}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Não possui acesso? Solicite ao responsável pela Secretaria Municipal de Fazenda.
          </p>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70 lg:hidden">
            <Lock className="h-3.5 w-3.5" />
            Acesso restrito às prefeituras cadastradas.
          </p>

        </form>
      </div>
    </div>
  );
}
