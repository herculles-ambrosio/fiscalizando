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
});
