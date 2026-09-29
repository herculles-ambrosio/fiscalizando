/**
 * Coleta diária de notícias tributárias: lê as fontes cadastradas (RSS ou
 * página), filtra por palavras-chave, resume e classifica com IA e grava.
 */
export const TEMAS = [
  "VAF",
  "ICMS",
  "ITBI",
  "ISS",
  "IPTU",
  "Nota Fiscal",
  "Simples Nacional",
  "Reforma Tributária",
  "TCE-MG",
  "Legislação",
] as const;

const PALAVRAS =
  /\b(vaf|valor adicionado|icms|itbi|iss|issqn|iptu|nota fiscal|nfs-?e|simples nacional|reforma tribut|ibs|cbs|tribut|imposto|arrecada|fisco|fiscal|receita municipal|repasse|fpm|robin hood|dívida ativa|tce)/i;

type Item = { titulo: string; url: string; fonte: string; publicada_em: string | null };

function charsetDoContentType(contentType: string | null) {
  return contentType?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]?.trim() ?? null;
}

/**
 * Decodifica a resposta usando o charset informado pela própria fonte.
 * Alguns portais públicos ainda entregam Windows-1252/ISO-8859-1; usar
 * response.text() nesses casos troca os acentos pelo caractere �.
 */
export async function lerRespostaTexto(resposta: Response) {
  const bytes = await resposta.arrayBuffer();
  const informado = charsetDoContentType(resposta.headers.get("content-type"));
  const charset = informado && /^(utf-?8|iso-8859-1|latin1|windows-1252|cp1252)$/i.test(informado)
    ? informado
    : "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function limpar(t: string) {
  return t
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_entidade, numero: string) => String.fromCodePoint(Number(numero)))
    .replace(/&#x([\da-f]+);/gi, (_entidade, numero: string) => String.fromCodePoint(parseInt(numero, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function lerRss(xml: string, fonte: string): Item[] {
  const itens: Item[] = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
    const b = m[0];
    const titulo = limpar(b.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    let url = limpar(b.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    if (!url) url = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const data = limpar(
      b.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? "",
    );
    const d = data ? new Date(data) : null;
    if (titulo && /^https?:\/\//.test(url))
      itens.push({
        titulo,
        url,
        fonte,
        publicada_em: d && !isNaN(d.getTime()) ? d.toISOString() : null,
      });
  }
  return itens;
}

function lerPagina(html: string, base: string, fonte: string): Item[] {
  const itens: Item[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const titulo = limpar(m[2] ?? "");
    if (titulo.length < 35 || titulo.length > 250) continue;
    try {
      itens.push({ titulo, url: new URL(m[1] ?? "", base).toString(), fonte, publicada_em: null });
    } catch {
      /* ignora */
    }
  }
  return itens;
}

async function classificar(itens: Item[]) {
  const chave = process.env["LOVABLE_API_KEY"];
  if (!chave || !itens.length) return null;
  const lista = itens.map((i, n) => `${n}. [${i.fonte}] ${i.titulo}`).join("\n");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": chave,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "Você faz a curadoria de um mural de notícias tributárias para prefeituras de Minas Gerais. " +
        `Para cada manchete, decida se é relevante para a área tributária municipal (VAF, ICMS, ITBI, ISS, IPTU, nota fiscal, Simples, reforma tributária, repasses, TCE-MG, legislação). ` +
        `Responda SOMENTE um JSON: {"itens":[{"n":número,"relevante":true|false,"resumo":"1 a 2 frases em pt-BR explicando o assunto e por que importa ao município","temas":[...]}]}. ` +
        `Temas permitidos: ${TEMAS.join(", ")}. Não invente fatos além da manchete.`,
      input: [{ role: "user", content: [{ type: "input_text", text: lista }] }],
    }),
  });
  if (!resp.ok || !resp.body) {
    console.error("IA notícias falhou", resp.status);
    return null;
  }
  const leitor = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let texto = "";
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const partes = buf.split("\n\n");
    buf = partes.pop() ?? "";
    for (const bloco of partes)
      for (const linha of bloco.split("\n")) {
        if (!linha.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(linha.slice(5).trim());
          if (ev.type === "response.output_text.delta" && ev.delta) texto += ev.delta;
        } catch {
          /* parcial */
        }
      }
  }
  const json = texto.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    return (
      JSON.parse(json) as {
        itens: { n: number; relevante: boolean; resumo: string; temas: string[] }[];
      }
    ).itens;
  } catch {
    return null;
  }
}

export async function coletarNoticias() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: fontes } = await supabaseAdmin
    .from("noticias_fontes")
    .select("nome, url, tipo")
    .eq("ativa", true);

  const brutos: Item[] = [];
  const falhas: string[] = [];
  await Promise.all(
    (fontes ?? []).map(async (f) => {
      try {
        const r = await fetch(f.url, {
          headers: { "User-Agent": "ApuraVAF/1.0 (+https://apuravaf20.com)" },
        });
        if (!r.ok) throw new Error(String(r.status));
        const corpo = await lerRespostaTexto(r);
        const itens =
          f.tipo === "rss" ? lerRss(corpo, f.nome) : lerPagina(corpo, f.url, f.nome);
        brutos.push(...itens.slice(0, 40));
      } catch {
        falhas.push(f.nome);
      }
    }),
  );

  const vistos = new Set<string>();
  const candidatos = brutos.filter((i) => {
    if (vistos.has(i.url) || !PALAVRAS.test(i.titulo)) return false;
    vistos.add(i.url);
    return true;
  });
  if (!candidatos.length) return { novas: 0, lidas: brutos.length, falhas };

  const { data: existentes } = await supabaseAdmin
    .from("noticias")
    .select("url")
    .in(
      "url",
      candidatos.map((c) => c.url),
    );
  const ja = new Set((existentes ?? []).map((e) => e.url));
  const novos = candidatos.filter((c) => !ja.has(c.url)).slice(0, 30);
  if (!novos.length) return { novas: 0, lidas: brutos.length, falhas };

  const ia = await classificar(novos);
  const linhas = novos
    .map((item, n) => {
      const c = ia?.find((x) => x.n === n);
      if (ia && (!c || !c.relevante)) return null;
      return {
        titulo: item.titulo,
        url: item.url,
        fonte: item.fonte,
        publicada_em: item.publicada_em ?? new Date().toISOString(),
        resumo: c?.resumo ?? null,
        temas: (c?.temas ?? []).filter((t) => (TEMAS as readonly string[]).includes(t)),
        origem: "auto",
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  if (linhas.length) {
    const { error } = await supabaseAdmin
      .from("noticias")
      .upsert(linhas, { onConflict: "url", ignoreDuplicates: true });
    if (error) throw error;
  }
  return { novas: linhas.length, lidas: brutos.length, falhas };
}
