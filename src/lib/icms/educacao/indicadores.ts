/**
 * Classificação dos dados constitutivos da Educação.
 *
 * A comparação crua com a média estadual produz falsos alarmes em dois casos:
 * quando a rede municipal não atende a etapa (não há aluno, então o número é
 * zero por ausência de base de cálculo) e quando o indicador é uma taxa em que
 * quanto menor, melhor (abandono, distorção, vulnerabilidade).
 */

export type Direcao = "maior_melhor" | "menor_melhor";
export type Etapa = "anos_iniciais" | "anos_finais" | null;
export type Classificacao = "atencao" | "positivo" | "neutro" | "nao_aplicavel";

export type EtapasAtendidas = { anosIniciais: boolean; anosFinais: boolean };

/** Limite de diferença percentual a partir do qual o número chama atenção. */
export const LIMITE_DIFERENCA = 40;

/** Índices finais compostos: valor baixo é sempre atenção, qualquer que seja a direção interna. */
const CONSOLIDADOS = ["idei", "irei", "aei", "igei", "ideei", "ige_"];

/** "Rendimento — taxa_abandono_9ano" → { aba: "Rendimento", indicador: "taxa_abandono_9ano" } */
export function separarColuna(colunaOrigem: string): { aba: string; indicador: string } {
  const partes = colunaOrigem.split(/\s+[—–-]\s+/);
  if (partes.length >= 2) {
    return { aba: partes[0]!.trim(), indicador: partes.slice(1).join(" - ").trim() };
  }
  return { aba: "", indicador: colunaOrigem.trim() };
}

export function etapaDoIndicador(indicador: string): Etapa {
  const n = indicador.toLowerCase();
  if (n.includes("_9ano") || n.includes("anosfinais") || n.includes("anos_finais")) {
    return "anos_finais";
  }
  if (
    n.includes("_2ano") ||
    n.includes("_5ano") ||
    n.includes("anosiniciais") ||
    n.includes("anos_iniciais")
  ) {
    return "anos_iniciais";
  }
  return null;
}

export function ehConsolidado(indicador: string): boolean {
  const n = indicador.toLowerCase();
  return CONSOLIDADOS.some((c) => n === c || n.startsWith(c));
}

export function direcaoDoIndicador(indicador: string, mapa: Map<string, Direcao>): Direcao {
  if (ehConsolidado(indicador)) return "maior_melhor";
  return mapa.get(indicador.toLowerCase()) ?? "maior_melhor";
}

/**
 * Etapas que a rede municipal atende, a partir dos números de matrícula
 * municipal — nunca inferido por "tudo zerado".
 */
export function etapasAtendidas(
  linhas: { coluna_origem: string; valor_num: number | null }[],
): EtapasAtendidas {
  const valor = (chave: string): number | null => {
    const achada = linhas.find((l) =>
      separarColuna(l.coluna_origem).indicador.toLowerCase().includes(chave),
    );
    return achada ? achada.valor_num : null;
  };
  const finais = valor("matriculados_9ano_municipal");
  const iniciais = valor("matriculados_5ano_municipal");
  return {
    anosFinais: finais != null && finais > 0,
    anosIniciais: iniciais != null && iniciais > 0,
  };
}

export function classificar(params: {
  indicador: string;
  valor: number | null;
  diferenca: number | null;
  direcao: Direcao;
  etapa: Etapa;
  atendidas: EtapasAtendidas;
}): Classificacao {
  const { indicador, valor, diferenca, direcao, etapa, atendidas } = params;

  if (etapa === "anos_finais" && !atendidas.anosFinais) return "nao_aplicavel";
  if (etapa === "anos_iniciais" && !atendidas.anosIniciais) return "nao_aplicavel";

  if (valor == null || diferenca == null) return "neutro";

  if (direcao === "menor_melhor" && !ehConsolidado(indicador)) {
    if (diferenca <= -LIMITE_DIFERENCA) return "positivo";
    if (diferenca >= LIMITE_DIFERENCA) return "atencao";
    return diferenca < 0 ? "positivo" : "neutro";
  }

  if (diferenca <= -LIMITE_DIFERENCA) return "atencao";
  if (diferenca >= LIMITE_DIFERENCA) return "positivo";
  return "neutro";
}
