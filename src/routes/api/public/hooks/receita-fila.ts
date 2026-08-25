import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker agendado (pg_cron) da fila de reconsulta da Receita Federal.
 * Processa um lote limitado por execução, com trava de execução única.
 */
export const Route = createFileRoute("/api/public/hooks/receita-fila")({
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
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        let limite = 40;
        try {
          const corpo = (await request.json()) as { limite?: number } | null;
          if (corpo && typeof corpo.limite === "number") {
            limite = Math.max(1, Math.min(100, Math.floor(corpo.limite)));
          }
        } catch {
          // corpo vazio é aceitável
        }

        try {
          const { processarFilaReceita } = await import("@/lib/receita/fila.server");
          const resultado = await processarFilaReceita(limite);
          return new Response(JSON.stringify({ ok: true, ...resultado }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (erro) {
          console.error("receita-fila falhou:", erro);
          return new Response(
            JSON.stringify({
              ok: false,
              error: erro instanceof Error ? erro.message : "Falha ao processar a fila",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
