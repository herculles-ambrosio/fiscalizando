import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Entrada = { municipioId: string; empresas: { cnpj: string; ie?: string | null; origem?: string }[] };

/** Consulta cada CNPJ nas bases públicas e grava/atualiza a empresa do município. */
export const enriquecerEmpresas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((e: Entrada) => {
    if (!e?.municipioId || !/^[0-9a-f-]{36}$/i.test(e.municipioId)) throw new Error("Município inválido");
    const vistos = new Set<string>();
    const empresas = (e.empresas ?? [])
      .map((x) => ({
        cnpj: String(x.cnpj ?? "").replace(/\D/g, ""),
        ie: x.ie ? String(x.ie).replace(/\D/g, "") || null : null,
        origem: x.origem === "base_receita" || x.origem === "lista" ? x.origem : "sef",
      }))
      .filter((x) => x.cnpj.length === 14 && !vistos.has(x.cnpj) && vistos.add(x.cnpj))
      .slice(0, 40);
    return { municipioId: e.municipioId, empresas };
  })
  .handler(async ({ data, context }) => {
    const { consultarLote } = await import("@/lib/receita/cnpj.server");
    const { extrairEmpresa, classificar } = await import("./extrair");
    const { data: pode } = await context.supabase
      .from("municipios").select("id").eq("id", data.municipioId).maybeSingle();
    if (!pode) throw new Error("Sem acesso a esta prefeitura.");

    const porCnpj = new Map(data.empresas.map((x) => [x.cnpj, x]));
    const resultados = await consultarLote([...porCnpj.keys()]);
    const agora = new Date().toISOString();
    const linhas = resultados.map((r) => {
      const base = porCnpj.get(r.cnpj)!;
      const comum = {
        municipio_id: data.municipioId,
        cnpj: r.cnpj,
        origem: base.origem,
        consultado_em: agora,
        ...(base.ie ? { inscricao_estadual: base.ie } : {}),
      };
      if (!r.ok) return { ...comum, erro_consulta: r.erro };
      const d = extrairEmpresa(r.bruto);
      return {
        ...comum,
        ...d,
        situacao: r.registro.situacao,
        situacao_data: r.registro.situacao_data,
        motivo: r.registro.motivo,
        tipo_auto: classificar({ ...d, natureza_juridica: d.natureza_juridica, cnae_principal: d.cnae_principal }),
        fonte: r.registro.fonte,
        erro_consulta: null,
      };
    });
    if (linhas.length) {
      const { error } = await context.supabase
        .from("empresas")
        .upsert(linhas as never, { onConflict: "municipio_id,cnpj" });
      if (error) throw new Error(error.message);
    }
    const oks = resultados.filter((r) => r.ok);
    if (oks.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("situacoes_receita").upsert(
        oks.map((r) => ({ ...(r as { registro: object }).registro, consultado_em: agora })) as never,
        { onConflict: "cnpj" },
      );
    }
    return {
      atualizados: oks.length,
      falhas: resultados.filter((r) => !r.ok).length,
    };
  });
