/**
 * Gravação dos dados próprios do critério Educação: números brutos (dados
 * constitutivos), recursos administrativos e o calendário anual da FJP.
 * O ranking e os quatro componentes continuam nas tabelas comuns dos
 * critérios, para manter Comparativo, projeção e conferência funcionando.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { from: (t: string) => any }; userId: string };

async function exigirConsultoria(context: Ctx) {
  const { data, error } = await context.supabase
    .from("perfis")
    .select("papel")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o perfil do usuário.");
  const papel = data?.papel as string | undefined;
  if (papel !== "superadmin" && papel !== "consultor") {
    throw new Error("Apenas a consultoria pode importar a planilha da Educação.");
  }
}

const versao = z.enum(["provisorio", "definitivo"]);
const exercicio = z.number().int().min(2000).max(2100);

export const limparEducacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exercicio, fonteVersao: versao }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const tabela of ["educacao_dados_constitutivos", "educacao_recursos"] as const) {
      const { error } = await supabaseAdmin
        .from(tabela)
        .delete()
        .eq("exercicio", data.exercicio)
        .eq("fonte_versao", data.fonteVersao);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const gravarDadosConstitutivos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        exercicio,
        fonteVersao: versao,
        linhas: z
          .array(
            z.object({
              municipio: z.string().min(1),
              municipioNome: z.string().min(1),
              colunaOrigem: z.string().min(1),
              valorNum: z.number().nullable(),
              valorTexto: z.string().nullable(),
            }),
          )
          .max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.linhas.length) return { gravados: 0 };
    const { error } = await supabaseAdmin.from("educacao_dados_constitutivos").upsert(
      data.linhas.map((l) => ({
        exercicio: data.exercicio,
        fonte_versao: data.fonteVersao,
        municipio: l.municipio,
        municipio_nome: l.municipioNome,
        coluna_origem: l.colunaOrigem,
        valor_num: l.valorNum,
        valor_texto: l.valorTexto,
      })),
      { onConflict: "exercicio,fonte_versao,municipio,coluna_origem" },
    );
    if (error) throw new Error(error.message);
    return { gravados: data.linhas.length };
  });

export const gravarRecursosEducacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        exercicio,
        fonteVersao: versao,
        linhas: z
          .array(
            z.object({
              municipio: z.string().min(1),
              municipioNome: z.string().min(1),
              itemContestado: z.string().min(1),
              resultado: z.string().nullable(),
            }),
          )
          .max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.linhas.length) return { gravados: 0 };
    const { error } = await supabaseAdmin.from("educacao_recursos").insert(
      data.linhas.map((l) => ({
        exercicio: data.exercicio,
        fonte_versao: data.fonteVersao,
        municipio: l.municipio,
        municipio_nome: l.municipioNome,
        item_contestado: l.itemContestado,
        resultado: l.resultado,
      })),
    );
    if (error) throw new Error(error.message);
    return { gravados: data.linhas.length };
  });

export const salvarCalendarioEducacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        exercicio,
        dataPublicacaoProvisorio: z.string().nullable().optional(),
        dataLimiteRecurso: z.string().nullable().optional(),
        dataPublicacaoDefinitivo: z.string().nullable().optional(),
        pesoIrap: z.number().optional(),
        pesoIre: z.number().optional(),
        pesoIae: z.number().optional(),
        pesoIge: z.number().optional(),
        resolucaoReferencia: z.string().nullable().optional(),
        notaTecnica: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const registro: Record<string, unknown> = { exercicio: data.exercicio };
    const mapa: Record<string, unknown> = {
      data_publicacao_provisorio: data.dataPublicacaoProvisorio,
      data_limite_recurso: data.dataLimiteRecurso,
      data_publicacao_definitivo: data.dataPublicacaoDefinitivo,
      peso_irap: data.pesoIrap,
      peso_ire: data.pesoIre,
      peso_iae: data.pesoIae,
      peso_ige: data.pesoIge,
      resolucao_referencia: data.resolucaoReferencia,
      nota_tecnica: data.notaTecnica,
    };
    for (const [campo, valor] of Object.entries(mapa)) {
      if (valor !== undefined) registro[campo] = valor;
    }
    const { error } = await supabaseAdmin
      .from("educacao_calendario")
      .upsert(registro as never, { onConflict: "exercicio" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
