import { separarLinhas } from "./parser";

/**
 * "Outras entradas" (outras receitas) da DAMEF.
 *
 * Fontes no arquivo de retorno da SEF-MG:
 * - registro 07: total de outras entradas do contribuinte;
 * - registro 08: rateio desse total por município e por CLASSIFICAÇÃO
 *   (campo "tipo de detalhamento", códigos 1 a 8);
 * - registros 14/15/18/19/20/21/22: detalhamento por município de cada
 *   classificação (nem toda remessa traz);
 * - registro 23: receita bruta / VAF por município, com o total de outras
 *   entradas — usado como conferência.
 */

/** Códigos do campo "tipo de detalhamento" do registro 08. */
export const CLASSIFICACOES_OUTRAS_ENTRADAS: Record<string, string> = {
  "1": "Produtos agropecuários",
  "2": "Geração de energia elétrica",
  "3": "Transporte tomado",
  "4": "Cooperativas",
  "5": "Prestação de serviço de transporte rodoviário",
  "6": "Mudança de município",
  "7": "Outras entradas a detalhar por município",
  "8": "Resumo por município",
};

/** Registro de detalhamento que corresponde a cada classificação. */
const REGISTRO_DA_CLASSIFICACAO: Record<string, string> = {
  "1": "20",
  "2": "18",
  "3": "15",
  "4": "14",
  "5": "15",
  "6": "21",
  "7": "22",
  "8": "23",
};

export const rotuloClassificacao = (codigo: string): string =>
  CLASSIFICACOES_OUTRAS_ENTRADAS[String(Number(codigo) || 0)] ??
  (codigo && Number(codigo) > 0 ? `Classificação ${Number(codigo)}` : "Sem classificação");

const num = (linha: string, inicio: number, fim: number): number =>
  Number(linha.slice(inicio - 1, fim).replace(/[^0-9]/g, "") || 0);

const txt = (linha: string, inicio: number, fim: number): string =>
  linha.slice(inicio - 1, fim).trim();

const chaveIe = (v: string): string => v.replace(/[^0-9]/g, "").replace(/^0+/, "");

export type RateioOutrasEntradas = {
  /** código SEF do município que recebe o valor */
  municipio: string;
  /** código da classificação (1 a 8), "0" quando o arquivo não informou */
  classificacao: string;
  /** percentual aplicado (já em %) */
  percentual: number;
  /** valor informado no registro 08 */
  valor: number;
  /** valor efetivamente computado para o município */
  valorComputado: number;
};

export type DetalheOutrasEntradas = {
  /** tipo de registro (14/15/18/19/20/21/22) */
  registro: string;
  municipio: string;
  valor: number;
  cnpj: string | null;
};

export type ContribuinteOutrasEntradas = {
  inscricao_estadual: string;
  nome: string | null;
  cnpj: string | null;
  /** total de outras entradas (registro 07, com fallback no registro 10) */
  total: number;
  /** total conferido pelo registro 23 (0 quando ausente) */
  total23: number;
  rateios: RateioOutrasEntradas[];
  detalhes: DetalheOutrasEntradas[];
};

export type OutrasEntradasArquivo = {
  contribuintes: ContribuinteOutrasEntradas[];
  /** soma das outras entradas de todos os contribuintes */
  total: number;
  /** true quando o arquivo trouxe algum registro 14/15/18..22 */
  temDetalhamento: boolean;
};

const TIPOS_DETALHE = new Set(["14", "15", "18", "19", "20", "21", "22"]);

