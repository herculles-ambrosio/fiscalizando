import { compararDeclarantes, type ArquivoEvolucao, type MovimentoDeclarante } from "./evolucao";

/**
 * Diagnóstico automático da variação do valor líquido entre dois arquivos
 * (base × comparado/estimado) da Evolução do VAF.
 *
 * Duas visões complementares, cada uma fechando com a variação total:
 *  - por COMPONENTE do valor líquido (VAF A/B/C do próprio motor de índice);
 *  - por DECLARANTE (saídas, entradas, quedas e altas de quem permaneceu).
 */

export type SentidoFator = "aumentou" | "reduziu" | "neutro";

export type ItemDetalhe = {
  chave: string;
  rotulo: string;
  sub?: string;
  valorBase: number;
  valorAtual: number;
  impacto: number;
};

export type FatorVariacao = {
  chave: string;
  rotulo: string;
  detalhe: string;
  /** impacto em R$ sobre o valor líquido (positivo = empurrou para cima) */
  impacto: number;
  /** participação no total da variação, em % (0-100) */
  peso: number;
  sentido: SentidoFator;
  /** linhas que compõem o fator (contribuintes ou valores base × comparado) */
  itens: ItemDetalhe[];
  /** total de itens antes do corte de exibição */
  totalItens: number;
};


export type DiagnosticoEvolucao = {
  valorBase: number;
  valorAtual: number;
  diferenca: number;
  variacaoPct: number | null;
  sentido: SentidoFator;
  /** decomposição pelos componentes do valor líquido */
  fatores: FatorVariacao[];
  /** decomposição pela movimentação de declarantes (registro 10) */
  fatoresDeclarantes: FatorVariacao[];
  topQuedas: MovimentoDeclarante[];
  topAltas: MovimentoDeclarante[];
  resumo: string;
  conclusao: string;
  alertas: string[];
};

const moeda = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const pctTexto = (v: number): string =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const sentidoDe = (v: number): SentidoFator =>
  Math.abs(v) < 0.005 ? "neutro" : v > 0 ? "aumentou" : "reduziu";

function montarFatores(
  itens: Array<{
    chave: string;
    rotulo: string;
    detalhe: string;
    impacto: number;
    itens?: ItemDetalhe[];
    totalItens?: number;
  }>,
): FatorVariacao[] {
  const totalAbs = itens.reduce((s, i) => s + Math.abs(i.impacto), 0);
  return itens
    .filter((i) => Math.abs(i.impacto) >= 0.005)
    .map((i) => ({
      ...i,
      itens: i.itens ?? [],
      totalItens: i.totalItens ?? i.itens?.length ?? 0,
      peso: totalAbs === 0 ? 0 : (Math.abs(i.impacto) / totalAbs) * 100,
      sentido: sentidoDe(i.impacto),
    }))
    .sort((a, b) => Math.abs(b.impacto) - Math.abs(a.impacto));
}

const LIMITE_ITENS = 25;

const itensDeclarantes = (lista: MovimentoDeclarante[]): ItemDetalhe[] =>
  lista.slice(0, LIMITE_ITENS).map((d) => ({
    chave: d.inscricao_estadual,
    rotulo: d.nome ?? "(sem nome)",
    sub: `IE ${d.inscricao_estadual}`,
    valorBase: d.vafBase,
    valorAtual: d.vafAtual,
    impacto: d.diferenca,
  }));


