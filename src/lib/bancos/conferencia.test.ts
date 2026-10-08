import { describe, expect, it } from "vitest";
import { alertaRateio, conferirConta, estimativaRateio, receitaMensalEstban, type ContaCfg } from "./conferencia";
import { lerEstban } from "./importacao";

const plano: ContaCfg[] = [
  { conta: "7.1.7", descricao: "Serviços", item_lc116: "15", aliquota: 5, tributavel: true },
  { conta: "7.1.7.10", descricao: "Cobrança", item_lc116: "15.10", aliquota: 3, tributavel: true },
  { conta: "7.1.1", descricao: "Juros", item_lc116: null, aliquota: 0, tributavel: false },
];
const base = { cnpj: "1", competencia_ano: 2025, competencia_mes: 1 };

describe("conferência do ISS bancário", () => {
  it("conta 7.1.7 declarada como não tributável gera indício e ISS devido", () => {
    const r = conferirConta({ ...base, conta: "7.1.7.30.00-1", valor: 10000, tributavel_declarado: false }, plano);
    expect(r.tributavelEsperado).toBe(true);
    expect(r.diferenca).toBe(500);
    expect(r.motivos[0]).toContain("não tributável");
  });

  it("usa a alíquota do item mais específico", () => {
    const r = conferirConta({ ...base, conta: "7.1.7.10.00-6", valor: 1000, tributavel_declarado: true, iss_declarado: 30 }, plano);
    expect(r.aliquota).toBe(3);
    expect(r.diferenca).toBe(0);
  });

  it("conta de juros não é tributável", () => {
    expect(conferirConta({ ...base, conta: "7.1.1.05.00-3", valor: 1000, tributavel_declarado: false }, plano).diferenca).toBe(0);
  });

  it("rateio aplica a participação do município", () => {
    expect(estimativaRateio(200000, 2.5)).toBe(5000);
    expect(alertaRateio(5000, 3000)).not.toBeNull();
    expect(alertaRateio(5000, 4000)).toBeNull();
  });

  it("receita mensal do ESTBAN desacumula o semestre", () => {
    const m = receitaMensalEstban([
      { competencia_ano: 2025, competencia_mes: 1, cnpj_raiz: "x", nome: "B", verbete_711: 100 },
      { competencia_ano: 2025, competencia_mes: 2, cnpj_raiz: "x", nome: "B", verbete_711: 250 },
    ]);
    expect(m.get("x|2025|1")).toBe(100);
    expect(m.get("x|2025|2")).toBe(150);
  });

  it("lê o CSV do ESTBAN filtrando o município", () => {
    const csv = "x\n#DATA_BASE;UF;CODMUN;MUNICIPIO;CNPJ;NOME_INSTITUICAO;AGEN_ESPERADAS;AGEN_PROCESSADAS;VERBETE_710_CONTAS_DE_RESULTADO;VERBETE_711_CONTAS_CREDORAS;VERBETE_712_CONTAS_DEVEDORAS\n202501;MG;1;CAPARAO;00000000;BANCO DO BRASIL;1;1;10;30;-20\n202501;MG;2;OUTRA;1;X;1;1;1;1;1";
    const r = lerEstban(csv, "Caparaó", "MG");
    expect(r).toHaveLength(1);
    expect(r[0]!.verbete_711).toBe(30);
  });
});