export function extrairOutrasEntradas(textoRetorno: string): OutrasEntradasArquivo {
  const linhas = separarLinhas(textoRetorno);

  const nomes = new Map<string, string>();
  const cnpjs = new Map<string, string>();
  const mapa = new Map<string, ContribuinteOutrasEntradas>();

  const obter = (ie: string): ContribuinteOutrasEntradas => {
    let c = mapa.get(ie);
    if (!c) {
      c = {
        inscricao_estadual: ie,
        nome: null,
        cnpj: null,
        total: 0,
        total23: 0,
        rateios: [],
        detalhes: [],
      };
      mapa.set(ie, c);
    }
    return c;
  };

  let temDetalhamento = false;

  for (const l of linhas) {
    const tipo = l.slice(0, 2);

    if (tipo === "01") {
      const ie = chaveIe(txt(l, 6, 18));
      const nome = txt(l, 23, 57);
      if (ie && nome && !nomes.has(ie)) nomes.set(ie, nome);
      continue;
    }

    if (tipo === "11" || tipo === "35" || tipo === "40") {
      const ie = chaveIe(txt(l, tipo === "40" ? 19 : 22, 34));
      if (!ie) continue;
      const nome = txt(l, 38, 72);
      const doc = txt(l, 96, 109).replace(/[^0-9]/g, "");
      if (nome && !nomes.has(ie)) nomes.set(ie, nome);
      if (doc && Number(doc) > 0 && !cnpjs.has(ie)) cnpjs.set(ie, doc.padStart(14, "0"));
      continue;
    }

    if (tipo === "10") {
      const ie = chaveIe(txt(l, 6, 18));
      if (!ie) continue;
      const doc = txt(l, 130, 143).replace(/[^0-9]/g, "");
      if (doc && Number(doc) > 0 && !cnpjs.has(ie)) cnpjs.set(ie, doc.padStart(14, "0"));
      // registro 10, 86-99: valor de outras entradas do VAF (fallback do 07)
      const c = obter(ie);
      if (c.total === 0) c.total = num(l, 86, 99);
      continue;
    }

    if (tipo === "07") {
      const ie = chaveIe(txt(l, 6, 18));
      if (!ie) continue;
      obter(ie).total = num(l, 49, 63);
      continue;
    }

    if (tipo === "08") {
      const ie = chaveIe(txt(l, 6, 18));
      if (!ie) continue;
      obter(ie).rateios.push({
        municipio: txt(l, 19, 21),
        classificacao: String(num(l, 37, 38)),
        percentual: num(l, 39, 43) / 100,
        valor: num(l, 22, 36),
        valorComputado: num(l, 44, 58),
      });
      continue;
    }

    if (tipo === "23") {
      const ie = chaveIe(txt(l, 6, 18));
      if (!ie) continue;
      obter(ie).total23 += num(l, 52, 66);
      continue;
    }

    if (TIPOS_DETALHE.has(tipo)) {
      const ie = chaveIe(txt(l, 6, 18));
      if (!ie) continue;
      temDetalhamento = true;
      const doc = txt(l, 40, 53).replace(/[^0-9]/g, "");
      obter(ie).detalhes.push({
        registro: tipo,
        municipio: txt(l, 19, 21),
        valor: num(l, 22, 36),
        cnpj: doc && Number(doc) > 0 ? doc.padStart(14, "0") : null,
      });
    }
  }

  const contribuintes: ContribuinteOutrasEntradas[] = [];
  for (const c of mapa.values()) {
    c.nome = nomes.get(c.inscricao_estadual) ?? null;
    c.cnpj = cnpjs.get(c.inscricao_estadual) ?? null;
    if (c.total === 0 && c.rateios.length === 0 && c.total23 === 0) continue;
    contribuintes.push(c);
  }
  contribuintes.sort((a, b) => b.total - a.total);

  return {
    contribuintes,
    total: contribuintes.reduce((s, c) => s + c.total, 0),
    temDetalhamento,
  };
}

/** Registro do arquivo que detalha aquela classificação (para a tela de detalhe). */
export const registroDaClassificacao = (codigo: string): string | null =>
  REGISTRO_DA_CLASSIFICACAO[String(Number(codigo) || 0)] ?? null;

export type LinhaClassificacao = {
  classificacao: string;
  rotulo: string;
  base: number;
  atual: number;
  diferenca: number;
  /** participação da classificação no total do arquivo atual (%) */
  participacao: number;
};

