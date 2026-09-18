/**
 * Leitor da tabela oficial de pontuação do ICMS Patrimônio Cultural
 * (IEPHA-MG — Lei 18.030/2009, DN CONEP 01/2021 e Portaria IEPHA 34/2024).
 *
 * O relatório é um quadro em paisagem com 27 colunas identificadas por letras
 * (A a AA) e a maior parte das células vazia: as faixas de tombamento só têm
 * valor no município que se enquadra naquela faixa. Por isso a leitura é
 * posicional — cada número é ligado à coluna cujo centro está mais próximo —
 * usando a linha de letras impressa logo acima dos dados.
 *
 * Colunas:
 *   A  município
 *   B  Pontuação Política Cultural (Quadro I-A, máx. 4,00)
 *   C  Pontuação Investimentos e Despesas (Quadro I-B, máx. 3,00)
 *   D  Pontuação Inventário (Quadro II-A, máx. 2,00)
 *   E-H  Núcleo Histórico tombado (5, 8, 12 e 16 pontos por faixa de domicílios)
 *   I-L  Conjunto Urbano/Paisagístico (2, 3, 4 e 5 pontos por faixa de área)
 *   M-P  Bens Imóveis tombados (2, 4, 6 e 8 pontos por faixa de unidades)
 *   Q-S  Bens Móveis tombados (1, 2 e 3 pontos por faixa de unidades)
 *   T  Tombamentos com proteção federal e/ou estadual (Anexo II)
 *   U  Pontuação Tombamentos — somatório F/E/M das colunas E a T
 *   V-X  Bens imateriais registrados (2, 3 e 4 pontos por faixa)
 *   Y  Pontuação Registros — F/E/M (Quadros II-C e III-B)
 *   Z  Pontuação Educação e Difusão (Quadro III-C, máx. 2,00)
 *   AA Pontuação total
 *
 * A pontuação total é sempre B + C + D + U + Y + Z; o leitor confere essa soma
 * município a município e devolve as divergências, mantendo o total impresso.
 */

import type { CelulaPos, PaginaTexto } from "@/lib/icms/esportes/parser";
import { canonicalizarMunicipio } from "./municipiosMg";
import type { ItemMunicipio, RankingCriterio, ResultadoTabela } from "./tabela";

export type DivergenciaPatrimonio = {
  municipio: string;
  somaComponentes: number;
  totalImpresso: number;
};

export type ResultadoPatrimonio = ResultadoTabela & {
  divergencias: DivergenciaPatrimonio[];
  exercicio: number | null;
  definitiva: boolean | null;
};

type Faixa = { letra: string; pontos: number; descricao: string };

type Componente = {
  letra: string;
  codigo: string;
  nome: string;
  peso: number | null;
  faixas?: Faixa[];
  /** coluna com a proteção federal/estadual somada ao componente */
  letraFederal?: string;
};

