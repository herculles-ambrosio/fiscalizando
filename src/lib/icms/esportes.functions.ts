import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HOSTS_PERMITIDOS = ["observatoriodoesporte.mg.gov.br", "www.observatoriodoesporte.mg.gov.br"];
const PAGINAS_BUSCA = [
  "https://observatoriodoesporte.mg.gov.br/icms-esportivo/",
  "https://observatoriodoesporte.mg.gov.br/",
];

type Papel = "superadmin" | "consultor" | "prefeitura_admin" | "prefeitura_operador";

async function exigirConsultoria(context: {
  supabase: { from: (t: string) => any };
  userId: string;
}) {
  const { data, error } = await context.supabase
    .from("perfis")
    .select("papel")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar o perfil do usuário.");
  const papel = data?.papel as Papel | undefined;
  if (papel !== "superadmin" && papel !== "consultor") {
    throw new Error("Apenas a consultoria pode importar os dados do critério Esportes.");
  }
}

function urlPermitida(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:" || !HOSTS_PERMITIDOS.includes(u.hostname)) {
    throw new Error("Só é possível baixar relatórios do site do Observatório do Esporte.");
  }
  return u;
}

/** Procura no site do Observatório do Esporte os PDFs mais recentes. */
export const descobrirRelatoriosEsportes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirConsultoria(context as never);
    const achados = new Map<string, { url: string; texto: string; tipo: string; ano: number | null }>();

    for (const pagina of PAGINAS_BUSCA) {
      let html = "";
      try {
        const resp = await fetch(pagina, { headers: { "user-agent": "Mozilla/5.0 ApuraVAF" } });
        if (!resp.ok) continue;
        html = await resp.text();
      } catch {
        continue;
      }
      const re = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html))) {
        const href = m[1] ?? "";
        const texto = (m[2] ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&#x([0-9a-f]+);/gi, (_, codigo: string) => String.fromCodePoint(parseInt(codigo, 16)))
          .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
          .replace(/&ndash;|&mdash;/gi, "—")
          .replace(/&aacute;/gi, "á")
          .replace(/&eacute;/gi, "é")
          .replace(/&iacute;/gi, "í")
          .replace(/&oacute;/gi, "ó")
          .replace(/&uacute;/gi, "ú")
          .replace(/&ccedil;/gi, "ç")
          .replace(/&amp;/gi, "&")
          .replace(/\s+/g, " ")
          .trim();
        let url: string;
        try {
          url = new URL(href, pagina).toString();
          urlPermitida(url);
        } catch {
          continue;
        }
        let urlLegivel = url;
        try {
          urlLegivel = decodeURIComponent(url);
        } catch {
          // Mantém a URL original quando houver escape inválido.
        }
        const alvo = `${texto} ${urlLegivel}`.toLowerCase();
        if (!alvo.includes("esporte") && !alvo.includes("relatorio")) continue;
        const tipo = /definitiv/.test(alvo)
          ? "definitivo"
          : /preliminar|provisori/.test(alvo)
            ? "preliminar"
            : "outro";
        if (tipo === "outro") continue;
        const anoBase = alvo.match(/ano[-_ ]?base\D{0,20}(20\d{2})/);
        const anoReferencia = alvo.match(/ano[-_ ]?(?:de[-_ ]?)?refer[eê]ncia\D{0,20}(20\d{2})/);
        const anoNoArquivo = urlLegivel.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/);
        const anoMatch = anoBase ?? anoReferencia ?? anoNoArquivo;
        achados.set(url, {
          url,
          texto: texto || url.split("/").pop() || url,
          tipo,
          ano: anoMatch ? Number(anoMatch[1]) : null,
        });
      }
      if (achados.size) break;
    }

    return { relatorios: [...achados.values()].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0)) };
  });