export function diagnosticarEvolucao(
  base: ArquivoEvolucao,
  atual: ArquivoEvolucao,
): DiagnosticoEvolucao {
  const b = base.apuracao;
  const a = atual.apuracao;

  const valorBase = b.valorLiquido;
  const valorAtual = a.valorLiquido;
  const diferenca = valorAtual - valorBase;
  const variacaoPct = valorBase === 0 ? null : (diferenca / Math.abs(valorBase)) * 100;
  const sentido = sentidoDe(diferenca);

  // ---- Visão 1: componentes do valor líquido -------------------------------
  // valorLíquido = vafProprio + creditoExterno + creditoInterno + creditoProprio
  //                − debito + acertoCredito − acertoDebito
  const comp: Array<[string, string, string, number, number, number]> = [
    ["vafProprio", "VAF próprio (VAF A)", "Registros 07/23/40 — declarações do próprio município", b.vafProprio, a.vafProprio, 1],
    ["creditoExterno", "Crédito externo (VAF A)", "Registros 11/35 — VAF gerado por contribuintes de outros municípios", b.creditoExterno, a.creditoExterno, 1],
    ["creditoInterno", "Crédito interno (VAF B)", "Registro 12", b.creditoInterno, a.creditoInterno, 1],
    ["creditoProprio", "Crédito próprio (VAF B)", "AF/SIARE", b.creditoProprio, a.creditoProprio, 1],
    ["debito", "Débito (VAF B)", "Registro 13 — reduz o valor líquido", b.debito, a.debito, -1],
    ["acertoCredito", "Acerto de crédito (VAF C)", "Acertos que somam ao valor líquido", b.acertoCredito, a.acertoCredito, 1],
    ["acertoDebito", "Acerto de débito (VAF C)", "Acertos que reduzem o valor líquido", b.acertoDebito, a.acertoDebito, -1],
  ];

  const fatores = montarFatores(
    comp.map(([chave, rotulo, detalhe, vb, va, sinal]) => ({
      chave,
      rotulo,
      detalhe,
      impacto: sinal * (va - vb),
    })),
  );

  // ---- Visão 2: movimentação de declarantes --------------------------------
  const cmp = compararDeclarantes(base.declarantes, atual.declarantes);
  const perdaSaidas = cmp.sairam.reduce((s, d) => s + d.vafBase, 0);
  const ganhoEntradas = cmp.entraram.reduce((s, d) => s + d.vafAtual, 0);
  const quedas = cmp.permaneceram.filter((d) => d.diferenca < 0);
  const altas = cmp.permaneceram.filter((d) => d.diferenca > 0);
  const somaQuedas = quedas.reduce((s, d) => s + d.diferenca, 0);
  const somaAltas = altas.reduce((s, d) => s + d.diferenca, 0);

  const deltaDeclarado = -perdaSaidas + ganhoEntradas + somaQuedas + somaAltas;
  const residual = diferenca - deltaDeclarado;

  const fatoresDeclarantes = montarFatores([
    {
      chave: "sairam",
      rotulo: `Deixaram de declarar (${cmp.sairam.length})`,
      detalhe: "VAF que esses contribuintes tinham no arquivo base e não aparece no comparado",
      impacto: -perdaSaidas,
    },
    {
      chave: "entraram",
      rotulo: `Novos declarantes (${cmp.entraram.length})`,
      detalhe: "VAF declarado por quem não constava no arquivo base",
      impacto: ganhoEntradas,
    },
    {
      chave: "quedas",
      rotulo: `Permaneceram e reduziram (${quedas.length})`,
      detalhe: "Mesmos contribuintes declarando menos VAF",
      impacto: somaQuedas,
    },
    {
      chave: "altas",
      rotulo: `Permaneceram e aumentaram (${altas.length})`,
      detalhe: "Mesmos contribuintes declarando mais VAF",
      impacto: somaAltas,
    },
    {
      chave: "residual",
      rotulo: "Demais componentes (créditos, débitos e acertos)",
      detalhe:
        "Diferença entre a variação do VAF declarado (registro 10) e a variação do valor líquido",
      impacto: residual,
    },
  ]);

  const topQuedas = [...cmp.todos]
    .filter((d) => d.diferenca < 0)
    .sort((x, y) => x.diferenca - y.diferenca)
    .slice(0, 5);
  const topAltas = [...cmp.todos]
    .filter((d) => d.diferenca > 0)
    .sort((x, y) => y.diferenca - x.diferenca)
    .slice(0, 5);

  // ---- Texto ---------------------------------------------------------------
  const dominante = fatoresDeclarantes.find((f) => f.chave !== "residual") ?? fatores[0];
  const mesmoSentido = dominante && sentidoDe(dominante.impacto) === sentido;

  const verbo = sentido === "reduziu" ? "caiu" : sentido === "aumentou" ? "subiu" : "ficou estável";
  const resumoBase =
    sentido === "neutro"
      ? `O valor líquido ${verbo} entre os dois arquivos (${moeda(valorBase)} → ${moeda(valorAtual)}).`
      : `O valor líquido ${verbo} ${moeda(Math.abs(diferenca))}${
          variacaoPct === null ? "" : ` (${pctTexto(variacaoPct)})`
        }, de ${moeda(valorBase)} para ${moeda(valorAtual)}.`;

  const resumo =
    dominante && sentido !== "neutro"
      ? `${resumoBase} O fator de maior peso é "${dominante.rotulo}", com ${moeda(
          Math.abs(dominante.impacto),
        )} (${pctTexto(dominante.peso)} do movimento total)${
          mesmoSentido ? "" : " — em sentido contrário ao resultado"
        }.`
      : resumoBase;

  let conclusao: string;
  if (sentido === "neutro") {
    conclusao = "Cenário estável: as variações internas se compensaram.";
  } else if (base.temIndiceFechado !== atual.temIndiceFechado) {
    conclusao =
      "Atenção: os arquivos têm naturezas diferentes (um com índice fechado pela SEF-MG e outro estimado). Parte da diferença pode ser metodológica, e não econômica.";
  } else if (Math.abs(perdaSaidas) >= Math.abs(diferenca) * 0.5 && sentido === "reduziu") {
    conclusao = `Queda estrutural: a saída de ${cmp.sairam.length} declarantes responde pela maior parte da redução. Priorize a cobrança/retificação desses contribuintes.`;
  } else if (Math.abs(somaQuedas) >= Math.abs(diferenca) * 0.5 && sentido === "reduziu") {
    conclusao =
      "Queda conjuntural: os mesmos contribuintes continuaram declarando, porém com VAF menor.";
  } else if (Math.abs(residual) >= Math.abs(diferenca) * 0.5) {
    conclusao =
      "O movimento vem principalmente de créditos, débitos e acertos (VAF B/C), e não da base de declarantes.";
  } else if (sentido === "aumentou") {
    conclusao = `Crescimento sustentado por ${cmp.entraram.length} novos declarantes e ${altas.length} contribuintes com VAF maior.`;
  } else {
    conclusao = "A redução está distribuída entre vários fatores, sem um responsável isolado.";
  }

  // ---- Alertas de comparabilidade -----------------------------------------
  const alertas: string[] = [];
  if (base.temIndiceFechado !== atual.temIndiceFechado) {
    alertas.push(
      "Um dos arquivos traz índice fechado (registro 16/17) e o outro é uma projeção do retorno mensal — a comparação mistura métodos diferentes.",
    );
  }
  if (a.estimado || b.estimado) {
    alertas.push(
      "Há projeção envolvida: retornos mensais podem estar com competência parcial (menos meses acumulados que o arquivo fechado).",
    );
  }
  for (const [rotulo, ap] of [
    ["base", b],
    ["comparado", a],
  ] as const) {
    if (ap.fatorCalibragem != null && Math.abs(ap.fatorCalibragem - 1) > 0.0001) {
      alertas.push(
        `O arquivo ${rotulo} usou fator de calibragem ${ap.fatorCalibragem.toLocaleString("pt-BR")} no VAF próprio.`,
      );
    }
    if (ap.origemVafEstadual === "referencia") {
      alertas.push(
        `O índice do arquivo ${rotulo} usou VAF estadual de referência informado manualmente.`,
      );
    }
  }
  const incompletos = cmp.todos.filter((d) => d.cadastroIncompleto).length;
  if (incompletos > 0) {
    alertas.push(
      `${incompletos} contribuinte(s) sem nome e/ou CNPJ nos arquivos — o pareamento foi feito pela inscrição estadual.`,
    );
  }
  if (b.anoBase && a.anoBase && b.anoBase === a.anoBase) {
    alertas.push(
      "Os dois arquivos são do mesmo ano-base: a diferença tende a refletir retificações e acúmulo de competências.",
    );
  }

  return {
    valorBase,
    valorAtual,
    diferenca,
    variacaoPct,
    sentido,
    fatores,
    fatoresDeclarantes,
    topQuedas,
    topAltas,
    resumo,
    conclusao,
    alertas,
  };
}