const COMPONENTES: Componente[] = [
  {
    letra: "B",
    codigo: "pc_pcl",
    nome: "Política Municipal de Proteção do Patrimônio Cultural (Quadro I-A)",
    peso: 4,
  },
  {
    letra: "C",
    codigo: "pc_fu",
    nome: "Investimentos e Despesas / Fundo Municipal (Quadro I-B)",
    peso: 3,
  },
  { letra: "D", codigo: "pc_inv", nome: "Inventário de Proteção (Quadro II-A)", peso: 2 },
  {
    letra: "U",
    codigo: "pc_tomb",
    nome: "Pontuação Tombamentos (Quadros II-B e III-A)",
    peso: null,
    letraFederal: "T",
    faixas: [
      { letra: "E", pontos: 5, descricao: "Núcleo histórico — até 2.000 domicílios" },
      { letra: "F", pontos: 8, descricao: "Núcleo histórico — de 2.001 a 3.000 domicílios" },
      { letra: "G", pontos: 12, descricao: "Núcleo histórico — de 3.001 a 5.000 domicílios" },
      { letra: "H", pontos: 16, descricao: "Núcleo histórico — acima de 5.000 domicílios" },
      { letra: "I", pontos: 2, descricao: "Conjunto urbano/paisagístico — 0,2 a 1,9 hectare" },
      { letra: "J", pontos: 3, descricao: "Conjunto urbano/paisagístico — 2 a 4,9 hectares" },
      { letra: "K", pontos: 4, descricao: "Conjunto urbano/paisagístico — 5 a 10 hectares" },
      { letra: "L", pontos: 5, descricao: "Conjunto urbano/paisagístico — acima de 10 hectares" },
      { letra: "M", pontos: 2, descricao: "Bens imóveis tombados — 1 a 5 unidades" },
      { letra: "N", pontos: 4, descricao: "Bens imóveis tombados — 6 a 10 unidades" },
      { letra: "O", pontos: 6, descricao: "Bens imóveis tombados — 11 a 20 unidades" },
      { letra: "P", pontos: 8, descricao: "Bens imóveis tombados — acima de 20 unidades" },
      { letra: "Q", pontos: 1, descricao: "Bens móveis tombados — 1 a 20 unidades" },
      { letra: "R", pontos: 2, descricao: "Bens móveis tombados — 21 a 50 unidades" },
      { letra: "S", pontos: 3, descricao: "Bens móveis tombados — acima de 50 unidades" },
    ],
  },
  {
    letra: "Y",
    codigo: "pc_ri",
    nome: "Pontuação Registros de Bens Imateriais (Quadros II-C e III-B)",
    peso: null,
    faixas: [
      { letra: "V", pontos: 2, descricao: "De 1 a 5 bens registrados" },
      { letra: "W", pontos: 3, descricao: "De 6 a 10 bens registrados" },
      { letra: "X", pontos: 4, descricao: "Acima de 10 bens registrados" },
    ],
  },
  { letra: "Z", codigo: "pc_ep", nome: "Educação e Difusão (Quadro III-C)", peso: 2 },
];

const LETRAS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
];

const RE_NUM = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/;

