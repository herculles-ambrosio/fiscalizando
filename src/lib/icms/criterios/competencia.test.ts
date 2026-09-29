import { describe, expect, it } from "vitest";
import { competenciaAmbiental, identidadeAmbiental } from "./competencia";

describe("competência das publicações ambientais", () => {
  it("identifica o Fator de Qualidade independentemente do exercício", () => {
    expect(competenciaAmbiental("pontuacao-final-fq-2025.pdf")).toBe("Fator de Qualidade");
  });

  it("identifica o trimestre quando consta do arquivo", () => {
    expect(competenciaAmbiental("icms-ecologico-3-2025.pdf")).toBe("2º trimestre");
    expect(competenciaAmbiental("relatorio_4_trimestre_2026.pdf")).toBe("4º trimestre");
  });

  it("usa o resumo do texto quando não existe nome de publicação", () => {
    const hash = "a".repeat(64);
    expect(identidadeAmbiental("texto colado (20 linhas)", hash)).toBe(`sha256:${hash}`);
  });
});