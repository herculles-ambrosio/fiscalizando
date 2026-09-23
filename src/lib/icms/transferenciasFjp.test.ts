import { describe, expect, it } from "vitest";
import { lerTransferencias, numeroPtBr } from "./transferenciasFjp";

const tabela = `TRANSFERÊNCIAS DE 2026
TRANSFERÊNCIAS\tJANEIRO\tFEVEREIRO\tMARÇO
TRANSFERÊNCIA BRUTA (I) = (II)+(III)\t1.805.322.792,00\t1.484.391.259,00\t2.019.078.270,00
TRANSFERÊNCIA LÍQUIDA (VI)=(I)-(IV)-(V)\t1.444.088.296,00\t1.187.334.667,00\t1.615.086.084,00
75% REPASSADO PELO VAF\t1.083.066.222,00\t890.501.000,00\t1.211.314.563,00
25% REPASSADO CONFORME LEI ROBIN HOOD\t361.022.073,90\t296.833.666,70\t403.771.521,00`;

describe("tabela de transferências da FJP", () => {
  it("lê números em pt-BR", () => {
    expect(numeroPtBr("1.083.066.222,00")).toBe(1083066222);
    expect(numeroPtBr("abc")).toBeNull();
  });

  it("lê o exercício e as três linhas", () => {
    const r = lerTransferencias(tabela);
    expect(r.exercicio).toBe(2026);
    expect(r.mesesComVaf).toBe(3);
    expect(r.meses[0]!.vaf75).toBe(1083066222);
    expect(r.meses[1]!.transferenciaLiquida).toBe(1187334667);
    expect(r.meses[2]!.robinHood25).toBe(403771521);
    expect(r.meses[3]!.vaf75).toBeNull();
  });
});
