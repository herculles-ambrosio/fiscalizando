import { describe, expect, it } from "vitest";
import { diagnosticarEvolucao } from "./diagnostico";
import type { ArquivoEvolucao, Declarante } from "./evolucao";
import type { ApuracaoIndice } from "./indice";

const apuracao = (over: Partial<ApuracaoIndice>): ApuracaoIndice => ({
  tipoIndice: "provisorio",
  codigoMunicipio: "443",
  anoBase: null,
  periodoInicio: null,
  periodoFim: null,
  vafProprio: 0,
  creditoExterno: 0,
  creditoInterno: 0,
  creditoProprio: 0,
  debito: 0,
  acertoCredito: 0,
  acertoDebito: 0,
  valorLiquido: 0,
  indice: 0,
  vafEstadual: 0,
  creditoProprioAf: 0,
  creditoProprioSiare: 0,
  creditosExternos: [],
  creditosPorMunicipio: [],
  debitosPorMunicipio: [],
  contribuintesVaf: [],
  simei: [],
  totalDeclaracoes: 0,
  ...over,
});

const dec = (ie: string, vaf: number): Declarante => ({
  inscricao_estadual: ie,
  cnpj: "00000000000191",
  nome: `Empresa ${ie}`,
  exercicio: 2025,
  data_entrega: null,
  vaf,
  origemNome: "01",
  origemCnpj: "10",
});

const arq = (
  nome: string,
  ap: Partial<ApuracaoIndice>,
  declarantes: Declarante[],
): ArquivoEvolucao => ({
  nome,
  apuracao: apuracao(ap),
  declarantes,
  temIndiceFechado: false,
});

describe("diagnosticarEvolucao", () => {
  it("atribui a queda à saída de declarantes", () => {
    const base = arq("b", { vafProprio: 300, valorLiquido: 300 }, [dec("1", 200), dec("2", 100)]);
    const atual = arq("a", { vafProprio: 200, valorLiquido: 200 }, [dec("1", 200)]);
    const d = diagnosticarEvolucao(base, atual);

    expect(d.diferenca).toBe(-100);
    expect(d.sentido).toBe("reduziu");
    const saidas = d.fatoresDeclarantes.find((f) => f.chave === "sairam");
    expect(saidas?.impacto).toBe(-100);
    expect(d.conclusao).toContain("estrutural");
  });

  it("soma dos fatores por declarante fecha com a variação total", () => {
    const base = arq("b", { vafProprio: 500, creditoExterno: 100, valorLiquido: 600 }, [
      dec("1", 400),
      dec("2", 100),
    ]);
    const atual = arq("a", { vafProprio: 450, creditoExterno: 250, valorLiquido: 700 }, [
      dec("1", 350),
      dec("3", 100),
    ]);
    const d = diagnosticarEvolucao(base, atual);
    const soma = d.fatoresDeclarantes.reduce((s, f) => s + f.impacto, 0);
    expect(soma).toBeCloseTo(d.diferenca, 6);
  });

  it("soma dos componentes fecha com a variação total", () => {
    const base = arq(
      "b",
      { vafProprio: 500, creditoInterno: 50, debito: 30, valorLiquido: 520 },
      [dec("1", 500)],
    );
    const atual = arq(
      "a",
      { vafProprio: 500, creditoInterno: 80, debito: 100, valorLiquido: 480 },
      [dec("1", 500)],
    );
    const d = diagnosticarEvolucao(base, atual);
    const soma = d.fatores.reduce((s, f) => s + f.impacto, 0);
    expect(soma).toBeCloseTo(d.diferenca, 6);
    expect(d.fatores[0]?.chave).toBe("debito");
  });

  it("alerta quando compara índice fechado com projeção", () => {
    const base = { ...arq("b", { valorLiquido: 100 }, [dec("1", 100)]), temIndiceFechado: true };
    const atual = arq("a", { valorLiquido: 90, estimado: true }, [dec("1", 90)]);
    const d = diagnosticarEvolucao(base, atual);
    expect(d.alertas.join(" ")).toContain("índice fechado");
    expect(d.conclusao).toContain("metodológica");
  });
});