/** Baixa o PDF do Observatório e devolve em base64 para o navegador processar. */
export const baixarRelatorioEsportes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const url = urlPermitida(data.url);
    const resp = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 ApuraVAF" } });
    if (!resp.ok) throw new Error(`Não foi possível baixar o relatório (${resp.status}).`);
    const buffer = new Uint8Array(await resp.arrayBuffer());
    let binario = "";
    for (let i = 0; i < buffer.length; i += 8192) {
      binario += String.fromCharCode(...buffer.subarray(i, i + 8192));
    }
    return { base64: btoa(binario), tamanho: buffer.length };
  });

const fonteSchema = z.enum(["preliminar", "definitivo"]);

/** Apaga os dados do ano/tipo antes de gravar uma nova importação. */
export const limparEsportes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ anoBase: z.number().int().min(2000).max(2100), fonte: fonteSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const tabela of ["esportes_ranking_municipio", "esportes_atividade_municipio"] as const) {
      const { error } = await supabaseAdmin
        .from(tabela)
        .delete()
        .eq("ano_base", data.anoBase)
        .eq("fonte_relatorio", data.fonte);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const rankingSchema = z.object({
  anoBase: z.number().int().min(2000).max(2100),
  fonte: fonteSchema,
  linhas: z
    .array(
      z.object({
        posicao: z.number().int(),
        municipio: z.string().min(1),
        municipioNome: z.string().min(1),
        notaAtividades: z.number(),
        notaJimi: z.number(),
        notaJemg: z.number(),
        notaBabt: z.number(),
        notaFinal: z.number(),
        indicePercentual: z.number(),
      }),
    )
    .max(1000),
});

export const gravarRankingEsportes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rankingSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linhas = data.linhas.map((l) => ({
      ano_base: data.anoBase,
      fonte_relatorio: data.fonte,
      municipio: l.municipio,
      municipio_nome: l.municipioNome,
      posicao: l.posicao,
      nota_atividades: l.notaAtividades,
      nota_jimi: l.notaJimi,
      nota_jemg: l.notaJemg,
      nota_babt: l.notaBabt,
      nota_final: l.notaFinal,
      indice_percentual: l.indicePercentual,
    }));
    const { error } = await supabaseAdmin
      .from("esportes_ranking_municipio")
      .upsert(linhas, { onConflict: "ano_base,fonte_relatorio,municipio" });
    if (error) throw new Error(error.message);
    return { gravados: linhas.length };
  });

const atividadesSchema = z.object({
  anoBase: z.number().int().min(2000).max(2100),
  fonte: fonteSchema,
  itens: z
    .array(
      z.object({
        municipio: z.string().min(1),
        municipioNome: z.string().min(1),
        atividadeNome: z.string().min(1),
        atividadeCodigo: z.string().nullable(),
        pesoAnexoV: z.number().nullable(),
        pesoAtividade: z.number().nullable(),
        pesoRcl: z.number().nullable(),
        pontuacaoAtletas: z.number().nullable(),
        pontuacaoModalidades: z.number().nullable(),
        pontuacao: z.number().nullable(),
        eventosTexto: z.string(),
        qtdEventos: z.number().int(),
        totalParticipantes: z.number().int(),
        modalidadesTexto: z.string(),
      }),
    )
    .max(400),
});

export const gravarAtividadesEsportes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => atividadesSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirConsultoria(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const itens = data.itens.map((i) => ({
      ano_base: data.anoBase,
      fonte_relatorio: data.fonte,
      municipio: i.municipio,
      municipio_nome: i.municipioNome,
      atividade_nome: i.atividadeNome,
      atividade_codigo: i.atividadeCodigo,
      peso_anexo_v: i.pesoAnexoV,
      peso_atividade: i.pesoAtividade,
      peso_rcl: i.pesoRcl,
      pontuacao_atletas: i.pontuacaoAtletas,
      pontuacao_modalidades: i.pontuacaoModalidades,
      pontuacao: i.pontuacao,
      eventos_texto: i.eventosTexto,
      qtd_eventos: i.qtdEventos,
      total_participantes: i.totalParticipantes,
      modalidades_texto: i.modalidadesTexto,
    }));
    const { error } = await supabaseAdmin.from("esportes_atividade_municipio").insert(itens);
    if (error) throw new Error(error.message);
    return { gravados: itens.length };
  });
