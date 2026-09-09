/**
 * Parser do relatório oficial do ICMS Turismo (Secult-MG / icmsturismo.mg.gov.br).
 *
 * A publicação (Diário do Executivo) traz um quadro único com uma linha por
 * município habilitado no formato:
 *
 *   Nº  Município  Circuito Turístico  Nota  RLPC  IRC  Nota x IRC  IIT  Índice de Participação
 *
 * Ex.: "2  Abre Campo  Montanhas e Fé  9.25  4104.90  7  64.75  0.011320  0.198700"
 *
 * Como o nome do município e o do circuito ficam colados (o PDF perde o
 * alinhamento das colunas), a separação é feita conferindo o maior prefixo que
 * corresponde a um município mineiro da relação oficial.
 */

import type { PaginaTexto } from "@/lib/icms/esportes/parser";
import { municipioExato } from "./municipiosMg";
import type { ItemMunicipio, ResultadoTabela } from "./tabela";

const RE_NUM = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:\.\d+)?$/;

function num(valor: string): number | null {
  const bruto = valor.trim();
  if (!bruto || bruto === "-") return null;
  const limpo = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : /^-?\d+\.\d+$/.test(bruto)
      ? bruto
      : bruto.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export type LinhaTurismo = {
  municipio: string;
  municipioNome: string;
  circuito: string;
  nota: number | null;
  rlpc: number | null;
  irc: number | null;
  notaIrc: number | null;
  iit: number | null;
  indice: number;
};

const CELULA = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:\.\d+)?$|^S\.?\s?I\.?$/i;

/**
 * Em algumas publicações o extrator do PDF perde a vírgula/ponto decimal e a
 * linha chega como "9 25 4888 50 7 64 75 0 010830 0 196900". Nesse caso a
 * cauda tem onze números em vez de seis, e cada valor decimal vem quebrado em
 * duas partes (inteiro e casas decimais).
 */
function remontarSemDecimal(cauda: string[]): string[] | null {
  if (cauda.length !== 11) return null;
  const j = (a: string, b: string) => `${a}.${b}`;
  return [
    j(cauda[0]!, cauda[1]!),
    j(cauda[2]!, cauda[3]!),
    cauda[4]!,
    j(cauda[5]!, cauda[6]!),
    j(cauda[7]!, cauda[8]!),
    j(cauda[9]!, cauda[10]!),
  ];
}

/** Lê uma linha do quadro; devolve `null` quando a linha não é de município. */
export function lerLinhaTurismo(texto: string): LinhaTurismo | null {
  const tokens = texto.replace(/\s+/g, " ").trim().split(" ");
  if (tokens.length < 8) return null;

  // Conta quantas células numéricas encerram a linha para saber se o PDF veio
  // com os decimais preservados (6 células) ou quebrados (11 células).
  let inicio = tokens.length;
  while (inicio > 0 && CELULA.test(tokens[inicio - 1] ?? "")) inicio--;
  const cauda = tokens.slice(inicio);

  const quebrado = remontarSemDecimal(cauda.slice(-11));
  const usados = quebrado ? 11 : 6;
  const valores = quebrado ?? tokens.slice(-6);
  const numericos = valores.filter((v) => RE_NUM.test(v)).length;
  if (numericos < 5 || !RE_NUM.test(valores[5] ?? "")) return null;

  const cabeca = tokens.slice(0, tokens.length - usados);

  const primeiro = cabeca[0] ?? "";
  if (!/^\d{1,3}[.ºo)]?$/.test(primeiro)) return null;

  const palavras = cabeca.slice(1);
  if (!palavras.length) return null;

  let encontrado: { oficial: ReturnType<typeof municipioExato>; corte: number } | null = null;
  for (let corte = Math.min(palavras.length, 7); corte >= 1; corte--) {
    const oficial = municipioExato(palavras.slice(0, corte).join(" "));
    if (oficial) {
      encontrado = { oficial, corte };
      break;
    }
  }
  if (!encontrado?.oficial) return null;

  const indice = num(valores[5] ?? "");
  if (indice == null) return null;

  return {
    municipio: encontrado.oficial.chave,
    municipioNome: encontrado.oficial.nome,
    circuito: palavras.slice(encontrado.corte).join(" ").trim(),
    nota: num(valores[0] ?? ""),
    rlpc: num(valores[1] ?? ""),
    irc: num(valores[2] ?? ""),
    notaIrc: num(valores[3] ?? ""),
    iit: num(valores[4] ?? ""),
    indice,
  };
}

export function extrairTurismo(paginas: PaginaTexto[]): ResultadoTabela {
  const lidas = new Map<string, LinhaTurismo>();

  for (const pagina of paginas) {
    for (const linha of pagina.linhas) {
      const l = lerLinhaTurismo(linha.texto);
      if (l && !lidas.has(l.municipio)) lidas.set(l.municipio, l);
    }
  }

  const itens: ItemMunicipio[] = [];
  const registrar = (
    l: LinhaTurismo,
    itemNome: string,
    itemCodigo: string,
    pontuacao: number | null,
    observacao: string | null,
  ) => {
    itens.push({
      municipio: l.municipio,
      municipioNome: l.municipioNome,
      itemNome,
      itemCodigo,
      peso: null,
      pontuacao,
      quantidade: pontuacao,
      observacao,
    });
  };

  for (const l of lidas.values()) {
    registrar(l, "Circuito turístico", "tur_circuito", l.circuito ? 1 : 0, l.circuito || null);
    registrar(l, "Nota da habilitação", "tur_nota", l.nota, null);
    registrar(l, "Receita líquida per capita (RLPC)", "tur_rlpc", l.rlpc, null);
    registrar(l, "Índice de Receita e Circuito (IRC)", "tur_irc", l.irc, null);
    registrar(l, "Nota x IRC", "tur_nota_irc", l.notaIrc, null);
    registrar(l, "Investimento em Turismo do Município (IIT)", "tur_iit", l.iit, null);
    registrar(l, "Índice de participação no critério", "tur_indice", l.indice, null);
  }

  const ranking = [...lidas.values()]
    .sort((a, b) => b.indice - a.indice)
    .map((l, i) => ({
      municipio: l.municipio,
      municipioNome: l.municipioNome,
      posicao: i + 1,
      notaFinal: l.indice,
      indicePercentual: l.indice,
    }));

  return {
    ranking,
    itens,
    naoMapeados: [],
    cabecalho: [
      "Município",
      "Circuito",
      "Nota",
      "RLPC",
      "IRC",
      "Nota x IRC",
      "IIT",
      "Índice de participação",
    ],
  };
}
