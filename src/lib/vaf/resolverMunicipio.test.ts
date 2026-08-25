import { describe, expect, it } from "vitest";
import { resolverMunicipioDoArquivo } from "./resolverMunicipio";
import { MUNICIPIOS_SEF, nomeMunicipioSef } from "./municipiosSef";

const cadastros = [
  { id: "a", nome: "Nanuque", uf: "MG", codigo_sef: "443" },
  // Cadastro com nome errado (caso real: 641 gravado como Martins Soares)
  { id: "b", nome: "Martins Soares", uf: "MG", codigo_sef: "641" },
  { id: "c", nome: "Martins Soares", uf: "MG", codigo_sef: "810" },
];

describe("resolverMunicipioDoArquivo", () => {
  it("usa o nome oficial do código SEF, não o nome do cadastro", () => {
    const r = resolverMunicipioDoArquivo({ codigo: "641", municipios: cadastros });
    expect(r.codigo).toBe("641");
    expect(r.nomeOficial).toBe("São Pedro dos Ferros");
    expect(r.nomeExibicao).toBe("São Pedro dos Ferros");
    expect(r.cadastrado?.id).toBe("b");
    expect(r.nomeDivergente).toBe(true);
    expect(r.rotulo).toBe("São Pedro dos Ferros (código 641)");
  });

  it("não acusa divergência quando o cadastro está correto", () => {
    expect(resolverMunicipioDoArquivo({ codigo: "443", municipios: cadastros }).nomeDivergente).toBe(
      false,
    );
    expect(resolverMunicipioDoArquivo({ codigo: "810", municipios: cadastros }).nomeDivergente).toBe(
      false,
    );
  });

  it("ignora acentos e caixa ao comparar nomes", () => {
    const r = resolverMunicipioDoArquivo({
      codigo: "641",
      municipios: [{ id: "x", nome: "SAO PEDRO DOS FERROS", uf: "MG", codigo_sef: "0641" }],
    });
    expect(r.nomeDivergente).toBe(false);
    expect(r.cadastrado?.id).toBe("x");
  });

  it("normaliza códigos com zeros à esquerda", () => {
    expect(resolverMunicipioDoArquivo({ codigo: "047", municipios: [] }).nomeOficial).toBe(
      nomeMunicipioSef("47"),
    );
  });

  it("cai para o nome do arquivo quando o código não está na tabela SEF", () => {
    const r = resolverMunicipioDoArquivo({
      codigo: "9999",
      nomeArquivo: "Município Novo",
      municipios: [],
    });
    expect(r.nomeOficial).toBeNull();
    expect(r.nomeExibicao).toBe("Município Novo");
  });

  it("devolve vazio sem código detectado", () => {
    const r = resolverMunicipioDoArquivo({ codigo: null, municipios: cadastros });
    expect(r.codigo).toBeNull();
    expect(r.cadastrado).toBeNull();
  });

  it("cada código SEF resolve para um único município oficial", () => {
    const codigos = Object.keys(MUNICIPIOS_SEF);
    expect(codigos.length).toBe(853);
    for (const codigo of codigos) {
      const r = resolverMunicipioDoArquivo({ codigo, municipios: cadastros });
      expect(r.nomeOficial).toBe(MUNICIPIOS_SEF[codigo]);
    }
  });
});