/** Texto corrido do diagnóstico, para copiar ou anexar a relatórios/ofícios. */
export function textoDiagnostico(
  d: DiagnosticoEvolucao,
  baseNome: string,
  atualNome: string,
): string {
  const linhas = [
    `Análise da variação do VAF — ${baseNome} → ${atualNome}`,
    "",
    d.resumo,
    "",
    "Fatores por movimentação de declarantes:",
    ...d.fatoresDeclarantes.map(
      (f) => `- ${f.rotulo}: ${moeda(f.impacto)} (${pctTexto(f.peso)} do movimento)`,
    ),
    "",
    "Fatores por componente do valor líquido:",
    ...d.fatores.map((f) => `- ${f.rotulo}: ${moeda(f.impacto)} (${pctTexto(f.peso)})`),
  ];
  if (d.topQuedas.length) {
    linhas.push("", "Maiores quedas por contribuinte:");
    linhas.push(
      ...d.topQuedas.map(
        (c) => `- ${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): ${moeda(c.diferenca)}`,
      ),
    );
  }
  if (d.topAltas.length) {
    linhas.push("", "Maiores altas por contribuinte:");
    linhas.push(
      ...d.topAltas.map(
        (c) => `- ${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): +${moeda(c.diferenca)}`,
      ),
    );
  }
  if (d.alertas.length) {
    linhas.push("", "Ressalvas de comparabilidade:");
    linhas.push(...d.alertas.map((x) => `- ${x}`));
  }
  linhas.push("", `Conclusão: ${d.conclusao}`);
  return linhas.join("\n");
}
