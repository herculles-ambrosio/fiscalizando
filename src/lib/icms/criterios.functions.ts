import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PIPELINE_POR_SLUG } from "@/lib/icms/criterios/pipelines";

type Papel = "superadmin" | "consultor" | "prefeitura_admin" | "prefeitura_operador";

type Ctx = { supabase: { from: (t: string) => any }; userId: string };

async function exigirConsultoria(context: Ctx) {
  const { data, error } = await context.supabase
    .from("perfis")
    .select("papel, nome")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o perfil do usuário.");
  const papel = data?.papel as Papel | undefined;
  if (papel !== "superadmin" && papel !== "consultor") {
    throw new Error("Apenas a consultoria pode importar relatórios dos critérios.");
  }
  return { nome: (data?.nome as string | null) ?? null };
}

function pipeline(slug: string) {
  const p = PIPELINE_POR_SLUG.get(slug);
  if (!p) throw new Error("Critério sem pipeline de ingestão.");
  return p;
}

function urlPermitida(slug: string, url: string): URL {
  const p = pipeline(slug);
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || !p.hosts.includes(u.hostname)) {
    throw new Error(`Só é possível baixar relatórios do site oficial (${p.orgao}).`);
  }
  return u;
}

const criterioSchema = z.object({ criterio: z.string().min(2) });
const fonteSchema = z.enum(["preliminar", "definitivo"]);

/** Procura no site do órgão os PDFs do critério. */
export const descobrirRelatoriosCriterio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema
      .extend({ anoBase: z.number().int().min(2000).max(2100).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const p = pipeline(data.criterio);
    const achados = new Map<string, { url: string; texto: string; tipo: string; ano: number | null }>();

    const ano = data.anoBase ?? new Date().getFullYear();
    const paginas = [...(p.paginasPorAno?.(ano) ?? []), ...p.paginasBusca];
    const diagnostico: { pagina: string; situacao: string; encontrados: number }[] = [];

    for (const pagina of paginas) {
      let html = "";
      try {
        const resp = await fetch(pagina, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
            accept: "text/html,application/xhtml+xml",
          },
        });
        if (!resp.ok) {
          diagnostico.push({ pagina, situacao: `página respondeu ${resp.status}`, encontrados: 0 });
          continue;
        }
        html = await resp.text();
      } catch (e) {
        diagnostico.push({
          pagina,
          situacao: e instanceof Error ? `falha de acesso: ${e.message}` : "falha de acesso",
          encontrados: 0,
        });
        continue;
      }
      const antes = achados.size;
      const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        const href = m[1] ?? "";
        // PDFs diretos, documentos publicados no gerenciador do site (sem
        // extensão no link) ou downloads da biblioteca da Secult.
        if (
          !/\.pdf(\?|$)/i.test(href) &&
          !/\.xlsx?(\?|$)/i.test(href) &&
          !/\/documents\/d\//i.test(href) &&
          !/\/download\/(category|file)\//i.test(href)
        )
          continue;
        const texto = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        let url: string;
        try {
          url = new URL(href, pagina).toString();
          urlPermitida(data.criterio, url);
        } catch {
          continue;
        }
        const alvo = `${url} ${texto}`.toLowerCase();
        if (!p.palavrasChave.some((k) => alvo.includes(k))) continue;
        // Na página do ICMS Turismo só interessam as listas de habilitados —
        // resoluções, leis e cartilhas ficam de fora.
        if (data.criterio === "turismo" && !/habilitad|indice|índice/.test(alvo)) continue;
        // Educação: só as planilhas do índice publicadas pela FJP.
        if (data.criterio === "educacao" && !(/educa/.test(alvo) && /\.xlsx?(\?|$)/i.test(url)))
          continue;
        // As publicações trimestrais da SEMAD têm o mesmo título; o número no
        // fim do endereço identifica o trimestre (…-2 = 1º, …-3 = 2º, e assim
        // por diante), então usamos isso para dar nome próprio a cada uma.
        const seq = alvo.match(/icms-ecologic[oa][-_](\d{1,2})(?!\d)/);
        const trimestre = seq ? Number(seq[1]) - 1 : null;
        const tipo = /(fq|fator de qualidade)/.test(alvo)
          ? /final|definitiv/.test(alvo)
            ? "fator de qualidade (final)"
            : "fator de qualidade (preliminar)"
          : /trimestre|resolucoes|resoluções/.test(alvo)
            ? trimestre && trimestre >= 1 && trimestre <= 4
              ? `tabelas do ${trimestre}º trimestre`
              : "tabelas trimestrais"
            : /habilitad|definitiv/.test(alvo)
              ? "definitivo"
              : /preliminar|parcial|provisori/.test(alvo)
                ? "preliminar"
                : "outro";

        // "Habilitados 2024 - ano referência 2023 (com repasse em 2025)":
        // o ano-base é o de referência, não o da publicação.
        const referencia = alvo.match(/refer[eê]ncia\D{0,6}(20\d{2})/);
        const anoMatch = referencia ?? alvo.match(/(?:ano[-_ ]?base[-_ ]?)?(20\d{2})/);
        achados.set(url, {
          url,
          texto: texto || url.split("/").pop() || url,
          tipo,
          ano: anoMatch ? Number(anoMatch[1]) : null,
        });

      }
      diagnostico.push({ pagina, situacao: "lida", encontrados: achados.size - antes });
      if (achados.size) break;
    }

    return {
      relatorios: [...achados.values()].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0)),
      diagnostico,
    };
  });



