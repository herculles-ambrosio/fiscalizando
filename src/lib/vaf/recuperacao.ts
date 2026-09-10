import { sufixoReceita, type MapaReceitaPorIe } from "@/lib/receita/porIe";
import type { ComparacaoDeclarantes, MovimentoDeclarante } from "./evolucao";
import type { DiagnosticoEvolucao } from "./diagnostico";
import type { SituacaoOficio } from "@/lib/oficios/modelos";

/**
 * Plano de recuperação do VAF: transforma o diagnóstico "Por que variou"
 * em ações concretas (ofícios, notificações e diligências) priorizadas
 * pelo valor potencialmente recuperável.
 */

export type PrioridadeAcao = "alta" | "media" | "baixa";

export type AcaoRecuperacao = {
  chave: string;
  titulo: string;
  /** por que a ação foi sugerida */
  motivo: string;
  /** o que fazer na prática */
  comoFazer: string;
  prioridade: PrioridadeAcao;
  /** valor em R$ que a ação pode recuperar/preservar */
  valorRecuperavel: number;
  prazoSugerido: string;
  /** modelo de ofício correspondente, quando a ação gera documento */
  situacaoOficio?: SituacaoOficio;
  contribuintes: MovimentoDeclarante[];
  /** contribuintes retirados da ação por estarem cancelados/baixados/bloqueados */
  ignorados: MovimentoDeclarante[];
  /** base legal / fonte da prática */
  fundamento?: string;
  /** campo do contribuinte que compõe o valor da ação (para não somar duas vezes) */
  campoValor?: "vafBase" | "diferenca";
  /**
   * Ação guarda-chuva: o valor dela já é a soma do que as demais ações tratam
   * (ex.: impugnação do índice). Fica fora do potencial consolidado.
   */
  agregadora?: boolean;
};

/**
 * Situações cadastrais (SEF/MG) em que não faz sentido notificar o contribuinte:
 * a inscrição não está mais apta e o ofício voltaria sem efeito.
 */
export const SITUACOES_NAO_NOTIFICAR = ["CANCELADO", "BAIXADO", "BLOQUEADO"] as const;

export type MapaSituacoesCadastrais = Record<string, string | null | undefined>;

export const chaveIe = (ie: string | null | undefined): string =>
  String(ie ?? "").replace(/\D/g, "");

export function naoNotificavel(
  c: MovimentoDeclarante,
  mapa?: MapaSituacoesCadastrais | null,
): boolean {
  if (!mapa) return false;
  const situacao = mapa[chaveIe(c.inscricao_estadual)];
  return !!situacao && (SITUACOES_NAO_NOTIFICAR as readonly string[]).includes(situacao);
}

/** Limites que classificam uma queda como discrepância a notificar. */
export const LIMITES = {
  quedaPct: 30,
  quedaValor: 50_000,
  /** acima disso a ação é prioridade alta */
  prioridadeAlta: 500_000,
  prioridadeMedia: 100_000,
};

const soma = (lista: MovimentoDeclarante[], campo: "vafBase" | "vafAtual" | "diferenca"): number =>
  lista.reduce((s, d) => s + Math.abs(d[campo]), 0);

const prioridadeDe = (valor: number): PrioridadeAcao =>
  valor >= LIMITES.prioridadeAlta ? "alta" : valor >= LIMITES.prioridadeMedia ? "media" : "baixa";

const porImpacto = (a: MovimentoDeclarante, b: MovimentoDeclarante) =>
  Math.abs(b.diferenca) - Math.abs(a.diferenca);

