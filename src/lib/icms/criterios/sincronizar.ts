/**
 * Sincronização automática das tabelas oficiais dos critérios do ICMS.
 *
 * A ideia é a mesma da tela de importação manual, sem o arrastar de arquivo:
 * o sistema varre a página oficial do órgão, escolhe a publicação que combina
 * com o ano-base e o tipo pedidos, baixa o arquivo e devolve as linhas já
 * interpretadas, prontas para gravar no ranking.
 */

import type { PaginaTexto } from "@/lib/icms/esportes/parser";
import type { ItemReferencia } from "@/lib/icms/criterios/tabela";
import { extrairTabelaCriterio } from "@/lib/icms/criterios/tabela";
import type { FonteRelatorio, Pipeline } from "@/lib/icms/criterios/pipelines";

export type RelatorioEncontrado = {
  url: string;
  texto: string;
  tipo: string;
  ano: number | null;
};

/**
 * Escolhe, entre os arquivos achados na página oficial, o que mais se aproxima
 * do exercício e do tipo (preliminar/definitivo) pedidos. Sem candidato do ano
 * exato, fica com o mais recente.
 */
export function escolherRelatorio(
  relatorios: RelatorioEncontrado[],
  anoBase: number,
  fonte: FonteRelatorio,
): RelatorioEncontrado | null {
  if (!relatorios.length) return null;
  const nota = (r: RelatorioEncontrado) => {
    let pontos = 0;
    if (r.ano === anoBase) pontos += 100;
    else if (r.ano) pontos += Math.max(0, 40 - Math.abs(r.ano - anoBase) * 10);
    const alvo = `${r.tipo} ${r.texto}`.toLowerCase();
    const definitivo = /definitiv|final|habilitad/.test(alvo);
    const preliminar = /preliminar|provisori|parcial/.test(alvo);
    if (fonte === "definitivo" && definitivo) pontos += 30;
    if (fonte === "preliminar" && preliminar) pontos += 30;
    if (fonte === "definitivo" && preliminar) pontos -= 10;
    if (fonte === "preliminar" && definitivo) pontos -= 10;
    return pontos;
  };
  return [...relatorios].sort((a, b) => nota(b) - nota(a))[0] ?? null;
}

export type LeituraCriterio = {
  ranking: { municipio: string; municipioNome: string; posicao: number | null; notaFinal: number; indicePercentual: number }[];
  itens: {
    municipio: string;
    municipioNome: string;
    itemNome: string;
    itemCodigo: string | null;
    peso: number | null;
    pontuacao: number | null;
    quantidade: number | null;
    observacao: string | null;
  }[];
  naoMapeados: string[];
  cabecalho: string[];
  /** exercício lido no próprio relatório, quando o arquivo informa */
  ano: number | null;
  /** tipo lido no próprio relatório, quando o arquivo informa */
  fonte: FonteRelatorio | null;
  divergencias: { municipio: string; esperado: number; obtido: number }[];
};

/**
 * Passa as páginas do arquivo pelo leitor certo do critério: o quadro do IEPHA
 * é posicional, o ICMS Turismo e o ICMS Ecológico têm quadros próprios e os
 * demais caem no leitor genérico de tabela por itens.
 */
export async function interpretarPaginas(
  pipeline: Pipeline,
  referencia: ItemReferencia[],
  paginas: PaginaTexto[],
): Promise<LeituraCriterio> {
  let ano: number | null = null;
  let fonte: FonteRelatorio | null = null;
  let divergencias: { municipio: string; esperado: number; obtido: number }[] = [];

  let r = extrairTabelaCriterio(paginas, referencia, pipeline.colunasTotal);

  if (pipeline.slug === "turismo") {
    const { extrairTurismo } = await import("@/lib/icms/criterios/turismo");
    const t = extrairTurismo(paginas);
    if (t.ranking.length) r = t;
  }

  const ecologico = pipeline.slug === "meio_ambiente" || pipeline.slug === "meio-ambiente";
  if (ecologico && !r.itens.length) {
    const { extrairIcmsEcologico } = await import("@/lib/icms/criterios/ecologico");
    const e = extrairIcmsEcologico(paginas);
    if (e.itens.length) r = e;
  }

  if (pipeline.slug === "patrimonio_cultural") {
    const { ehRelatorioIepha, extrairPatrimonioCultural } = await import(
      "@/lib/icms/criterios/patrimonio"
    );
    if (ehRelatorioIepha(paginas)) {
      const p = extrairPatrimonioCultural(paginas);
      if (p.ranking.length) {
        r = p;
        divergencias = p.divergencias;
        if (p.exercicio) ano = p.exercicio;
        if (p.definitiva !== null) fonte = p.definitiva ? "definitivo" : "preliminar";
      }
    }
  }

  return {
    ranking: r.ranking,
    itens: r.itens,
    naoMapeados: r.naoMapeados,
    cabecalho: r.cabecalho,
    ano,
    fonte,
    divergencias,
  };
}

/** Converte o base64 devolvido pelo servidor nos bytes do arquivo. */
export function bytesDeBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
