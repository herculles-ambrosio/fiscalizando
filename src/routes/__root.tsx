import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Após um novo deploy, a aba antiga aponta para arquivos que não existem mais.
// Nesse caso recarregamos uma única vez em vez de mostrar tela de erro.
const CHAVE_RECARGA = "recarga-versao-nova";
/**
 * Recarrega a página quando o navegador tenta buscar um arquivo de uma versão
 * anterior do app (acontece logo depois de uma publicação ou de uma alteração
 * enquanto a página está aberta). A recarga é permitida no máximo uma vez a
 * cada 20 segundos, o que evita tela em branco definitiva sem correr o risco
 * de entrar em laço de recargas.
 */
const INTERVALO_RECARGA_MS = 20_000;

function tentarRecarregar() {
  if (typeof window === "undefined") return false;
  const ultima = Number(sessionStorage.getItem(CHAVE_RECARGA) ?? 0);
  if (Date.now() - ultima < INTERVALO_RECARGA_MS) return false;
  sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
  window.location.reload();
  return true;
}

function ehModuloDesatualizado(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      msg,
    ) || /ChunkLoadError/i.test(msg)
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    if (ehModuloDesatualizado(error) && tentarRecarregar()) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Apura VAF 2.0" },
      {
        name: "description",
        content: "Sistema de apuração do Valor Adicionado Fiscal para prefeituras de Minas Gerais.",
      },
      { property: "og:title", content: "Apura VAF 2.0" },
      {
        property: "og:description",
        content: "Sistema de apuração do Valor Adicionado Fiscal para prefeituras de Minas Gerais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const aoFalharPrecarga = (evento: Event) => {
      evento.preventDefault();
      tentarRecarregar();
    };
    window.addEventListener("vite:preloadError", aoFalharPrecarga);
    return () => window.removeEventListener("vite:preloadError", aoFalharPrecarga);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento !== "SIGNED_IN" && evento !== "SIGNED_OUT" && evento !== "USER_UPDATED") return;
      // Não invalide o roteador enquanto a rota autenticada ainda executa o
      // beforeLoad. A restauração da sessão também pode emitir SIGNED_IN e a
      // invalidação concorrente cancela o MatchInner com uma rejeição sem valor.
      if (evento === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["perfil"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

