import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const consultarSituacoesReceita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((entrada: { cnpjs: string[]; forcar?: boolean }) => {
    const cnpjs = [
      ...new Set(
        (entrada?.cnpjs ?? [])
          .map((c) => String(c ?? "").replace(/\D/g, ""))
          .filter((c) => c.length === 14),
      ),
    ].slice(0, 300);
    return { cnpjs, forcar: entrada?.forcar === true };
  })
  .handler(async ({ data, context }) => {
    const { consultarLote } = await import("./cnpj.server");
    const { cnpjs, forcar } = data;
    if (!cnpjs.length)
      return { atualizados: 0, cache: 0, falhas: [] as string[], naoEncontrados: [] as string[] };

    // Cache global: só reconsulta o que ainda não existe (ou quando forçado).
    let pendentes = cnpjs;
    let cache = 0;
    if (!forcar) {
      const { data: existentes } = await context.supabase
        .from("situacoes_receita")
        .select("cnpj")
        .in("cnpj", cnpjs);
      const conhecidos = new Set((existentes ?? []).map((r) => r.cnpj));
      cache = conhecidos.size;
      pendentes = cnpjs.filter((c) => !conhecidos.has(c));
    }
    if (!pendentes.length)
      return { atualizados: 0, cache, falhas: [] as string[], naoEncontrados: [] as string[] };

    const resultados = await consultarLote(pendentes);
    const linhas = resultados
      .filter((r) => r.ok)
      .map((r) => ({ ...(r as { registro: Record<string, unknown> }).registro }));
    const naoEncontrados = resultados
      .filter((r) => !r.ok && (r as { naoEncontrado: boolean }).naoEncontrado)
      .map((r) => r.cnpj);
    const falhas = resultados
      .filter((r) => !r.ok && !(r as { naoEncontrado: boolean }).naoEncontrado)
      .map((r) => r.cnpj);

    if (linhas.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("situacoes_receita")
        .upsert(
          linhas.map((l) => ({ ...l, consultado_em: new Date().toISOString() })) as never,
          { onConflict: "cnpj" },
        );
      if (error) throw new Error(error.message);
    }

    return { atualizados: linhas.length, cache, falhas, naoEncontrados };
  });

