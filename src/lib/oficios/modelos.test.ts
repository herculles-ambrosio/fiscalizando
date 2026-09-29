import { describe, expect, it } from "vitest";
import { aplicarPlaceholders } from "./modelos";

const dadosBase = {
  contribuinte: {
    nome: "Empresa Exemplo",
    cnpj: "00000000000191",
    inscricao_estadual: "123456789",
    endereco: null,
  },
  config: {
    nome_prefeitura: "Prefeitura Municipal",
    estado: "Minas Gerais",
    secretaria: "Secretaria da Fazenda",
    setor: "Setor VAF",
    endereco_rodape: "Praça Central",
    cidade_data: "Vargem Alegre/MG",
    signatario_nome: "",
    signatario_cargo: "",
    texto_assinatura: "Secretaria Municipal da Fazenda",
  },
  exercicio: 2025,
  dataOficio: "2026-09-29",
};

describe("anos dos ofícios VAF", () => {
  it("usa separadamente o ano de apuração e o ano de aplicação", () => {
    const texto = aplicarPlaceholders(
      "Declaração {{exercicio}} com aplicação em {{exercicio_repasse}}.",
      { ...dadosBase, anoAplicacao: 2027 },
    );

    expect(texto).toBe("Declaração 2025 com aplicação em 2027.");
  });

  it("mantém o cálculo antigo para emissões sem ano de aplicação", () => {
    const texto = aplicarPlaceholders(
      "Declaração {{exercicio}} com aplicação em {{exercicio_repasse}}.",
      dadosBase,
    );

    expect(texto).toBe("Declaração 2025 com aplicação em 2026.");
  });
});