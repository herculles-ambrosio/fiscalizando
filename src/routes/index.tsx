import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Loader2, Eye, EyeOff } from "lucide-react";
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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-sm font-semibold">Apura VAF 2.0</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight font-semibold">
            Controle do Valor Adicionado Fiscal do seu município
          </h1>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            Envie os arquivos da SEF-MG e identifique em minutos os contribuintes omissos, zerados,
            fora do prazo e com variação atípica de VAF.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          Acesso restrito às prefeituras cadastradas.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="font-display text-2xl font-semibold">Entrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use as credenciais fornecidas pelo administrador do sistema.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
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
            <Label htmlFor="senha">Senha</Label>
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>

          <p className="text-xs text-muted-foreground">
            Não possui acesso? Solicite ao responsável pela Secretaria Municipal de Fazenda.
          </p>
        </form>
      </div>
    </div>
  );
}