export type LinhaOutrasEntradas = {
  inscricao_estadual: string;
  nome: string | null;
  cnpj: string | null;
  classificacoes: string[];
  municipios: string[];
  percentual: number;
  base: number;
  atual: number;
  diferenca: number;
  variacaoPct: number | null;
  /** dados do arquivo atual (ou do base, quando saiu) para o detalhe */
  detalhe: ContribuinteOutrasEntradas | null;
};

export type ComparacaoOutrasEntradas = {
  totalBase: number;
  totalAtual: number;
  classificacoes: LinhaClassificacao[];
  linhas: LinhaOutrasEntradas[];
  temDetalhamento: boolean;
};

const somaPorClassificacao = (a: OutrasEntradasArquivo): Map<string, number> => {
  const m = new Map<string, number>();
  for (const c of a.contribuintes) {
    if (c.rateios.length === 0) {
      m.set("0", (m.get("0") ?? 0) + c.total);
      continue;
    }
    for (const r of c.rateios) {
      const valor = r.valorComputado || r.valor;
      m.set(r.classificacao, (m.get(r.classificacao) ?? 0) + valor);
    }
  }
  return m;
};

const VAZIO: OutrasEntradasArquivo = { contribuintes: [], total: 0, temDetalhamento: false };

export function compararOutrasEntradas(
  base: OutrasEntradasArquivo | undefined,
  atual: OutrasEntradasArquivo | undefined,
): ComparacaoOutrasEntradas {
  const b = base ?? VAZIO;
  const a = atual ?? VAZIO;

  const cb = somaPorClassificacao(b);
  const ca = somaPorClassificacao(a);
  const codigos = new Set([...cb.keys(), ...ca.keys()]);
  const classificacoes: LinhaClassificacao[] = [...codigos]
    .map((codigo) => {
      const vb = cb.get(codigo) ?? 0;
      const va = ca.get(codigo) ?? 0;
      return {
        classificacao: codigo,
        rotulo: rotuloClassificacao(codigo),
        base: vb,
        atual: va,
        diferenca: va - vb,
        participacao: a.total > 0 ? (va / a.total) * 100 : 0,
      };
    })
    .sort((x, y) => y.atual - x.atual || y.base - x.base);

  const mb = new Map(b.contribuintes.map((c) => [c.inscricao_estadual, c]));
  const ma = new Map(a.contribuintes.map((c) => [c.inscricao_estadual, c]));
  const ies = new Set([...mb.keys(), ...ma.keys()]);

  const linhas: LinhaOutrasEntradas[] = [...ies].map((ie) => {
    const x = mb.get(ie);
    const y = ma.get(ie);
    const fonte = y ?? x ?? null;
    const rateios = fonte?.rateios ?? [];
    const valorBase = x?.total ?? 0;
    const valorAtual = y?.total ?? 0;
    return {
      inscricao_estadual: ie,
      nome: y?.nome ?? x?.nome ?? null,
      cnpj: y?.cnpj ?? x?.cnpj ?? null,
      classificacoes: [...new Set(rateios.map((r) => r.classificacao))],
      municipios: [...new Set(rateios.map((r) => r.municipio))],
      percentual: rateios.reduce((s, r) => s + r.percentual, 0),
      base: valorBase,
      atual: valorAtual,
      diferenca: valorAtual - valorBase,
      variacaoPct:
        valorBase === 0 ? null : ((valorAtual - valorBase) / Math.abs(valorBase)) * 100,
      detalhe: fonte,
    };
  });

  linhas.sort((x, y) => y.atual - x.atual || Math.abs(y.diferenca) - Math.abs(x.diferenca));

  return {
    totalBase: b.total,
    totalAtual: a.total,
    classificacoes,
    linhas,
    temDetalhamento: a.temDetalhamento || b.temDetalhamento,
  };
}
