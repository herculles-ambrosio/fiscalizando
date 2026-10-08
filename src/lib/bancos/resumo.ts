/** Junta declarações, ESTBAN e IF.data em um resumo de indícios por instituição. */

import {
  alertaRateio, conferirConta, digitos, estimativaRateio, receitaMensalEstban, tendencia,
  type AlertaTendencia, type ContaCfg, type Declaracao, type EstbanLinha, type ResultadoConta,
} from "./conferencia";

export type LinhaConta = Declaracao & { id?: string; r: ResultadoConta };
export type LinhaTendencia = AlertaTendencia & { raiz: string; nome: string; mesNum: number };
export type LinhaRateio = { cnpj: string; nome: string; trimestre: number; rendas: number; participacao: number; estimativa: number; base: number; alerta: string | null };

export type ResumoInstituicao = {
  cnpj: string;
  nome: string;
  base: number;
  issDeclarado: number;
  issDiferenca: number;
  receitaBc: number;
  contas: LinhaConta[];
  alertas: string[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Mesma instituição quando os 8 primeiros dígitos (raiz do CNPJ) coincidem. */
export const mesmaRaiz = (a: string, b: string) => digitos(a).padStart(8, "0").slice(0, 8) === digitos(b).padStart(8, "0").slice(0, 8);

export function montarConferencia(p: {
  ano: number;
  declaracoes: (Declaracao & { id?: string })[];
  plano: ContaCfg[];
  estban: EstbanLinha[];
  ifdata: { cnpj: string; nome: string | null; ano: number; trimestre: number; rendas_servicos: number; participacao_pct: number }[];
  nomes: Map<string, string>;
}) {
  const decl = p.declaracoes.filter((d) => d.competencia_ano === p.ano);
  const contas: LinhaConta[] = decl.map((d) => ({ ...d, r: conferirConta(d, p.plano) }));

  const baseMes = (cnpj: string, mes: number) =>
    contas.filter((c) => c.competencia_mes === mes && mesmaRaiz(c.cnpj, cnpj) && c.r.tributavelEsperado).reduce((s, c) => s + Number(c.valor), 0);

  // ESTBAN: receita mensal × base declarada
  const receita = receitaMensalEstban(p.estban);
  const raizes = [...new Set(p.estban.filter((e) => e.competencia_ano === p.ano).map((e) => e.cnpj_raiz))];
  const tend: LinhaTendencia[] = [];
  for (const raiz of raizes) {
    const nome = p.estban.find((e) => e.cnpj_raiz === raiz)?.nome ?? raiz;
    const meses = Array.from({ length: 12 }, (_, i) => i + 1)
      .filter((m) => receita.has(`${raiz}|${p.ano}|${m}`))
      .map((m) => ({ mes: `${MESES[m - 1]}/${p.ano}`, mesNum: m, receita: receita.get(`${raiz}|${p.ano}|${m}`)!, base: baseMes(raiz, m) }));
    tendencia(meses).forEach((t, i) => tend.push({ ...t, raiz, nome, mesNum: meses[i]!.mesNum }));
  }

  // IF.data: rateio × base do trimestre
  const rateio: LinhaRateio[] = p.ifdata.filter((f) => f.ano === p.ano).map((f) => {
    const estimativa = estimativaRateio(f.rendas_servicos, f.participacao_pct);
    const base = [1, 2, 3].map((k) => baseMes(f.cnpj, (f.trimestre - 1) * 3 + k)).reduce((a, b) => a + b, 0);
    return { cnpj: f.cnpj, nome: f.nome ?? p.nomes.get(f.cnpj) ?? f.cnpj, trimestre: f.trimestre, rendas: f.rendas_servicos, participacao: f.participacao_pct, estimativa, base, alerta: alertaRateio(estimativa, base) };
  });

  // Resumo por instituição (pela raiz do CNPJ)
  const porRaiz = new Map<string, ResumoInstituicao>();
  const pegar = (cnpj: string, nome?: string | null) => {
    const k = digitos(cnpj).padStart(8, "0").slice(0, 8);
    let r = porRaiz.get(k);
    if (!r) { r = { cnpj, nome: nome || p.nomes.get(cnpj) || cnpj, base: 0, issDeclarado: 0, issDiferenca: 0, receitaBc: 0, contas: [], alertas: [] }; porRaiz.set(k, r); }
    if (digitos(cnpj).length > digitos(r.cnpj).length) r.cnpj = cnpj;
    return r;
  };
  for (const c of contas) {
    const r = pegar(c.cnpj, c.instituicao_nome);
    if (c.r.tributavelEsperado) r.base += Number(c.valor);
    r.issDeclarado += c.r.issDeclarado;
    r.issDiferenca += c.r.diferenca;
    if (c.r.motivos.length) r.contas.push(c);
  }
  for (const t of tend) {
    const r = pegar(t.raiz, t.nome);
    r.receitaBc += t.receita;
    if (t.alerta && !r.alertas.includes(t.alerta)) r.alertas.push(t.alerta);
  }
  for (const f of rateio) if (f.alerta) { const r = pegar(f.cnpj, f.nome); if (!r.alertas.includes(f.alerta)) r.alertas.push(f.alerta); }
  for (const r of porRaiz.values()) if (r.contas.length) r.alertas.unshift(`${r.contas.length} conta(s) COSIF com indício`);

  const resumo = [...porRaiz.values()].sort((a, b) => b.issDiferenca - a.issDiferenca || b.alertas.length - a.alertas.length);
  return { contas, tend, rateio, resumo };
}

export const textoContas = (r: ResumoInstituicao) =>
  r.contas.map((c) => `* ${c.conta}${c.descricao ? ` — ${c.descricao}` : ""} (${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}): ${c.r.motivos.join("; ")}`).join("\n");
