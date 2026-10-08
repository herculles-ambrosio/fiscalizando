/**
 * Regras de conferência do ISS bancário. Tudo aqui é indício para fiscalizar,
 * não prova: compara a declaração do banco com o plano de contas da prefeitura
 * e com o que a instituição informa ao Banco Central (ESTBAN e IF.data).
 */

export type ContaCfg = {
  conta: string;
  descricao: string;
  item_lc116: string | null;
  aliquota: number;
  tributavel: boolean;
};

export type Declaracao = {
  cnpj: string;
  instituicao_nome?: string | null;
  competencia_ano: number;
  competencia_mes: number;
  conta: string;
  descricao?: string | null;
  valor: number;
  tributavel_declarado?: boolean | null;
  aliquota_declarada?: number | null;
  iss_declarado?: number | null;
};

export const digitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "");

/** Grupo 7.1.7 do COSIF: rendas de prestação de serviços. */
export const ehRendaServico = (conta: string) => digitos(conta).startsWith("717");

/** Configuração mais específica (maior prefixo) cadastrada para a conta. */
export function contaConfig(conta: string, plano: ContaCfg[]): ContaCfg | undefined {
  const d = digitos(conta);
  if (!d) return undefined;
  let melhor: ContaCfg | undefined;
  for (const c of plano) {
    const p = digitos(c.conta);
    if (p && d.startsWith(p) && (!melhor || p.length > digitos(melhor.conta).length)) melhor = c;
  }
  return melhor;
}

export type ResultadoConta = {
  tributavelEsperado: boolean;
  aliquota: number;
  itemLc116: string | null;
  issEsperado: number;
  issDeclarado: number;
  diferenca: number;
  motivos: string[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;

export function conferirConta(d: Declaracao, plano: ContaCfg[], aliquotaPadrao = 5): ResultadoConta {
  const total = !digitos(d.conta);
  const cfg = total ? undefined : contaConfig(d.conta, plano);
  const tributavelEsperado = total ? true : cfg ? cfg.tributavel : ehRendaServico(d.conta);
  const aliquota = cfg?.aliquota ?? aliquotaPadrao;
  const valor = Number(d.valor) || 0;
  const issEsperado = tributavelEsperado ? r2((valor * aliquota) / 100) : 0;
  const issDeclarado = r2(
    d.iss_declarado != null
      ? Number(d.iss_declarado)
      : d.tributavel_declarado === false
        ? 0
        : (valor * (d.aliquota_declarada ?? aliquota)) / 100,
  );
  const motivos: string[] = [];
  if (tributavelEsperado && d.tributavel_declarado === false) motivos.push("Conta de serviço declarada como não tributável");
  if (tributavelEsperado && d.aliquota_declarada != null && d.aliquota_declarada < aliquota - 0.001)
    motivos.push(`Alíquota declarada (${d.aliquota_declarada}%) menor que a do item (${aliquota}%)`);
  const diferenca = r2(Math.max(0, issEsperado - issDeclarado));
  if (diferenca > 0.5 && !motivos.length) motivos.push("ISS declarado menor que o devido");
  return { tributavelEsperado, aliquota, itemLc116: cfg?.item_lc116 ?? null, issEsperado, issDeclarado, diferenca, motivos };
}

export type EstbanLinha = {
  competencia_ano: number;
  competencia_mes: number;
  cnpj_raiz: string;
  nome: string;
  verbete_711: number | null;
};

/**
 * As contas de resultado do ESTBAN são acumuladas no semestre (zeram em janeiro
 * e julho). A receita do mês é a diferença para o mês anterior do mesmo semestre.
 */
export function receitaMensalEstban(linhas: EstbanLinha[]): Map<string, number> {
  const out = new Map<string, number>();
  const porRaiz = new Map<string, EstbanLinha[]>();
  for (const l of linhas) porRaiz.set(l.cnpj_raiz, [...(porRaiz.get(l.cnpj_raiz) ?? []), l]);
  for (const [raiz, ls] of porRaiz) {
    const mapa = new Map(ls.map((l) => [l.competencia_ano * 100 + l.competencia_mes, Number(l.verbete_711) || 0]));
    for (const l of ls) {
      const atual = Number(l.verbete_711) || 0;
      const inicioSemestre = l.competencia_mes === 1 || l.competencia_mes === 7;
      const ant = mapa.get(l.competencia_ano * 100 + l.competencia_mes - 1);
      if (!inicioSemestre && ant === undefined) continue; // sem o mês anterior não dá para isolar o mês
      out.set(`${raiz}|${l.competencia_ano}|${l.competencia_mes}`, inicioSemestre ? atual : atual - (ant ?? 0));
    }
  }
  return out;
}

export type AlertaTendencia = { mes: string; receita: number; base: number; razao: number | null; alerta: string | null };

/** Compara mês a mês a receita da instituição no município com a base declarada. */
export function tendencia(meses: { mes: string; receita: number; base: number }[]): AlertaTendencia[] {
  const razoes = meses.filter((m) => m.receita > 0 && m.base > 0).map((m) => m.base / m.receita).sort((a, b) => a - b);
  const mediana = razoes.length ? razoes[Math.floor(razoes.length / 2)]! : null;
  return meses.map((m) => {
    const razao = m.receita > 0 ? m.base / m.receita : null;
    let alerta: string | null = null;
    if (m.receita > 0 && m.base <= 0) alerta = "Receita no Banco Central sem base declarada";
    else if (razao != null && mediana != null && razao < mediana * 0.5) alerta = "Base declarada caiu em relação à receita";
    return { ...m, razao, alerta };
  });
}

/** Rateio: rendas de serviços da instituição × participação do município. */
export function estimativaRateio(rendasServicos: number, participacaoPct: number): number {
  return r2(((Number(rendasServicos) || 0) * (Number(participacaoPct) || 0)) / 100);
}

export function alertaRateio(estimativa: number, baseDeclarada: number): string | null {
  if (estimativa <= 0) return null;
  if (baseDeclarada <= 0) return "Sem base declarada no trimestre";
  return baseDeclarada < estimativa * 0.7 ? "Base declarada abaixo de 70% da estimativa" : null;
}

export const PLANO_PADRAO: ContaCfg[] = [
  { conta: "7.1.7", descricao: "Rendas de prestação de serviços (grupo)", item_lc116: "15", aliquota: 5, tributavel: true },
  { conta: "7.1.1", descricao: "Rendas de operações de crédito (juros — não é serviço)", item_lc116: null, aliquota: 0, tributavel: false },
  { conta: "7.1.5", descricao: "Rendas de operações com títulos e valores mobiliários", item_lc116: null, aliquota: 0, tributavel: false },
];
