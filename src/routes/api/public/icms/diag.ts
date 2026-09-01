import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico temporário do portal Robin Hood (FJP).
 *  ?url=https://...fjp.mg.gov.br/...   -> devolve o HTML/JSON cru (limitado)
 *  ?coleta=1&municipio=X&exercicio=Y   -> roda o coletor de verdade
 */
export const Route = createFileRoute("/api/public/icms/diag")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams;

        if (q.get("coleta")) {
          const { coletarRobinHood } = await import("@/lib/icms/robinhood.server");
          const meses = q.get("mes") ? [Number(q.get("mes"))] : undefined;
          const r = await coletarRobinHood({
            municipio: q.get("municipio") ?? "ABRE CAMPO",
            exercicio: Number(q.get("exercicio") ?? "2025"),
            ...(meses ? { meses } : {}),
          });
          return Response.json(
            { ...r, registros: r.registros.slice(0, 40), total: r.registros.length },
            { headers: { "cache-control": "no-store" } },
          );
        }

        const alvo = q.get("url");
        if (!alvo) return Response.json({ erro: "informe ?url= ou ?coleta=1" }, { status: 400 });
        const u = new URL(alvo);
        if (!u.hostname.endsWith("fjp.mg.gov.br")) {
          return Response.json({ erro: "host não permitido" }, { status: 400 });
        }
        const t0 = Date.now();
        try {
          const r = await fetch(u, {
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
              accept: "text/html,application/json;q=0.9,*/*;q=0.8",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(25_000),
          });
          const txt = await r.text();
          const corte = Number(q.get("corte") ?? "6000");
          const inicio = Number(q.get("inicio") ?? "0");
          return new Response(txt.slice(inicio, inicio + corte), {
            status: 200,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "x-upstream-status": String(r.status),
              "x-upstream-len": String(txt.length),
              "x-upstream-ms": String(Date.now() - t0),
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          return Response.json(
            { erro: e instanceof Error ? `${e.name}: ${e.message}` : String(e) },
            { status: 502 },
          );
        }
      },
    },
  },
});