export function montarPlanoRecuperacao(
  d: DiagnosticoEvolucao,
  declarantes: ComparacaoDeclarantes,
  opts?: { exercicio?: number | null; situacoesCadastrais?: MapaSituacoesCadastrais | null },
): AcaoRecuperacao[] {
  const acoes: AcaoRecuperacao[] = [];
  const exercicio = opts?.exercicio ?? null;
  const mapa = opts?.situacoesCadastrais ?? null;
  /** separa quem ainda pode ser notificado de quem já está cancelado/baixado/bloqueado */
  const elegiveis = (lista: MovimentoDeclarante[]) =>
    lista.filter((c) => !naoNotificavel(c, mapa));
  const bloqueados = (lista: MovimentoDeclarante[]) =>
    lista.filter((c) => naoNotificavel(c, mapa));

  // 1. Deixaram de declarar (omissos) -----------------------------------------
  const omissosTodos = declarantes.sairam.filter((c) => c.vafBase > 0);
  const omissos = elegiveis(omissosTodos);
  const omissosIgnorados = bloqueados(omissosTodos);
  if (omissos.length) {
    const valor = soma(omissos, "vafBase");
    acoes.push({
      chave: "omissos",
      titulo: "Notificar contribuintes que deixaram de declarar",
      motivo: `${omissos.length} contribuinte(s) que geravam VAF no arquivo base não aparecem no arquivo comparado, retirando ${moeda(valor)} da base do município.`,
      comoFazer:
        "Emitir notificação de omissão intimando a entrega ou retificação da DAPI/DeSTDA/EFD do período, com prazo de resposta e alerta de impacto no índice de participação do município.",
      prioridade: prioridadeDe(valor),
      valorRecuperavel: valor,
      prazoSugerido: "Imediato — antes do encerramento do prazo de retificação da SEFAZ",
      situacaoOficio: "OMISSO",
      contribuintes: omissos,
      ignorados: omissosIgnorados,
      fundamento: "Lei Complementar 63/1990 e Resolução SEF/MG que disciplina a apuração do VAF",
    });
  }

  // 2. Declararam com VAF zerado ----------------------------------------------
  const zeradosTodos = declarantes.permaneceram.filter((c) => c.vafBase > 0 && c.vafAtual === 0);
  const zerados = elegiveis(zeradosTodos);
  const zeradosIgnorados = bloqueados(zeradosTodos);
  if (zerados.length) {
    const valor = soma(zerados, "vafBase");
    acoes.push({
      chave: "zerados",
      titulo: "Ofício de retificação para declarações zeradas",
      motivo: `${zerados.length} contribuinte(s) declararam VAF zerado tendo apurado ${moeda(valor)} no arquivo base — normalmente erro de preenchimento ou entrega sem movimento indevida.`,
      comoFazer:
        "Emitir ofício de retificação solicitando o refazimento da declaração com os valores efetivos de entradas e saídas do estabelecimento.",
      prioridade: prioridadeDe(valor),
      valorRecuperavel: valor,
      prazoSugerido: "Até 30 dias, dentro da janela de retificação",
      situacaoOficio: "ZERADO",
      contribuintes: zerados,
      ignorados: zeradosIgnorados,
    });
  }

  // 3. Quedas relevantes (discrepância) ---------------------------------------
  const discrepantesTodos = declarantes.permaneceram
    .filter(
      (c) =>
        c.vafAtual > 0 &&
        c.diferenca < 0 &&
        Math.abs(c.diferenca) >= LIMITES.quedaValor &&
        (c.variacaoPct === null || c.variacaoPct <= -LIMITES.quedaPct),
    )
    .sort(porImpacto);
  const discrepantes = elegiveis(discrepantesTodos);
  const discrepantesIgnorados = bloqueados(discrepantesTodos);
  if (discrepantes.length) {
    const valor = soma(discrepantes, "diferenca");
    acoes.push({
      chave: "discrepantes",
      titulo: "Notificar quedas expressivas para justificativa",
      motivo: `${discrepantes.length} contribuinte(s) reduziram o VAF em mais de ${LIMITES.quedaPct}% (queda somada de ${moeda(valor)}), o que pode indicar erro de escrituração, transferência de faturamento ou mudança de estabelecimento.`,
      comoFazer:
        "Notificar cada contribuinte a apresentar justificativa formal e demonstrativo da redução; havendo erro, exigir retificação da declaração.",
      prioridade: prioridadeDe(valor),
      valorRecuperavel: valor,
      prazoSugerido: "15 dias para resposta",
      situacaoOficio: "DISCREPANTE",
      contribuintes: discrepantes.slice(0, 200),
      ignorados: discrepantesIgnorados,
    });
  }

  // 4. Cadastro incompleto / conferência cadastral ----------------------------
  const cadastroTodos = [...declarantes.sairam, ...declarantes.permaneceram]
    .filter((c) => c.cadastroIncompleto && (c.vafBase > 0 || c.vafAtual > 0))
    .sort(porImpacto);
  const cadastro = elegiveis(cadastroTodos);
  const cadastroIgnorados = bloqueados(cadastroTodos);
  if (cadastro.length) {
    const valor = soma(cadastro, "vafBase");
    acoes.push({
      chave: "cadastro",
      titulo: "Conferência cadastral (endereço, CNAE e município do estabelecimento)",
      motivo: `${cadastro.length} contribuinte(s) estão sem nome e/ou CNPJ completos nos arquivos, o que costuma acompanhar cadastro estadual desatualizado — endereço em outro município leva o VAF para o lugar errado.`,
      comoFazer:
        "Conferir o cadastro no SIARE, confrontar com alvará/ISS municipal e oficiar o contribuinte a atualizar endereço e CNAE do estabelecimento.",
      prioridade: prioridadeDe(valor),
      valorRecuperavel: valor,
      prazoSugerido: "Antes do fechamento do exercício",
      situacaoOficio: "GERAL",
      contribuintes: cadastro.slice(0, 200),
      ignorados: cadastroIgnorados,
    });
  }

  // 5. Fuga de crédito externo (VAF gerado fora) ------------------------------
  const externo = d.fatores.find((f) => f.chave === "creditoExterno");
  if (externo && externo.impacto < 0) {
    acoes.push({
      chave: "credito-externo",
      titulo: "Rastrear queda do crédito externo (VAF gerado em outro município)",
      motivo: `O crédito externo (registros 11/35) caiu ${moeda(Math.abs(externo.impacto))}. Isso indica que operações antes atribuídas ao município passaram a ser atribuídas a outro.`,
      comoFazer:
        "Comparar os municípios de origem entre os dois arquivos, identificar para onde migrou o valor e verificar erro de endereço/IE nas notas fiscais eletrônicas; havendo erro, pedir retificação ao emitente e, se necessário, abrir pedido de revisão junto à SEFAZ.",
      prioridade: prioridadeDe(Math.abs(externo.impacto)),
      valorRecuperavel: Math.abs(externo.impacto),
      prazoSugerido: "Antes da publicação do índice provisório",
      contribuintes: [],
      ignorados: [],
    });
  }

  // 6. Impugnação do índice ----------------------------------------------------
  if (d.diferenca < 0) {
    acoes.push({
      chave: "impugnacao",
      titulo: "Preparar impugnação do índice provisório",
      motivo: `A projeção aponta perda de ${moeda(Math.abs(d.diferenca))} de valor adicionado${exercicio ? ` no exercício ${exercicio}` : ""}. Se o índice publicado não refletir as retificações obtidas, cabe impugnação.`,
      comoFazer:
        "Reunir a memória de cálculo, as declarações retificadas e os ofícios respondidos, e protocolar a impugnação do índice provisório dentro do prazo publicado pela SEFAZ/MG (normalmente 30 dias após a publicação).",
      prioridade: prioridadeDe(Math.abs(d.diferenca)),
      valorRecuperavel: Math.abs(d.diferenca),
      prazoSugerido: "Dentro do prazo de impugnação publicado pela SEFAZ",
      contribuintes: [],
      ignorados: [],
      fundamento: "Lei Complementar 63/1990, art. 3º, §7º",
    });
  }

  // 7. Diligência nas maiores quedas -------------------------------------------
  if (d.topQuedas.length) {
    // (a diligência só é sugerida se sobrar alguém notificável)
    const topTodos = d.topQuedas.slice(0, 8);
    const topIgnorados = bloqueados(topTodos);
    const top = elegiveis(topTodos).slice(0, 5);
    const valor = soma(top, "diferenca");
    if (top.length)
    acoes.push({
      chave: "diligencia",
      titulo: "Diligência in loco nos maiores impactos",
      motivo: `As ${top.length} maiores quedas somam ${moeda(valor)} — concentração alta o bastante para justificar contato direto.`,
      comoFazer:
        "Agendar visita ou reunião com o contador/responsável de cada empresa, verificar se o estabelecimento continua ativo no município e orientar a correção antes do fechamento do VAF.",
      prioridade: prioridadeDe(valor),
      valorRecuperavel: valor,
      prazoSugerido: "Até 45 dias",
      contribuintes: top,
      ignorados: topIgnorados,
    });
  }

  // 8. Cruzamento com o cadastro municipal -------------------------------------
  acoes.push({
    chave: "cruzamento-iss",
    titulo: "Cruzar cadastro municipal (ISS/alvará) com o arquivo de retorno",
    motivo:
      "Empresas ativas no município que não aparecem no arquivo de retorno costumam estar sem inscrição estadual, com inscrição em outro município ou omissas há vários períodos.",
    comoFazer:
      "Exportar o cadastro mobiliário municipal, confrontar por CNPJ com os declarantes do arquivo e notificar as ausentes a regularizar a inscrição estadual/entrega da declaração.",
    prioridade: "media",
    valorRecuperavel: 0,
    prazoSugerido: "Rotina trimestral",
    contribuintes: [],
    ignorados: [],
  });

  // 9. Novos estabelecimentos / conscientização --------------------------------
  acoes.push({
    chave: "conscientizacao",
    titulo: "Campanha de conscientização com os maiores contribuintes",
    motivo:
      "Boa parte da perda de VAF nasce de erro de preenchimento recorrente; orientar antes da entrega evita a necessidade de retificação depois.",
    comoFazer:
      "Enviar comunicado aos maiores contribuintes e seus contadores com o calendário de entrega, os erros mais comuns identificados nesta análise e o canal de contato da prefeitura.",
    prioridade: "baixa",
    valorRecuperavel: 0,
    prazoSugerido: "Antes da entrega da declaração anual (DAPI de dezembro)",
    situacaoOficio: "GERAL",
    contribuintes: [],
    ignorados: [],
  });

  return acoes.sort((a, b) => {
    const peso = { alta: 3, media: 2, baixa: 1 } as const;
    if (peso[a.prioridade] !== peso[b.prioridade]) return peso[b.prioridade] - peso[a.prioridade];
    return b.valorRecuperavel - a.valorRecuperavel;
  });
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export const ROTULO_PRIORIDADE: Record<PrioridadeAcao, string> = {
  alta: "Prioridade alta",
  media: "Prioridade média",
  baixa: "Prioridade baixa",
};

/** Texto corrido do plano, para copiar, anexar ao CSV ou ao relatório .docx. */
export function textoPlanoRecuperacao(
  acoes: AcaoRecuperacao[],
  situacoesReceita?: MapaReceitaPorIe | null,
): string {
  const total = acoes.reduce((s, a) => s + a.valorRecuperavel, 0);
  const linhas = [
    "Plano de recuperação do VAF",
    `Potencial total mapeado: ${moeda(total)}`,
    "",
  ];
  acoes.forEach((a, i) => {
    linhas.push(
      `${i + 1}. ${a.titulo} — ${ROTULO_PRIORIDADE[a.prioridade]}` +
        (a.valorRecuperavel > 0 ? ` · ${moeda(a.valorRecuperavel)}` : ""),
    );
    linhas.push(`   Motivo: ${a.motivo}`);
    linhas.push(`   Como fazer: ${a.comoFazer}`);
    linhas.push(`   Prazo: ${a.prazoSugerido}`);
    if (a.contribuintes.length) {
      linhas.push(`   Contribuintes envolvidos: ${a.contribuintes.length}`);
      for (const c of a.contribuintes.slice(0, 25))
        linhas.push(
          `     - ${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual})` +
            sufixoReceita(situacoesReceita, c.inscricao_estadual),
        );
      if (a.contribuintes.length > 25) linhas.push("     - …");
    }
    if (a.ignorados.length)
      linhas.push(
        `   Ignorados por situação cadastral (cancelado/baixado/bloqueado): ${a.ignorados.length}`,
      );
    if (a.fundamento) linhas.push(`   Fundamento: ${a.fundamento}`);
    linhas.push("");
  });
  return linhas.join("\n");
}

const escCsv = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

/**
 * CSV dos contribuintes ignorados por situação cadastral.
 * Passe uma única ação (exportação por ação) ou todas (exportação do plano).
 */
export function csvIgnorados(
  acoes: AcaoRecuperacao | AcaoRecuperacao[],
  situacoes?: MapaSituacoesCadastrais | null,
): string {
  const lista = Array.isArray(acoes) ? acoes : [acoes];
  const br = (v: number) => v.toFixed(2).replace(".", ",");
  const linhas: string[][] = [
    [
      "Acao",
      "Prioridade",
      "IE",
      "CNPJ",
      "Contribuinte",
      "Situacao cadastral",
      "VAF base",
      "VAF atual",
      "Diferenca",
      "Motivo da exclusao",
    ],
  ];
  for (const a of lista) {
    for (const c of a.ignorados) {
      const situacao = situacoes?.[chaveIe(c.inscricao_estadual)] ?? "";
      linhas.push([
        a.titulo,
        ROTULO_PRIORIDADE[a.prioridade],
        c.inscricao_estadual,
        c.cnpj ?? "",
        c.nome ?? "",
        situacao || "Nao informada",
        br(c.vafBase),
        br(c.vafAtual),
        br(c.diferenca),
        "Inscricao cancelada/baixada/bloqueada na SEF-MG — nao deve ser notificada",
      ]);
    }
  }
  return linhas.map((l) => l.map((c) => escCsv(String(c))).join(";")).join("\n");
}

/** Dispara o download de um CSV (com BOM para abrir certo no Excel). */
export function baixarCsvIgnorados(conteudo: string, nomeArquivo: string): void {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
