import { createFileRoute } from "@tanstack/react-router";

/** Coleta diária de notícias (chamada pelo agendamento do banco). */
export const Route = createFileRoute("/api/public/hooks/noticias-coleta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const chave =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const esperada =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!esperada || chave !== esperada) {
          return Response.json({ error: "Não autorizado" }, { status: 401 });
        }
        try {
          const { coletarNoticias } = await import("@/lib/noticias/coleta.server");
          return Response.json({ ok: true, ...(await coletarNoticias()) });
        } catch (erro) {
          console.error("noticias-coleta falhou:", erro);
          return Response.json(
            { ok: false, error: erro instanceof Error ? erro.message : "Falha" },
            { status: 500 },
          );
        }
      },
    },
  },
});
