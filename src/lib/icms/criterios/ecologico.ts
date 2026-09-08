/**
 * Parser dos relatórios do ICMS Ecológico (critério Meio Ambiente) publicados
 * pela SEMAD/IEF.
 *
 * Esses PDFs não têm o formato "uma linha por município com uma coluna por
 * item" do parser genérico: são quadros em duas colunas, com cabeçalhos
 * girados e três tabelas diferentes (saneamento, unidades de conservação com
 * fator de qualidade e mata seca). Por isso a leitura é feita por padrão de
 * linha, e não por cabeçalho: cada linha é varrida atrás das formas conhecidas
 * de registro, o que também resolve o caso de duas colunas coladas na mesma
 * linha.
 */

import { normalizarMunicipio, type PaginaTexto } from "@/lib/icms/esportes/parser";
import type { ItemMunicipio, ResultadoTabela } from "./tabela";

const NOME = "[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-Za-zÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç'’.\\- ]{2,60}?";

/** Saneamento: município, sistema, população, licença, k e investimento. */
const RE_SANEAMENTO = new RegExp(
  `(${NOME})\\s+(AS|ETE|UTC|ATERRO|UTL)\\s+([\\d.]+)\\s+([A-Z/]{2,12})\\s+([\\d.]+)\\s+(-|\\d+)\\s+(-|\\d+)\\s+(-|\\d+)\\s+R\\$\\s*([\\d.,]+)`,
  "g",
);

/** Unidade de conservação com fator de conservação e fator de qualidade. */
const RE_UC = new RegExp(
  `(\\d{2,6})\\s+(\\d{1,4})\\s+(${NOME})\\s+([\\d.]+)\\s+(.+?)\\s+(\\d{1,6})\\s+([A-Z]{2,8})\\s+(\\d{1,3})\\s+([01],\\d{1,2})\\s+([01],\\d{1,2})(?=\\s|$)`,
  "g",
);

/** Índice de conservação: código IBGE, código SEF, município e três valores. */
const RE_CONSERVACAO = new RegExp(
  `(\\d{3,6})\\s+(\\d{1,4})\\s+(${NOME})\\s+(-|[\\d.]*[\\d],\\d{6,12})\\s+(-|[\\d.]*[\\d],\\d{6,12})\\s+(-|[\\d.]*[\\d],\\d{6,12})(?=\\s|$)`,
  "g",
);

/** Quadro dos municípios habilitados: código IBGE, código SEF, município e o índice. */
const RE_INDICE = new RegExp(
  `(\\d{3,6})\\s+(\\d{1,4})\\s+(${NOME})\\s+(-|[\\d.]*[\\d],\\d{6,12})(?=\\s|$)`,
  "g",
);

function num(valor: string): number | null {
  const bruto = valor.trim();
  if (!bruto || bruto === "-") return null;
  const limpo = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function limparNome(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

export type ResultadoEcologico = ResultadoTabela & {
  saneamento: number;
  uc: number;
  conservacao: number;
  indice: number;
};


export function extrairIcmsEcologico(paginas: PaginaTexto[]): ResultadoEcologico {
  const itens: ItemMunicipio[] = [];
  let saneamento = 0;
  let uc = 0;
  let conservacao = 0;
  let indice = 0;

  const push = (
    nome: string,
    itemNome: string,
    itemCodigo: string,
    pontuacao: number | null,
    observacao: string | null,
  ) => {
    const municipioNome = limparNome(nome);
    const municipio = normalizarMunicipio(municipioNome);
    if (!municipio || municipio.length < 3) return false;
    itens.push({
      municipio,
      municipioNome,
      itemNome,
      itemCodigo,
      peso: null,
      pontuacao,
      quantidade: null,
      observacao,
    });
    return true;
  };

  for (const pagina of paginas) {
    const textos = pagina.linhas
      .map((l) => l.texto.replace(/\s+/g, " ").trim())
      .filter((t) => t.length >= 12);

    for (const texto of textos) {
      let achou = false;
      RE_SANEAMENTO.lastIndex = 0;
      for (const m of texto.matchAll(RE_SANEAMENTO)) {
        const ok = push(
          m[1] ?? "",
          "Saneamento ambiental",
          "saneamento",
          num(m[9] ?? ""),
          `${m[2]} · licença ${m[4]} · população atendida ${m[5]}`,
        );
        achou = achou || ok;
        if (ok) saneamento++;
      }
      if (achou) continue;

      RE_UC.lastIndex = 0;
      for (const m of texto.matchAll(RE_UC)) {
        const ok = push(
          m[3] ?? "",
          "Unidades de conservação",
          "unidades_conservacao",
          num(m[10] ?? ""),
          `${limparNome(m[5] ?? "")} · categoria ${m[7]} · fator de conservação ${m[9]}`,
        );
        achou = achou || ok;
        if (ok) uc++;
      }
      if (achou) continue;

      RE_CONSERVACAO.lastIndex = 0;
      for (const m of texto.matchAll(RE_CONSERVACAO)) {
        const ok = push(
          m[3] ?? "",
          "Índice de conservação",
          "indice_conservacao",
          num(m[4] ?? ""),
          `apurado ${m[5]} · final ${m[6]}`,
        );
        achou = achou || ok;
        if (ok) conservacao++;
      }
      if (achou) continue;

      RE_INDICE.lastIndex = 0;
      for (const m of texto.matchAll(RE_INDICE)) {
        const ok = push(m[3] ?? "", "Índice do critério publicado", "indice_criterio", num(m[4] ?? ""), null);
        if (ok) indice++;
      }
    }
  }

  const ranking = new Map<string, { municipio: string; municipioNome: string; nota: number }>();
  for (const item of itens) {
    if (item.itemCodigo !== "indice_criterio" && item.itemCodigo !== "indice_conservacao") continue;
    const atual = ranking.get(item.municipio) ?? {
      municipio: item.municipio,
      municipioNome: item.municipioNome,
      nota: 0,
    };
    atual.nota = Math.max(atual.nota, item.pontuacao ?? 0);
    ranking.set(item.municipio, atual);
  }


  return {
    itens,
    ranking: [...ranking.values()]
      .sort((a, b) => b.nota - a.nota)
      .map((l, i) => ({
        municipio: l.municipio,
        municipioNome: l.municipioNome,
        posicao: i + 1,
        notaFinal: l.nota,
        indicePercentual: 0,
      })),
    naoMapeados: [],
    cabecalho: ["Saneamento ambiental", "Unidades de conservação", "Mata seca"],
    saneamento,
    uc,
    mata,
  };
}
