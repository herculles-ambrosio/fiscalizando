import { describe, expect, it } from "vitest";
import { divergencias, lerCadastroPrefeitura, normalizarSituacao, simplesDe, situacaoComum, situacoesDaLinha, tipoCadastroPrefeitura } from "./prefeitura";


const linha = (doc: string, mun: string, cep = "36834-000") => ({ "N. Documento": doc, "Município": mun, CEP: cep });

describe("cadastro da prefeitura", () => {
  it("recusa planilha de outra prefeitura", () => {
    const r = lerCadastroPrefeitura([linha("42.343.256/0001-41", "Manhuaçu"), linha("1", "Manhuaçu")], "Caparaó");
    expect(r.ok).toBe(false);
  });
  it("aceita quando o município predominante é o ativo e marca os de fora", () => {
    const r = lerCadastroPrefeitura(
      [linha("42.343.256/0001-41", "Caparaó"), linha("40.432.544/0112-62", "Belo Horizonte", "30160-031"), linha("21.227.026/0001-47", "Venâncio Aires")],
      "Caparaó",
    );
    if (!r.ok) throw new Error();
    expect(r.linhas[1]?.alerta_municipio).toBe("OUTRO_MUNICIPIO");
    expect(r.linhas[2]?.alerta_municipio).toBe("PROVAVEL_ERRO");
  });
  it("traduz situação e Simples", () => {
    expect(normalizarSituacao("Provisório Nfse Nacional")).toBe("ATIVA");
    expect(normalizarSituacao("Baixado")).toBe("BAIXADA");
    expect(simplesDe("Não Optante")).toBe(false);
    expect(simplesDe("Optante")).toBe(true);
  });
  it("aponta divergência de MEI e de situação", () => {
    const d = divergencias(
      { simples_optante: true, regime: "Micro Empreendedor Individual(MEI)", situacao_normalizada: "ATIVA" },
      { cnpj: "", razao_social: null, nome_fantasia: null, situacao: "BAIXADA", opcao_simples: true, opcao_mei: false },
    );
    expect(d).toEqual(["MEI", "SITUACAO"]);
  });
  it("traduz situação da Receita e da prefeitura para a mesma escala", () => {
    expect(situacaoComum("INAPTA")).toBe("INAPTA");
    expect(situacaoComum("Sem Situação")).toBe("OUTRA");
    expect(situacaoComum(null)).toBeNull();
  });
  it("aceita o filtro de situação quando qualquer um dos cadastros tem a situação", () => {
    expect(situacoesDaLinha({ situacao: "Baixado" }, { situacao: "ATIVA" })).toEqual(["BAIXADA", "ATIVA"]);
    expect(situacoesDaLinha(undefined, { situacao: "SUSPENSA" })).toEqual(["SUSPENSA"]);
    expect(situacoesDaLinha({ situacao: null }, undefined)).toEqual([]);
  });
  it("classifica o tipo pelo regime do cadastro da prefeitura", () => {
    expect(tipoCadastroPrefeitura({ regime: "Micro Empreendedor Individual(MEI)", simples_optante: true })).toBe("MEI");
    expect(tipoCadastroPrefeitura({ regime: "Simples Nacional", simples_optante: true })).toBe("SIMPLES");
    expect(tipoCadastroPrefeitura({ regime: "Lucro Presumido", simples_optante: false })).toBe("LUCRO");
    expect(tipoCadastroPrefeitura({ regime: "Regime Normal", simples_optante: null })).toBe("NAO_CLASSIFICADO");
  });
});


