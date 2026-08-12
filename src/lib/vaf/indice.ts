import { separarLinhas } from "./parser";

/**
 * Apuração do ÍNDICE (provisório = registro 16, definitivo = registro 17) do
 * arquivo de retorno da SEF-MG.
 *
 * Atenção: nos registros de índice (16/17), 12/13, 11, 23, 35 e 40 os valores
 * vêm em REAIS INTEIROS (sem decimais implícitas) — diferente dos registros
 * de declaração (07/10), onde há 2 decimais implícitas.
 */

const num = (linha: string, inicio: number, fim: number): number =>
  Number(linha.slice(inicio - 1, fim).replace(/[^0-9]/g, "") || 0);

const texto = (linha: string, inicio: number, fim: number): string =>
  linha.slice(inicio - 1, fim).trim();

export type LinhaMunicipio = {
  codigo: string;
  valor: number;
};

export type LinhaContribuinte = {
  inscricao_estadual: string;
  cnpj: string | null;
  nome: string | null;
  municipio: string;
  data: string | null;
  valor: number;
};

export type ApuracaoIndice = {
  tipoIndice: "provisorio" | "definitivo";
  codigoMunicipio: string;
  anoBase: number | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  /** VAF A */
  vafProprio: number;
  creditoExterno: number;
  /** VAF B */
  creditoInterno: number;
  creditoProprio: number;
  debito: number;
  /** VAF C */
  acertoCredito: number;
  acertoDebito: number;
  /** Resultado */
  valorLiquido: number;
  indice: number;
  vafEstadual: number;
  creditoProprioAf: number;
  creditoProprioSiare: number;
  /** Detalhamento */
  creditosExternos: LinhaContribuinte[];
  creditosPorMunicipio: LinhaMunicipio[];
  debitosPorMunicipio: LinhaMunicipio[];
  contribuintesVaf: LinhaContribuinte[];
  simei: LinhaContribuinte[];
  totalDeclaracoes: number;
};

