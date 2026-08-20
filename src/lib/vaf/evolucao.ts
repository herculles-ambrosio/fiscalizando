import { separarLinhas } from "./parser";
import {
  apurarIndice,
  estimarIndiceProvisorio,
  possuiIndice,
  type ApuracaoIndice,
} from "./indice";

/**
 * Comparação de EVOLUÇÃO entre dois arquivos de retorno da SEF-MG
 * (mensal, índice provisório ou índice definitivo).
 *
 * Cada arquivo é apurado com o mesmo motor do módulo "Índice do VAF":
 * quando há registro 16/17 usamos o índice fechado, caso contrário
 * estimamos o provisório a partir dos registros 10/11/12/13/35/40.
 */

const num = (linha: string, inicio: number, fim: number): number =>
  Number(linha.slice(inicio - 1, fim).replace(/[^0-9]/g, "") || 0);

const txt = (linha: string, inicio: number, fim: number): string =>
  linha.slice(inicio - 1, fim).trim();

function dataDdMmAaaa(valor: string): string | null {
  const d = valor.replace(/[^0-9]/g, "");
  if (d.length !== 8 || d === "00000000") return null;
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}

/** Registro do arquivo de onde o dado foi aproveitado. */
export type OrigemDado = "01" | "11" | "35" | "40" | "10" | null;

export const rotuloOrigem = (o: OrigemDado): string => {
  switch (o) {
    case "01":
      return "Registro 01 (identificação DAMEF)";
    case "10":
      return "Registro 10 (declaração de VAF)";
    case "11":
      return "Registro 11 (VAF por município)";
    case "35":
      return "Registro 35 (acertos/complemento)";
    case "40":
      return "Registro 40 (Simples Nacional / SIMEI)";
    default:
      return "Não encontrado no arquivo";
  }
};

export type Declarante = {
  inscricao_estadual: string;
  cnpj: string | null;
  nome: string | null;
  exercicio: number | null;
  data_entrega: string | null;
  /** VAF declarado (registro 10, com sinal) */
  vaf: number;
  /** registro usado para o nome (null = não localizado) */
  origemNome: OrigemDado;
  /** registro usado para o CNPJ (null = não localizado) */
  origemCnpj: OrigemDado;
};

/** Declarantes do arquivo (registro 10), com nome/CNPJ herdados dos registros 01/10/11/35/40. */
export function extrairDeclarantes(textoRetorno: string): Declarante[] {
  const linhas = separarLinhas(textoRetorno);
  const chave = (v: string) => v.replace(/[^0-9]/g, "").replace(/^0+/, "");

  const nomes = new Map<string, { valor: string; origem: OrigemDado }>();
  const cnpjs = new Map<string, { valor: string; origem: OrigemDado }>();

  for (const l of linhas) {
    const tipo = l.slice(0, 2);
    // Registro 01 (identificação da DAMEF): nome do contribuinte
    if (tipo === "01") {
      const ie = chave(txt(l, 6, 18));
      const nome = txt(l, 23, 57);
      if (ie && nome && !nomes.has(ie)) nomes.set(ie, { valor: nome, origem: "01" });
      continue;
    }
    // Registros de VAF por município / SIMEI: nome e CNPJ
    if (tipo === "11" || tipo === "35" || tipo === "40") {
      const ie = chave(txt(l, tipo === "40" ? 19 : 22, 34));
      if (!ie) continue;
      const nome = txt(l, 38, 72);
      const cnpj = txt(l, 96, 109).replace(/[^0-9]/g, "");
      if (nome && !nomes.has(ie)) nomes.set(ie, { valor: nome, origem: tipo as OrigemDado });
      if (cnpj && Number(cnpj) > 0 && !cnpjs.has(ie))
        cnpjs.set(ie, { valor: cnpj.padStart(14, "0"), origem: tipo as OrigemDado });
    }
  }

  const mapa = new Map<string, Declarante>();
  for (const l of linhas) {
    if (l.slice(0, 2) !== "10") continue;
    const ie = chave(txt(l, 6, 18));
    if (!ie) continue;
    const sinal = l[114] === "-" ? -1 : 1;
    const vaf = sinal * num(l, 116, 129);
    const ex = num(l, 19, 22);
    // Registro 10, campo 130-143: CNPJ/CPF do declarante
    const doc = txt(l, 130, 143).replace(/[^0-9]/g, "");
    if (doc && Number(doc) > 0 && !cnpjs.has(ie))
      cnpjs.set(ie, { valor: doc.padStart(14, "0"), origem: "10" });
    const existente = mapa.get(ie);
    if (existente) {
      existente.vaf += vaf;
    } else {
      mapa.set(ie, {
        inscricao_estadual: ie,
        cnpj: null,
        nome: null,
        exercicio: ex > 1990 ? ex : null,
        data_entrega: dataDdMmAaaa(txt(l, 23, 30)),
        vaf,
        origemNome: null,
        origemCnpj: null,
      });
    }
  }

  for (const d of mapa.values()) {
    const n = nomes.get(d.inscricao_estadual);
    const c = cnpjs.get(d.inscricao_estadual);
    d.nome = n?.valor ?? null;
    d.origemNome = n?.origem ?? null;
    d.cnpj = c?.valor ?? null;
    d.origemCnpj = c?.origem ?? null;
  }

  return [...mapa.values()].sort((a, b) => b.vaf - a.vaf);
}


