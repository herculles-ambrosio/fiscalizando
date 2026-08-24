import { describe, expect, it } from "vitest";
import { LAYOUTS_RETORNO } from "./layouts";
import { parseLinha } from "./parser";

/**
 * Linhas reais do retorno P443RT1326-5 (COMPANHIA ENERGETICA SANTA CLARA,
 * IE 4430519620129). Os valores da SEF vêm em reais inteiros.
 */
const LINHA_02 =
  "024434430519620129WILLIAM OLIVEIRA DA SILVA          36564988818000                         113478595000000000216476700000001895990300000000000000000000001679513601";

describe("parseLinha — valores monetários da SEF", () => {
  it("lê o valor adicionado anterior (registro 02) em reais inteiros", () => {
    const reg = parseLinha(LINHA_02, LAYOUTS_RETORNO["02"]!);
    expect(reg["valor_adicionado_anterior_num"]).toBe(16795136);
  });

  it("não aplica casas decimais implícitas", () => {
    const layout = LAYOUTS_RETORNO["02"]!;
    const reg = parseLinha(LINHA_02, layout);
    for (const [, , tipo, nome] of layout) {
      if (tipo !== "N") continue;
      const bruto = String(reg[nome] ?? "").replace(/[^0-9]/g, "");
      if (!bruto) continue;
      const valor = reg[nome + "_num"];
      if (valor == null) continue;
      expect(Number.isInteger(valor)).toBe(true);
    }
  });
});
