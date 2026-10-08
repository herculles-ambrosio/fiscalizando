import { describe, expect, it } from "vitest";
import { aplicarPlaceholdersEmpresa, ativasSemCadastro } from "./notificacoes";

describe("notificações de empresas", () => {
  it("lista só as ativas na Receita sem cadastro na prefeitura", () => {
    const r = ativasSemCadastro(
      [
        { cnpj: "1", situacao: "ATIVA" },
        { cnpj: "2", situacao: "ATIVA" },
        { cnpj: "3", situacao: "BAIXADA" },
      ],
      [{ documento: "2", tipo_documento: "CNPJ" }],
    );
    expect(r.map((e) => e.cnpj)).toEqual(["1"]);
  });

  it("preenche variáveis da empresa e mantém as gerais", () => {
    const t = aplicarPlaceholdersEmpresa("{{contribuinte}} {{prazo_dias}} {{municipio}}", { cnpj: "11222333000181", razao_social: "ACME" }, 15);
    expect(t).toBe("ACME 15 {{municipio}}");
  });
});