function dataSefPonto(valor: string): string | null {
  // "1.1.2024" / "31.12.2024" -> ISO
  const partes = valor.trim().split(".");
  if (partes.length !== 3) return null;
  const [d, m, a] = partes;
  if (!d || !m || !a) return null;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function dataDdMmAaaa(valor: string): string | null {
  const d = valor.replace(/[^0-9]/g, "");
  if (d.length !== 8 || d === "00000000") return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

export function possuiIndice(textoRetorno: string): boolean {
  return separarLinhas(textoRetorno).some((l) => l.startsWith("16") || l.startsWith("17"));
}

export function apurarIndice(textoRetorno: string): ApuracaoIndice {
  const linhas = separarLinhas(textoRetorno);

  const linhaIndice =
    linhas.find((l) => l.startsWith("17")) ?? linhas.find((l) => l.startsWith("16"));
  if (!linhaIndice) {
    throw new Error(
      "O arquivo não contém registro de índice (tipo 16 provisório ou 17 definitivo).",
    );
  }
  const tipoIndice = linhaIndice.startsWith("17") ? "definitivo" : "provisorio";

  const linha99 = linhas.find((l) => l.startsWith("99"));
  const periodoInicio = linha99 ? dataSefPonto(texto(linha99, 44, 53)) : null;
  const periodoFim = linha99 ? dataSefPonto(texto(linha99, 54, 63)) : null;

  const creditosExternos: LinhaContribuinte[] = [];
  const contribuintesVaf: LinhaContribuinte[] = [];
  const simei: LinhaContribuinte[] = [];
  const creditosMapa = new Map<string, number>();
  const debitosMapa = new Map<string, number>();
  let totalDeclaracoes = 0;

  for (const l of linhas) {
    const tipo = l.slice(0, 2);
    if (tipo === "11") {
      creditosExternos.push({
        inscricao_estadual: texto(l, 22, 34),
        cnpj: texto(l, 96, 109).replace(/[^0-9]/g, "") || null,
        nome: texto(l, 38, 72) || null,
        municipio: texto(l, 35, 37),
        data: dataDdMmAaaa(texto(l, 73, 80)),
        valor: num(l, 81, 95),
      });
    } else if (tipo === "12") {
      const cod = texto(l, 19, 21);
      creditosMapa.set(cod, (creditosMapa.get(cod) ?? 0) + num(l, 52, 66));
    } else if (tipo === "13") {
      const cod = texto(l, 19, 21);
      debitosMapa.set(cod, (debitosMapa.get(cod) ?? 0) + num(l, 52, 66));
    } else if (tipo === "23") {
      contribuintesVaf.push({
        inscricao_estadual: texto(l, 6, 18),
        cnpj: null,
        nome: null,
        municipio: texto(l, 19, 21),
        data: null,
        valor: num(l, 37, 51),
      });
    } else if (tipo === "40" || tipo === "35") {
      const sinal = l[80] === "-" ? -1 : 1;
      const registro: LinhaContribuinte = {
        inscricao_estadual: texto(l, tipo === "40" ? 19 : 22, 34),
        cnpj: texto(l, 96, 109).replace(/[^0-9]/g, "") || null,
        nome: texto(l, 38, 72) || null,
        municipio: texto(l, 35, 37),
        data: dataDdMmAaaa(texto(l, 73, 80)),
        valor: sinal * num(l, 82, 95),
      };
      if (tipo === "40") simei.push(registro);
      else creditosExternos.push(registro);
    } else if (tipo === "10") {
      totalDeclaracoes += 1;
    }
  }

  const ordenar = (a: { valor: number }, b: { valor: number }) => b.valor - a.valor;
  creditosExternos.sort(ordenar);
  contribuintesVaf.sort(ordenar);
  simei.sort(ordenar);

  const paraLista = (mapa: Map<string, number>): LinhaMunicipio[] =>
    [...mapa.entries()]
      .map(([codigo, valor]) => ({ codigo, valor }))
      .sort((a, b) => b.valor - a.valor);

  const anoTexto = periodoFim?.slice(0, 4);

  return {
    tipoIndice,
    codigoMunicipio: texto(linhaIndice, 3, 5),
    anoBase: anoTexto ? Number(anoTexto) : null,
    periodoInicio,
    periodoFim,
    vafProprio: num(linhaIndice, 19, 33),
    creditoExterno: num(linhaIndice, 34, 48),
    creditoInterno: num(linhaIndice, 49, 63),
    creditoProprio: num(linhaIndice, 64, 78),
    debito: num(linhaIndice, 79, 93),
    acertoCredito: num(linhaIndice, 94, 108),
    acertoDebito: num(linhaIndice, 109, 123),
    valorLiquido: num(linhaIndice, 124, 138),
    // 9 dígitos com 7 casas decimais (ex.: 001033530 -> 0,103353)
    indice: num(linhaIndice, 139, 147) / 1e7,
    vafEstadual: num(linhaIndice, 148, 163),
    creditoProprioAf: num(linhaIndice, 164, 178),
    creditoProprioSiare: num(linhaIndice, 179, 193),
    creditosExternos,
    creditosPorMunicipio: paraLista(creditosMapa),
    debitosPorMunicipio: paraLista(debitosMapa),
    contribuintesVaf,
    simei,
    totalDeclaracoes,
  };
}

/** Conferência: líquido = próprio + créd. externo + créd. interno + créd. próprio − débito ± acertos */
export function conferirLiquido(a: ApuracaoIndice): { calculado: number; diferenca: number } {
  const calculado =
    a.vafProprio +
    a.creditoExterno +
    a.creditoInterno +
    a.creditoProprio -
    a.debito +
    a.acertoCredito -
    a.acertoDebito;
  return { calculado, diferenca: calculado - a.valorLiquido };
}

export function formatarIndice(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

export function csvIndice(a: ApuracaoIndice, nomeMunicipio: string): string {
  const br = (v: number) => v.toFixed(2).replace(".", ",");
  const linhas: string[][] = [
    ["Relatorio", `Indice ${a.tipoIndice}`],
    ["Municipio", `${a.codigoMunicipio} ${nomeMunicipio}`],
    ["Ano base", String(a.anoBase ?? "")],
    [],
    ["Bloco", "Item", "Valor (R$)"],
    ["VAF A", "VAF proprio", br(a.vafProprio)],
    ["VAF A", "Credito externo", br(a.creditoExterno)],
    ["VAF B", "Credito interno", br(a.creditoInterno)],
    ["VAF B", "Credito proprio", br(a.creditoProprio)],
    ["VAF B", "Debito", br(a.debito)],
    ["VAF C", "Acerto de credito", br(a.acertoCredito)],
    ["VAF C", "Acerto de debito", br(a.acertoDebito)],
    ["Indice", "Valor liquido", br(a.valorLiquido)],
    ["Indice", "Indice", a.indice.toFixed(6).replace(".", ",")],
    ["Indice", "VAF estadual", br(a.vafEstadual)],
    [],
    ["Creditos externos - IE", "Nome", "Municipio", "Valor (R$)"],
    ...a.creditosExternos.map((c) => [c.inscricao_estadual, c.nome ?? "", c.municipio, br(c.valor)]),
    [],
    ["Creditos por municipio", "Valor (R$)"],
    ...a.creditosPorMunicipio.map((m) => [m.codigo, br(m.valor)]),
    [],
    ["Debitos por municipio", "Valor (R$)"],
    ...a.debitosPorMunicipio.map((m) => [m.codigo, br(m.valor)]),
  ];
  return linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
}