export type ArquivoEvolucao = {
  nome: string;
  apuracao: ApuracaoIndice;
  declarantes: Declarante[];
  /** true quando o arquivo trazia registro 16/17 (índice fechado pela SEF) */
  temIndiceFechado: boolean;
};

export function analisarArquivo(
  nome: string,
  textoRetorno: string,
  opcoes: { vafEstadualReferencia?: number; fatorCalibragem?: number } = {},
): ArquivoEvolucao {
  const temIndiceFechado = possuiIndice(textoRetorno);
  const apuracao = temIndiceFechado
    ? apurarIndice(textoRetorno)
    : estimarIndiceProvisorio(textoRetorno, opcoes);
  return {
    nome,
    apuracao,
    declarantes: extrairDeclarantes(textoRetorno),
    temIndiceFechado,
  };
}

export type LinhaEvolucao = {
  chave: string;
  rotulo: string;
  base: number;
  atual: number;
  diferenca: number;
  variacaoPct: number | null;
  /** formato do valor na tabela */
  formato: "moeda" | "indice" | "inteiro";
};

const pct = (base: number, atual: number): number | null =>
  base === 0 ? null : ((atual - base) / Math.abs(base)) * 100;

export function linhasEvolucao(base: ApuracaoIndice, atual: ApuracaoIndice): LinhaEvolucao[] {
  const itens: Array<[string, string, number, number, LinhaEvolucao["formato"]]> = [
    ["vafProprio", "VAF próprio (VAF A)", base.vafProprio, atual.vafProprio, "moeda"],
    ["creditoExterno", "Crédito externo (VAF A)", base.creditoExterno, atual.creditoExterno, "moeda"],
    ["creditoInterno", "Crédito interno (VAF B)", base.creditoInterno, atual.creditoInterno, "moeda"],
    ["creditoProprio", "Crédito próprio (VAF B)", base.creditoProprio, atual.creditoProprio, "moeda"],
    ["debito", "Débito (VAF B)", base.debito, atual.debito, "moeda"],
    ["acertoCredito", "Acerto de crédito (VAF C)", base.acertoCredito, atual.acertoCredito, "moeda"],
    ["acertoDebito", "Acerto de débito (VAF C)", base.acertoDebito, atual.acertoDebito, "moeda"],
    ["valorLiquido", "Valor líquido do VAF", base.valorLiquido, atual.valorLiquido, "moeda"],
    ["vafEstadual", "VAF estadual", base.vafEstadual, atual.vafEstadual, "moeda"],
    ["indice", "Índice de participação (%)", base.indice, atual.indice, "indice"],
    [
      "totalDeclaracoes",
      "Declarações no arquivo",
      base.totalDeclaracoes,
      atual.totalDeclaracoes,
      "inteiro",
    ],
  ];

  return itens.map(([chave, rotulo, b, a, formato]) => ({
    chave,
    rotulo,
    base: b,
    atual: a,
    diferenca: a - b,
    variacaoPct: pct(b, a),
    formato,
  }));
}

export type MovimentoDeclarante = {
  inscricao_estadual: string;
  nome: string | null;
  cnpj: string | null;
  vafBase: number;
  vafAtual: number;
  diferenca: number;
  variacaoPct: number | null;
  situacao: "saiu" | "entrou" | "manteve";
  /** registro de onde o nome foi aproveitado */
  origemNome: OrigemDado;
  /** registro de onde o CNPJ foi aproveitado */
  origemCnpj: OrigemDado;
  /** true quando faltou nome e/ou CNPJ em todos os registros do arquivo */
  cadastroIncompleto: boolean;
};


export type ComparacaoDeclarantes = {
  sairam: MovimentoDeclarante[];
  entraram: MovimentoDeclarante[];
  permaneceram: MovimentoDeclarante[];
  todos: MovimentoDeclarante[];
};

