import { describe, expect, it } from "vitest";
import { preverPorCriterio } from "./previsaoCriterios";

describe("preverPorCriterio", () => {
  it("projeta pelo índice, fator e recuperação", () => {
    const { linhas, totais } = preverPorCriterio(
      [
        {
          slug: "vaf",
          nome: "VAF",
          percentual: 75,
          valores: [100, 100, null, null, null, null, null, null, null, null, null, null],
          indiceAtual: 0.01,
          indiceProjetado: 0.008,
          indiceRecuperacao: 0.012,
        },
        {
          slug: "educacao",
          nome: "Educação",
          percentual: 10,
          valores: Array(12).fill(null),
          indiceAtual: null,
          indiceProjetado: null,
          indiceRecuperacao: null,
        },
      ],
      1.1,
    );
    expect(linhas[0]!.anual).toBe(1200);
    expect(linhas[0]!.previsto).toBeCloseTo(1200 * 1.1 * 0.8);
    expect(linhas[0]!.comRecuperacao).toBeCloseTo(1200 * 1.1 * 1.2);
    expect(linhas[1]!.previsto).toBeNull();
    expect(totais.previsto).toBeCloseTo(1056);
  });
});
