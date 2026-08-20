import { describe, expect, it } from "vitest";
import { montarPlanoRecuperacao } from "./recuperacao";
import type { DiagnosticoEvolucao } from "./diagnostico";
import type { ComparacaoDeclarantes, MovimentoDeclarante } from "./evolucao";

const decl = (p: Partial<MovimentoDeclarante>): MovimentoDeclarante => ({
  inscricao_estadual: "0011",
  nome: "Empresa",
  cnpj: null,
  vafBase: 0,
  vafAtual: 0,
  diferenca: 0,
  variacaoPct: null,
  situacao: "manteve",
  origemNome: null,
  origemCnpj: null,
  cadastroIncompleto: false,
  ...p,
});

const diag = (over: Partial<DiagnosticoEvolucao> = {}): DiagnosticoEvolucao => ({
  valorBase: 1_000_000,
  valorAtual: 400_000,
  diferenca: -600_000,
  variacaoPct: -60,
  sentido: "reduziu",
  fatores: [],
  fatoresDeclarantes: [],
  topQuedas: [],
  topAltas: [],
  resumo: "",
  conclusao: "",
  alertas: [],
  ...over,
});

const comparacao = (over: Partial<ComparacaoDeclarantes> = {}): ComparacaoDeclarantes => ({
  sairam: [],
  entraram: [],
  permaneceram: [],
  todos: [],
  ...over,
});

describe("montarPlanoRecuperacao", () => {
  it("cria ação de omissos somando o VAF perdido", () => {
    const sairam = [
      decl({ inscricao_estadual: "1", vafBase: 300_000, diferenca: -300_000, situacao: "saiu" }),
      decl({ inscricao_estadual: "2", vafBase: 250_000, diferenca: -250_000, situacao: "saiu" }),
    ];
    const acoes = montarPlanoRecuperacao(diag(), comparacao({ sairam }));
    const omissos = acoes.find((a) => a.chave === "omissos");
    expect(omissos).toBeTruthy();
    expect(omissos!.valorRecuperavel).toBe(550_000);
    expect(omissos!.situacaoOficio).toBe("OMISSO");
    expect(omissos!.prioridade).toBe("alta");
  });

  it("separa zerados de discrepantes conforme os limites", () => {
    const permaneceram = [
      decl({ inscricao_estadual: "3", vafBase: 100_000, vafAtual: 0, diferenca: -100_000, variacaoPct: -100 }),
      decl({ inscricao_estadual: "4", vafBase: 200_000, vafAtual: 100_000, diferenca: -100_000, variacaoPct: -50 }),
      decl({ inscricao_estadual: "5", vafBase: 200_000, vafAtual: 190_000, diferenca: -10_000, variacaoPct: -5 }),
    ];
    const acoes = montarPlanoRecuperacao(diag(), comparacao({ permaneceram }));
    const zerados = acoes.find((a) => a.chave === "zerados");
    const disc = acoes.find((a) => a.chave === "discrepantes");
    expect(zerados!.contribuintes.map((c) => c.inscricao_estadual)).toEqual(["3"]);
    expect(disc!.contribuintes.map((c) => c.inscricao_estadual)).toEqual(["4"]);
    expect(disc!.valorRecuperavel).toBe(100_000);
  });

  it("sugere impugnação apenas quando há perda", () => {
    const comPerda = montarPlanoRecuperacao(diag(), comparacao());
    expect(comPerda.some((a) => a.chave === "impugnacao")).toBe(true);

    const comGanho = montarPlanoRecuperacao(
      diag({ diferenca: 200_000, valorAtual: 1_200_000, sentido: "aumentou", variacaoPct: 20 }),
      comparacao(),
    );
    expect(comGanho.some((a) => a.chave === "impugnacao")).toBe(false);
  });

  it("ordena por prioridade e valor", () => {
    const acoes = montarPlanoRecuperacao(
      diag(),
      comparacao({
        sairam: [decl({ inscricao_estadual: "9", vafBase: 900_000, situacao: "saiu" })],
      }),
    );
    expect(acoes[0]!.prioridade).toBe("alta");
    expect(acoes.at(-1)!.prioridade).toBe("baixa");
  });
});
