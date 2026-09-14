import { describe, expect, it } from "vitest";
import { casarMunicipios, parseAnexoResolucao } from "./resolucao";

const TRECHO = `
<p>Resolução nº 6.069, de 27 de agosto de 2026 — índices de participação para o exercício de 2027</p>
<table>
<tr><td>Cód.Mun.</td><td>Nome do Município</td><td>VAF Individual 2024</td><td>Índice 2024</td>
<td>VAF Individual 2025</td><td>Índice 2025</td><td>Média dos Índices 2024/2025</td></tr>
<tr><td>1</td><td>Abadia dos Dourados</td><td>344.606.442</td><td>0,036866</td><td>395.852.220</td><td>0,039421</td><td>0,0381440</td></tr>
<tr><td>2</td><td>Abaeté</td><td>483.278.731</td><td>0,051702</td><td>558.621.883</td><td>0,055631</td><td>0,0536664</td></tr>
</table>
`;

describe("parseAnexoResolucao", () => {
  it("lê as linhas do anexo com decimal em pt-BR", () => {
    const anexo = parseAnexoResolucao(TRECHO);
    expect(anexo.resolucao).toBe("6069");
    expect(anexo.exercicioAplicacao).toBe(2027);
    expect(anexo.anoA).toBe(2024);
    expect(anexo.anoB).toBe(2025);
    expect(anexo.linhas).toHaveLength(2);
    expect(anexo.linhas[0]).toMatchObject({
      municipioNome: "Abadia dos Dourados",
      vafA: 344606442,
      indiceA: 0.036866,
      mediaIndices: 0.038144,
    });
  });

  it("casa os municípios cadastrados ignorando acentos", () => {
    const anexo = parseAnexoResolucao(TRECHO);
    const casadas = casarMunicipios(anexo.linhas, [{ id: "abc", nome: "ABAETE" }]);
    expect(casadas[1]?.municipioId).toBe("abc");
    expect(casadas[0]?.municipioId).toBeNull();
  });
});