/** Baixa o PDF e devolve em base64 para o navegador processar. */
export const baixarRelatorioCriterio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema.extend({ url: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const url = urlPermitida(data.criterio, data.url);
    const resp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 ApuraVAF" } });
    if (!resp.ok) throw new Error(`Não foi possível baixar o relatório (${resp.status}).`);
    const buffer = new Uint8Array(await resp.arrayBuffer());
    let binario = "";
    for (let i = 0; i < buffer.length; i += 8192) {
      binario += String.fromCharCode(...buffer.subarray(i, i + 8192));
    }
    return { base64: btoa(binario), tamanho: buffer.length };
  });

/** Apaga os dados do critério/ano/tipo antes de gravar uma nova importação. */
export const limparCriterio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema
      .extend({ anoBase: z.number().int().min(2000).max(2100), fonte: fonteSchema })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const tabela of ["criterio_ranking_municipio", "criterio_item_municipio"] as const) {
      const { error } = await supabaseAdmin
        .from(tabela)
        .delete()
        .eq("criterio", data.criterio)
        .eq("ano_base", data.anoBase)
        .eq("fonte_relatorio", data.fonte);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const gravarRankingCriterio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema
      .extend({
        anoBase: z.number().int().min(2000).max(2100),
        fonte: fonteSchema,
        linhas: z
          .array(
            z.object({
              municipio: z.string().min(1),
              municipioNome: z.string().min(1),
              posicao: z.number().int().nullable(),
              notaFinal: z.number(),
              indicePercentual: z.number(),
            }),
          )
          .max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linhas = data.linhas.map((l) => ({
      criterio: data.criterio,
      ano_base: data.anoBase,
      fonte_relatorio: data.fonte,
      municipio: l.municipio,
      municipio_nome: l.municipioNome,
      posicao: l.posicao,
      nota_final: l.notaFinal,
      indice_percentual: l.indicePercentual,
    }));
    if (!linhas.length) return { gravados: 0 };
    const { error } = await supabaseAdmin
      .from("criterio_ranking_municipio")
      .upsert(linhas, { onConflict: "criterio,ano_base,fonte_relatorio,municipio" });
    if (error) throw new Error(error.message);
    return { gravados: linhas.length };
  });

export const gravarItensCriterio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema
      .extend({
        anoBase: z.number().int().min(2000).max(2100),
        fonte: fonteSchema,
        itens: z
          .array(
            z.object({
              municipio: z.string().min(1),
              municipioNome: z.string().min(1),
              itemNome: z.string().min(1),
              itemCodigo: z.string().nullable(),
              peso: z.number().nullable(),
              pontuacao: z.number().nullable(),
              quantidade: z.number().nullable(),
              observacao: z.string().nullable(),
            }),
          )
          .max(400),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const itens = data.itens.map((i) => ({
      criterio: data.criterio,
      ano_base: data.anoBase,
      fonte_relatorio: data.fonte,
      municipio: i.municipio,
      municipio_nome: i.municipioNome,
      item_nome: i.itemNome,
      item_codigo: i.itemCodigo,
      peso: i.peso,
      pontuacao: i.pontuacao,
      quantidade: i.quantidade,
      observacao: i.observacao,
    }));
    if (!itens.length) return { gravados: 0 };
    const { error } = await supabaseAdmin.from("criterio_item_municipio").insert(itens);
    if (error) throw new Error(error.message);
    return { gravados: itens.length };
  });

/** Registra a importação no histórico (painel de administração). */
export const registrarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    criterioSchema
      .extend({
        anoBase: z.number().int().min(2000).max(2100),
        fonte: fonteSchema,
        origem: z.enum(["site", "url", "arquivo", "colado"]),
        url: z.string().nullable(),
        arquivoNome: z.string().nullable(),
        paginas: z.number().int().min(0),
        registrosRanking: z.number().int().min(0),
        registrosItens: z.number().int().min(0),
        municipios: z.number().int().min(0),
        naoMapeados: z.array(z.string()).max(500),
        divergencias: z
          .array(z.object({ municipio: z.string(), esperado: z.number(), obtido: z.number() }))
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const perfil = await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("criterio_importacoes").insert({
      criterio: data.criterio,
      ano_base: data.anoBase,
      fonte_relatorio: data.fonte,
      origem: data.origem,
      url: data.url,
      arquivo_nome: data.arquivoNome,
      paginas: data.paginas,
      registros_ranking: data.registrosRanking,
      registros_itens: data.registrosItens,
      municipios: data.municipios,
      nao_mapeados: data.naoMapeados,
      divergencias: data.divergencias,
      importado_por: (context as unknown as Ctx).userId,
      importado_por_nome: perfil.nome,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("criterio_importacoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
