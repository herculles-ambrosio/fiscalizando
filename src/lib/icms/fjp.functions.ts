import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { acharCriterio, normalizarRotulo, MESES } from "./criterios";

/**
 * Coleta dos índices publicados pela Fundação João Pinheiro.
 *
 * O portal atual (robin-hood.fjp.mg.gov.br) ainda não expõe API estável; o
 * portal histórico publica uma tabela com todos os municípios e todos os
 * critérios do mês, que é o que usamos aqui. Se nada for encontrado, o
 * usuário continua podendo importar o arquivo manualmente.
 */

const FONTES = [
  "https://robin-hood-historico.fjp.mg.gov.br/index.php/indices/mesatual",
  "http://robin-hood-historico.fjp.mg.gov.br/index.php/indices/mesatual",
];

function semTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroBr(texto: string): number | null {
  const limpo = texto.replace(/\s/g, "");
  if (!limpo) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export const buscarIndicesFjp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        municipio: z.string().trim().min(2).max(120),
        exercicio: z.number().int().min(1991).max(2100),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    let html = "";
    let erro = "";
    for (const url of FONTES) {
      try {
        const resp = await fetch(url, {
          headers: { "user-agent": "ApuraVAF/1.0 (+consulta de indices ICMS)" },
        });
        if (!resp.ok) {
          erro = `HTTP ${resp.status}`;
          continue;
        }
        html = await resp.text();
        break;
      } catch (e) {
        erro = e instanceof Error ? e.message : "falha de rede";
      }
    }
    if (!html) {
      throw new Error(erro || "portal indisponível");
    }

    // período divulgado, ex.: "Índices referentes ao mês de Março de 2026."
    const periodo = html.match(/m[êe]s de\s+([A-Za-zçÇãÃéÉ]+)\s+de\s+(\d{4})/i);
    const nomeMes = periodo?.[1] ?? "";
    const anoTexto = periodo?.[2] ?? "";
    const mes = Math.max(
      1,
      MESES.findIndex((m) => normalizarRotulo(m) === normalizarRotulo(nomeMes)) + 1,
    );
    const exercicio = anoTexto ? Number(anoTexto) : data.exercicio;

    const tabela = html.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? "";
    const cabecalho = [...tabela.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((c) => semTags(c[1] ?? ""));

    const alvo = normalizarRotulo(data.municipio);
    let linhaAlvo: string[] | null = null;
    for (const linha of tabela.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas = [...(linha[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (c) => semTags(c[1] ?? ""),
      );
      if (celulas.some((c) => normalizarRotulo(c) === alvo)) {
        linhaAlvo = celulas;
        break;
      }
    }

    if (!linhaAlvo) {
      return {
        exercicio,
        mes,
        rotuloPeriodo: `${MESES[mes - 1]}/${exercicio}`,
        linhas: [] as { criterio: string; indice: number | null }[],
        mensagem: `O portal não trouxe ${data.municipio} na tabela do mês atual.`,
      };
    }

    const linhas: { criterio: string; indice: number | null }[] = [];
    cabecalho.forEach((titulo, i) => {
      const criterio = acharCriterio(titulo);
      if (!criterio) return;
      const indice = numeroBr(linhaAlvo![i] ?? "");
      if (indice == null) return;
      linhas.push({ criterio: criterio.slug, indice });
    });

    return {
      exercicio,
      mes,
      rotuloPeriodo: `${MESES[mes - 1]}/${exercicio}`,
      linhas,
      mensagem: null as string | null,
    };
  });
