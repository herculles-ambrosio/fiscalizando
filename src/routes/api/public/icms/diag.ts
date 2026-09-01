import { createFileRoute } from "@tanstack/react-router";

/** Diagnóstico temporário: verifica quais endpoints da FJP respondem do servidor. */
const ALVOS = [
  "https://robin-hood.fjp.mg.gov.br/",
  "https://robin-hood-historico.fjp.mg.gov.br/index.php",
  "http://robin-hood-historico.fjp.mg.gov.br/index.php",
  "https://www.fjp.mg.gov.br/",
];

export const Route = createFileRoute("/api/public/icms/diag")({
  server: {
    handlers: {
      GET: async () => {
        const saida: Record<string, unknown>[] = [];
        for (const url of ALVOS) {
          const t0 = Date.now();
          try {
            const r = await fetch(url, {
              headers: { "user-agent": "Mozilla/5.0", accept: "text/html,*/*" },
              redirect: "follow",
              signal: AbortSignal.timeout(20_000),
            });
            const txt = await r.text();
            saida.push({
              url,
              status: r.status,
              ms: Date.now() - t0,
              tipo: r.headers.get("content-type"),
              tamanho: txt.length,
              amostra: txt.slice(0, 200),
            });
          } catch (e) {
            saida.push({
              url,
              ms: Date.now() - t0,
              erro: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
            });
          }
        }
        return Response.json(saida, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
