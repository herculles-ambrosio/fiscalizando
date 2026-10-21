import { describe, expect, it } from "vitest";
import { acharCodigoMunicipio } from "./baseReceita";

const mapa = new Map([["4021", "AMPARO DA SERRA"], ["4017", "AGUAS FORMOSAS"], ["9999", "PINGO D'AGUA"]]);

describe("acharCodigoMunicipio", () => {
  it("encontra Amparo do Serra mesmo grafado AMPARO DA SERRA", () => {
    expect(acharCodigoMunicipio(mapa, "Amparo do Serra")).toEqual({ tipo: "exato", achados: [["4021", "AMPARO DA SERRA"]] });
  });
  it("ignora apóstrofo e acento", () => {
    expect(acharCodigoMunicipio(mapa, "Pingo-d'Água").achados[0]![0]).toBe("9999");
  });
  it("aceita erro de digitação como provável", () => {
    const r = acharCodigoMunicipio(mapa, "Aguas Formozas");
    expect(r.tipo).toBe("provavel");
    expect(r.achados[0]![0]).toBe("4017");
  });
});
