import { describe, expect, it } from "vitest";
import { calcularPrevisao, resumirExercicio, sazonalidade, type MesRepasse } from "./previsaoRepasse";

/** Alto Caparaó, exercício 2026 (extrato da FJP). */
const serie: MesRepasse[] = [
  { mes: 1, indice: 0.006760149, valor: 72699.23 },
  { mes: 2, indice: 0.006760149, valor: 60199.19 },
  { mes: 3, indice: 0.006728928, valor: 81584.01 },
  { mes: 4, indice: 0.006728928, valor: 72212.33 },
  { mes: 5, indice: 0.006728928, valor: 73035.57 },
  { mes: 6, indice: 0.006728928, valor: 81309.58 },
  { mes: 7, indice: 0.006691978, valor: 74684.01 },
  { mes: 8, indice: 0.006691978, valor: 71498.45 },
  { mes: 9, indice: 0.006691978, valor: null },
  { mes: 10, indice: null, valor: null },
  { mes: 11, indice: null, valor: null },
  { mes: 12, indice: null, valor: null },
];

/** Linha "75% repassado pelo VAF" de 2026 (tabela de transferências da FJP). */
const bolada = [
  1083066222, 890501000, 1211314563, 1073162504, 1085396809, 1208358587, 1115738668, 1068420215,
  null,
  null,
  null,
  null,
];

describe("previsão de repasse do VAF", () => {
  it("resume o exercício em curso", () => {
    const r = resumirExercicio(serie);
    expect(r.mesesComValor).toHaveLength(8);
    expect(r.recebido).toBeCloseTo(587222.37, 2);
    expect(r.projecaoAnual).toBeCloseTo((587222.37 / 8) * 12, 2);
    expect(r.valorPorPontoAnual).toBeGreaterThan(0);
    expect(r.ultimoIndice).toBeCloseTo(0.006691978, 9);
  });

  it("distribui a sazonalidade somando 1", () => {
    const soma = sazonalidade(serie).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 10);
  });

  it("projeta mais repasse quando o índice sobe", () => {
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.008,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
    });
    expect(p.origem).toBe("municipio");
    expect(p.previsaoAnual).not.toBeNull();
    expect(p.diferenca).toBeGreaterThan(0);
    expect(p.meses).toHaveLength(12);
  });

  it("usa a receita digitada na opção manual", () => {
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.006691978,
      indiceAtual: 0.006691978,
      base: "manual",
      receitaManual: 900000,
    });
    expect(p.previsaoAnual).toBeCloseTo(900000, 6);
  });

  it("aplica o crescimento informado", () => {
    const base = calcularPrevisao({
      serie,
      indiceProjetado: 0.007,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
    });
    const cresc = calcularPrevisao({
      serie,
      indiceProjetado: 0.007,
      indiceAtual: 0.006691978,
      base: "crescimento",
      crescimentoPct: 10,
    });
    expect(cresc.previsaoAnual!).toBeCloseTo(base.previsaoAnual! * 1.1, 6);
  });

  it("reproduz o repasse pela bolada do Estado", () => {
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.006691978,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
      boladaEstado: bolada,
    });
    expect(p.origem).toBe("estado");
    // média mensal da bolada x 12 x índice/100
    const media = 8735958568 / 8;
    expect(p.boladaAnual).toBeCloseTo(media * 12, 0);
    expect(p.previsaoAnual!).toBeCloseTo((media * 12 * 0.006691978) / 100, 2);
    expect(p.variacaoIndicePct).toBeCloseTo(0, 9);
  });

  it("aplica a queda do índice na previsão", () => {
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.005783,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
      boladaEstado: bolada,
    });
    expect(p.variacaoIndicePct!).toBeCloseTo(-13.58, 1);
    expect(p.previsaoAnual!).toBeLessThan(p.atual.projecaoAnual!);
  });

  it("aplica o crescimento entre as arrecadações do Estado", () => {
    const base = calcularPrevisao({
      serie,
      indiceProjetado: 0.006691978,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
      boladaEstado: bolada,
    });
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.006691978,
      indiceAtual: 0.006691978,
      base: "arrecadacao_estado",
      arrecadacaoAnterior: 925287575000,
      arrecadacaoAtual: 1004153256799,
      boladaEstado: bolada,
    });
    const fator = 1004153256799 / 925287575000;
    expect(p.crescimentoArrecadacaoPct!).toBeCloseTo((fator - 1) * 100, 2);
    expect(p.previsaoAnual!).toBeCloseTo(base.previsaoAnual! * fator, 2);
  });

  it("cai para repetir o ano quando faltam as arrecadações", () => {
    const base = calcularPrevisao({
      serie,
      indiceProjetado: 0.007,
      indiceAtual: 0.006691978,
      base: "ano_anterior",
    });
    const p = calcularPrevisao({
      serie,
      indiceProjetado: 0.007,
      indiceAtual: 0.006691978,
      base: "arrecadacao_estado",
      arrecadacaoAnterior: null,
      arrecadacaoAtual: null,
    });
    expect(p.crescimentoArrecadacaoPct).toBeNull();
    expect(p.previsaoAnual!).toBeCloseTo(base.previsaoAnual!, 6);
  });
});

import { acrescimoIndiceRecuperacao } from "./previsaoRepasse";
describe("acrescimoIndiceRecuperacao", () => {
  it("soma o valor recuperado ao índice e divide na média", () => {
    expect(acrescimoIndiceRecuperacao(1_000_000, 1_000_000_000, false)).toBeCloseTo(0.1);
    expect(acrescimoIndiceRecuperacao(1_000_000, 1_000_000_000, true)).toBeCloseTo(0.05);
    expect(acrescimoIndiceRecuperacao(1, null, true)).toBeNull();
  });
});