export function compararDeclarantes(
  base: Declarante[],
  atual: Declarante[],
): ComparacaoDeclarantes {
  const mapaBase = new Map(base.map((d) => [d.inscricao_estadual, d]));
  const mapaAtual = new Map(atual.map((d) => [d.inscricao_estadual, d]));
  const chaves = new Set([...mapaBase.keys(), ...mapaAtual.keys()]);

  const todos: MovimentoDeclarante[] = [];
  for (const ie of chaves) {
    const b = mapaBase.get(ie);
    const a = mapaAtual.get(ie);
    const vafBase = b?.vaf ?? 0;
    const vafAtual = a?.vaf ?? 0;
    const nome = a?.nome ?? b?.nome ?? null;
    const cnpj = a?.cnpj ?? b?.cnpj ?? null;
    todos.push({
      inscricao_estadual: ie,
      nome,
      cnpj,
      vafBase,
      vafAtual,
      diferenca: vafAtual - vafBase,
      variacaoPct: pct(vafBase, vafAtual),
      situacao: !a ? "saiu" : !b ? "entrou" : "manteve",
      origemNome: (a?.nome ? a.origemNome : b?.nome ? b.origemNome : null) ?? null,
      origemCnpj: (a?.cnpj ? a.origemCnpj : b?.cnpj ? b.origemCnpj : null) ?? null,
      cadastroIncompleto: !nome || !cnpj,
    });

  }

  const porImpacto = (x: MovimentoDeclarante, y: MovimentoDeclarante) =>
    Math.abs(y.diferenca) - Math.abs(x.diferenca);

  return {
    todos: todos.sort(porImpacto),
    sairam: todos.filter((d) => d.situacao === "saiu").sort((a, b) => b.vafBase - a.vafBase),
    entraram: todos.filter((d) => d.situacao === "entrou").sort((a, b) => b.vafAtual - a.vafAtual),
    permaneceram: todos.filter((d) => d.situacao === "manteve").sort(porImpacto),
  };
}

export type MovimentoMunicipio = {
  codigo: string;
  nome: string | undefined;
  base: number;
  atual: number;
  diferenca: number;
};

export function compararMunicipios(
  base: Array<{ codigo: string; nome: string | undefined; valor: number }>,
  atual: Array<{ codigo: string; nome: string | undefined; valor: number }>,
): MovimentoMunicipio[] {
  const mb = new Map(base.map((m) => [m.codigo, m]));
  const ma = new Map(atual.map((m) => [m.codigo, m]));
  const chaves = new Set([...mb.keys(), ...ma.keys()]);
  return [...chaves]
    .map((codigo) => {
      const b = mb.get(codigo);
      const a = ma.get(codigo);
      return {
        codigo,
        nome: a?.nome ?? b?.nome,
        base: b?.valor ?? 0,
        atual: a?.valor ?? 0,
        diferenca: (a?.valor ?? 0) - (b?.valor ?? 0),
      };
    })
    .sort((x, y) => Math.abs(y.diferenca) - Math.abs(x.diferenca));
}

/** Memória de cálculo do valor líquido de uma apuração. */
export function memoriaCalculo(a: ApuracaoIndice): Array<{ rotulo: string; valor: number; operador: string }> {
  return [
    { operador: "", rotulo: "VAF próprio (VAF A-1 + SN + SIMEI)", valor: a.vafProprio },
    { operador: "+", rotulo: "Crédito externo (11/35)", valor: a.creditoExterno },
    { operador: "+", rotulo: "Crédito interno (12)", valor: a.creditoInterno },
    { operador: "+", rotulo: "Crédito próprio (AF/SIARE)", valor: a.creditoProprio },
    { operador: "−", rotulo: "Débito (13)", valor: a.debito },
    { operador: "+", rotulo: "Acerto de crédito", valor: a.acertoCredito },
    { operador: "−", rotulo: "Acerto de débito", valor: a.acertoDebito },
    { operador: "=", rotulo: "Valor líquido do VAF", valor: a.valorLiquido },
  ];
}

const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

export function csvEvolucao(
  baseNome: string,
  atualNome: string,
  linhas: LinhaEvolucao[],
  declarantes: ComparacaoDeclarantes,
  analise?: string,
): string {
  const br = (v: number) => v.toFixed(2).replace(".", ",");
  const out: string[][] = [
    ["Comparativo de evolucao"],
    ["Arquivo base", baseNome],
    ["Arquivo atual", atualNome],
    [],
    ...(analise
      ? [
          ["Analise automatica da variacao"],
          ...analise.split("\n").map((l) => [l]),
          [],
        ]
      : []),
    ["Indicador", "Base", "Atual", "Diferenca", "Variacao %"],

    ...linhas.map((l) => [
      l.rotulo,
      br(l.base),
      br(l.atual),
      br(l.diferenca),
      l.variacaoPct === null ? "" : br(l.variacaoPct),
    ]),
    [],
    ["Situacao", "IE", "CNPJ", "Contribuinte", "VAF base", "VAF atual", "Diferenca", "Cadastro", "Origem nome", "Origem CNPJ"],
    ...declarantes.todos.map((d) => [
      d.situacao === "saiu" ? "Deixou de declarar" : d.situacao === "entrou" ? "Novo declarante" : "Manteve",
      d.inscricao_estadual,
      d.cnpj ?? "",
      d.nome ?? "",
      br(d.vafBase),
      br(d.vafAtual),
      br(d.diferenca),
      d.cadastroIncompleto
        ? [!d.nome ? "sem nome" : null, !d.cnpj ? "sem CNPJ" : null].filter(Boolean).join(" e ")
        : "completo",
      rotuloOrigem(d.origemNome),
      rotuloOrigem(d.origemCnpj),
    ]),

  ];
  return out.map((linha) => linha.map((c) => esc(String(c))).join(";")).join("\n");
}
