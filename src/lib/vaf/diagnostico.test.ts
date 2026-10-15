import { describe, expect, it } from "vitest";
import { diagnosticarEvolucao, impactoDeclarante } from "./diagnostico";
import type { ArquivoEvolucao, Declarante, MovimentoDeclarante } from "./evolucao";
import type { ApuracaoIndice } from "./indice";

const declarante = (
  ie: string,
  vafBase: number,
  vafAtual: number,
  situacao: MovimentoDeclarante["situacao"] = "manteve",
): MovimentoDeclarante => ({
  inscricao_estadual: ie,
  nome: `Contribuinte ${ie}`,
  cnpj: null,
  vafBase,
  vafAtual,
  diferenca: vafAtual - vafBase,
  variacaoPct: vafBase === 0 ? null : ((vafAtual - vafBase) / Math.abs(vafBase)) * 100,
  situacao,
  origemNome: null,
  origemCnpj: null,
  cadastroIncompleto: false,
});

const apuracao = (valorLiquido: number): ApuracaoIndice => ({
  tipoIndice: "definitivo",
  codigoMunicipio: "3106200",
  anoBase: 2025,
  periodoInicio: null,
  periodoFim: null,
  vafProprio: 0,
  creditoExterno: 0,
  creditoInterno: 0,
  creditoProprio: 0,
  debito: 0,
  acertoCredito: 0,
  acertoDebito: 0,
  valorLiquido,
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
});

const arquivo = (declarantes: Declarante[], valorLiquido: number): ArquivoEvolucao => ({
  nome: "arquivo",
  apuracao: apuracao(valorLiquido),
  declarantes,
  temIndiceFechado: true,
  outrasEntradas: { contribuintes: [], total: 0, temDetalhamento: false },
});

const comoDeclarantes = (
  ms: MovimentoDeclarante[],
  lado: "base" | "atual",
): Declarante[] =>
  ms.map((m) => ({
    inscricao_estadual: m.inscricao_estadual,
    cnpj: m.cnpj,
    nome: m.nome,
    exercicio: null,
    data_entrega: null,
    vaf: lado === "base" ? m.vafBase : m.vafAtual,
    origemNome: null,
    origemCnpj: null,
  }));

describe("impacto com base negativa", () => {
  it("base negativa: impacto é o valor comparado, não a soma com a base", () => {
    const d = declarante("123", -2_890_096, 4_456_430);
    expect(impactoDeclarante(d)).toBe(4_456_430);
  });

  it("base positiva ou zero: impacto segue a diferença comum", () => {
    expect(impactoDeclarante(declarante("456", 1_000, 3_000))).toBe(2_000);
    expect(impactoDeclarante(declarante("789", 0, 832_590))).toBe(832_590);
  });

  it("fator 'Permaneceram e aumentaram' usa o comparado como impacto e mantém a base bruta", () => {
    const base = arquivo(
      comoDeclarantes(
        [
          declarante("123", -2_890_096, 4_456_430),
          declarante("456", 4_255_823, 6_043_387),
        ],
        "base",
      ),
      1_609_737, // -2.890.096 + 4.456.430 (simplificado)
    );
    const atual = arquivo(
      comoDeclarantes(
        [
          declarante("123", -2_890_096, 4_456_430),
          declarante("456", 4_255_823, 6_043_387),
        ],
        "atual",
      ),
      10_499_817,
    );
    const d = diagnosticarEvolucao(base, atual);
    const altas = d.fatoresDeclarantes.find((f) => f.chave === "altas");
    expect(altas).toBeDefined();
    const item123 = altas!.itens.find((i) => i.chave === "123");
    expect(item123!.impacto).toBe(4_456_430);
    expect(item123!.valorBase).toBe(-2_890_096);
    const item456 = altas!.itens.find((i) => i.chave === "456");
    expect(item456!.impacto).toBe(1_787_564);
  });

  it("a soma dos fatores por declarante fecha com a variação total", () => {
    const base = arquivo(
      comoDeclarantes(
        [
          declarante("123", -2_890_096, 4_456_430),
          declarante("456", 1_000, 500),
          declarante("789", 2_000, 0, "saiu"),
          declarante("321", 0, 3_000, "entrou"),
        ],
        "base",
      ),
      0,
    );
    const atual = arquivo(
      comoDeclarantes(
        [
          declarante("123", -2_890_096, 4_456_430),
          declarante("456", 1_000, 500),
          declarante("321", 0, 3_000, "entrou"),
        ],
        "atual",
      ),
      3_956_430 - 500 + 3_000 + 2_000,
    );
    const d = diagnosticarEvolucao(base, atual);
    const somaFatores = d.fatoresDeclarantes.reduce((s, f) => s + f.impacto, 0);
    expect(somaFatores).toBeCloseTo(d.diferenca, 6);
  });

  it("cards 'Maiores altas' repetem o comparado quando a base é negativa", () => {
    const base = arquivo(
      comoDeclarantes([declarante("123", -2_890_096, 4_456_430)], "base"),
      -2_890_096,
    );
    const atual = arquivo(
      comoDeclarantes([declarante("123", -2_890_096, 4_456_430)], "atual"),
      4_456_430,
    );
    const d = diagnosticarEvolucao(base, atual);
    const alta = d.topAltas.find((c) => c.inscricao_estadual === "123");
    expect(alta).toBeDefined();
    expect(alta!.diferenca).toBe(4_456_430);
  });
});
