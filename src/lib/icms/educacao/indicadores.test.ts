import { describe, expect, it } from "vitest";
import {
  classificar,
  etapaDoIndicador,
  etapasAtendidas,
  separarColuna,
  type Direcao,
} from "./indicadores";

const semAnosFinais = { anosIniciais: true, anosFinais: false };
const tudo = { anosIniciais: true, anosFinais: true };

describe("dados constitutivos da Educação", () => {
  it("separa aba e indicador", () => {
    expect(separarColuna("Rendimento — taxa_abandono_9ano")).toEqual({
      aba: "Rendimento",
      indicador: "taxa_abandono_9ano",
    });
  });

  it("deduz a etapa pelo sufixo", () => {
    expect(etapaDoIndicador("desempenho_9ano")).toBe("anos_finais");
    expect(etapaDoIndicador("indice_vulnerabilidade_anosiniciais")).toBe("anos_iniciais");
    expect(etapaDoIndicador("IDEi")).toBeNull();
  });

  it("lê as etapas atendidas pelas matrículas municipais", () => {
    expect(
      etapasAtendidas([
        { coluna_origem: "Atendimento — matriculados_9ano_municipal", valor_num: 0 },
        { coluna_origem: "Atendimento — matriculados_5ano_municipal", valor_num: 120 },
      ]),
    ).toEqual({ anosIniciais: true, anosFinais: false });
  });

  it("não alarma indicador de etapa não municipalizada", () => {
    expect(
      classificar({
        indicador: "desempenho_9ano",
        valor: 0,
        diferenca: -100,
        direcao: "maior_melhor",
        etapa: "anos_finais",
        atendidas: semAnosFinais,
      }),
    ).toBe("nao_aplicavel");
  });

  it("trata abandono zerado como resultado positivo", () => {
    expect(
      classificar({
        indicador: "taxa_abandono_5ano",
        valor: 0,
        diferenca: -100,
        direcao: "menor_melhor" as Direcao,
        etapa: "anos_iniciais",
        atendidas: tudo,
      }),
    ).toBe("positivo");
  });

  it("mantém alerta em índice consolidado baixo", () => {
    expect(
      classificar({
        indicador: "IREi",
        valor: 0.1,
        diferenca: -80,
        direcao: "maior_melhor",
        etapa: null,
        atendidas: tudo,
      }),
    ).toBe("atencao");
  });
});
