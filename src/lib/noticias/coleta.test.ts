import { describe, expect, it } from "vitest";
import { lerRespostaTexto } from "./coleta.server";

describe("lerRespostaTexto", () => {
  it("preserva acentos de uma fonte ISO-8859-1", async () => {
    const bytes = Uint8Array.from(
      Array.from("Relatório de Gestão Fiscal dos municípios", (caractere) =>
        caractere.codePointAt(0) ?? 0,
      ),
    );
    const resposta = new Response(bytes, {
      headers: { "content-type": "text/html; charset=iso-8859-1" },
    });

    await expect(lerRespostaTexto(resposta)).resolves.toBe(
      "Relatório de Gestão Fiscal dos municípios",
    );
  });

  it("mantém UTF-8 como padrão quando o charset não é informado", async () => {
    const resposta = new Response("Execução Orçamentária", {
      headers: { "content-type": "application/rss+xml" },
    });

    await expect(lerRespostaTexto(resposta)).resolves.toBe("Execução Orçamentária");
  });
});