function numero(texto: string): number | null {
  if (!RE_NUM.test(texto.trim())) return null;
  const n = Number(texto.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function centro(c: CelulaPos): number {
  return c.x + (c.largura || 0) / 2;
}

/** Junta linhas quase na mesma altura (o nome do município costuma sair 3pt acima dos números). */
function linhasMescladas(pagina: PaginaTexto): { y: number; celulas: CelulaPos[] }[] {
  const brutas = pagina.linhas
    .filter((l) => l.celulas && l.celulas.length)
    .map((l) => ({ y: l.y, celulas: [...(l.celulas ?? [])] }))
    .sort((a, b) => b.y - a.y);

  const saida: { y: number; celulas: CelulaPos[] }[] = [];
  for (const linha of brutas) {
    const anterior = saida[saida.length - 1];
    if (anterior && Math.abs(anterior.y - linha.y) <= 5) {
      anterior.celulas.push(...linha.celulas);
      anterior.celulas.sort((a, b) => a.x - b.x);
      continue;
    }
    saida.push(linha);
  }
  return saida;
}

/** Localiza a linha "A B C D ... AA" e devolve o centro de cada coluna. */
function colunasDaLegenda(linhas: { celulas: CelulaPos[] }[]): Map<string, number> | null {
  for (const linha of linhas) {
    const letras = linha.celulas.filter((c) => /^[A-Z]{1,2}$/.test(c.texto.trim()));
    if (letras.length < 20) continue;
    const sequencia = letras.map((c) => c.texto.trim());
    const esperado = LETRAS.slice(0, sequencia.length);
    if (sequencia.join(",") !== esperado.join(",")) continue;
    const mapa = new Map<string, number>();
    letras.forEach((c) => mapa.set(c.texto.trim(), centro(c)));
    return mapa;
  }
  return null;
}

function colunaDe(mapa: Map<string, number>, x: number): string | null {
  let melhor: string | null = null;
  let dist = Infinity;
  for (const [letra, cx] of mapa) {
    const d = Math.abs(cx - x);
    if (d < dist) {
      dist = d;
      melhor = letra;
    }
  }
  return dist <= 22 ? melhor : melhor;
}

/** Reconhece o relatório de pontuação do IEPHA antes de tentar o parser genérico. */
export function ehRelatorioIepha(paginas: PaginaTexto[]): boolean {
  const cabecalho = paginas
    .slice(0, 2)
    .flatMap((p) => p.linhas.map((l) => l.texto.toUpperCase()))
    .join(" | ");
  return (
    cabecalho.includes("IEPHA") &&
    cabecalho.includes("PATRIM") &&
    /PONTUA[ÇC][ÃA]O\s+(DEFINITIVA|PROVIS[ÓO]RIA)/.test(cabecalho)
  );
}

export function extrairPatrimonioCultural(paginas: PaginaTexto[]): ResultadoPatrimonio {
  const ranking: RankingCriterio[] = [];
  const itens: ItemMunicipio[] = [];
  const divergencias: DivergenciaPatrimonio[] = [];
  const vistos = new Set<string>();

  const cabecalho = paginas
    .slice(0, 2)
    .flatMap((p) => p.linhas.map((l) => l.texto))
    .join(" | ");
  const mExercicio = cabecalho.match(/EXERC[ÍI]CIO\s+(\d{4})/i);
  const exercicio = mExercicio ? Number(mExercicio[1]) : null;
  const definitiva = /PONTUA[ÇC][ÃA]O\s+DEFINITIVA/i.test(cabecalho)
    ? true
    : /PONTUA[ÇC][ÃA]O\s+PROVIS[ÓO]RIA/i.test(cabecalho)
      ? false
      : null;

  let colunas: Map<string, number> | null = null;

  for (const pagina of paginas) {
    const linhas = linhasMescladas(pagina);
    const legenda = colunasDaLegenda(linhas);
    if (legenda) colunas = legenda;
    if (!colunas) continue;
    const mapa = colunas;
    const inicioDados = mapa.get("B") ?? 0;

    for (const linha of linhas) {
      const numeros = linha.celulas.filter((c) => numero(c.texto) !== null);
      if (numeros.length < 4) continue;
      const nomeBruto = linha.celulas
        .filter((c) => numero(c.texto) === null && centro(c) < inicioDados - 5)
        .map((c) => c.texto)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!nomeBruto) continue;
      const oficial = canonicalizarMunicipio(nomeBruto);
      if (!oficial) continue;
      if (vistos.has(oficial.chave)) continue;

      const valores = new Map<string, number>();
      for (const c of numeros) {
        const letra = colunaDe(mapa, centro(c));
        if (!letra || letra === "A") continue;
        valores.set(letra, numero(c.texto) as number);
      }
      const total = valores.get("AA");
      if (total === undefined) continue;
      vistos.add(oficial.chave);

      for (const comp of COMPONENTES) {
        const pontuacao = valores.get(comp.letra) ?? 0;
        const marcadas = (comp.faixas ?? []).filter((f) => (valores.get(f.letra) ?? 0) > 0);
        const federal = comp.letraFederal ? (valores.get(comp.letraFederal) ?? 0) : 0;
        const partes = marcadas.map((f) => f.descricao);
        if (federal > 0) {
          partes.push(
            `Proteção federal e/ou estadual: ${federal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ponto(s)`,
          );
        }
        itens.push({
          municipio: oficial.chave,
          municipioNome: oficial.nome,
          itemNome: comp.nome,
          itemCodigo: comp.codigo,
          peso: comp.peso,
          pontuacao,
          quantidade: null,
          observacao: partes.length ? partes.join(" · ") : null,
        });
      }

      const soma =
        (valores.get("B") ?? 0) +
        (valores.get("C") ?? 0) +
        (valores.get("D") ?? 0) +
        (valores.get("U") ?? 0) +
        (valores.get("Y") ?? 0) +
        (valores.get("Z") ?? 0);
      if (Math.abs(soma - total) > 0.005) {
        divergencias.push({
          municipio: oficial.nome,
          somaComponentes: Number(soma.toFixed(2)),
          totalImpresso: total,
        });
      }

      ranking.push({
        municipio: oficial.chave,
        municipioNome: oficial.nome,
        posicao: null,
        notaFinal: total,
        indicePercentual: 0,
      });
    }
  }

  const maior = ranking.reduce((m, r) => Math.max(m, r.notaFinal), 0);
  ranking.sort((a, b) => b.notaFinal - a.notaFinal || a.municipioNome.localeCompare(b.municipioNome));
  ranking.forEach((r, i) => {
    r.posicao = i + 1;
    r.indicePercentual = maior > 0 ? Number(((r.notaFinal / maior) * 100).toFixed(4)) : 0;
  });

  return {
    ranking,
    itens,
    naoMapeados: [],
    cabecalho: ["Município", ...COMPONENTES.map((c) => c.nome), "Pontuação total"],
    divergencias,
    exercicio,
    definitiva,
  };
}
