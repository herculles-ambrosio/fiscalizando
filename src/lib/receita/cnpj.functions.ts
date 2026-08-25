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

    // Falhas temporárias entram na fila para reconsulta automática escalonada.
    const { concluirFila, enfileirarFalhas } = await import("./fila.server");
    await concluirFila([...linhas.map((l) => String(l['cnpj'])), ...naoEncontrados]);
    await enfileirarFalhas(falhas, "Sem resposta das bases públicas na consulta manual.");

    return { atualizados: linhas.length, cache, falhas, naoEncontrados };
  });

/** Reconsulta imediata apenas dos CNPJs que ficaram "sem resposta" (fila pendente). */
export const reconsultarFalhasReceita = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((entrada: { cnpjs?: string[] }) => ({
    cnpjs: [
      ...new Set(
        (entrada?.cnpjs ?? [])
          .map((c) => String(c ?? "").replace(/\D/g, ""))
          .filter((c) => c.length === 14),
      ),
    ].slice(0, 500),
  }))
  .handler(async ({ data, context }) => {
    const { reconsultarPendentes } = await import("./fila.server");
    let alvo = data.cnpjs;
    const { data: pendentes } = await context.supabase
      .from("receita_fila")
      .select("cnpj")
      .eq("status", "pendente")
      .limit(500);
    const naFila = new Set((pendentes ?? []).map((r) => r.cnpj));
    alvo = alvo.length ? alvo.filter((c) => naFila.has(c)) : [...naFila];
    return reconsultarPendentes(alvo);
  });


