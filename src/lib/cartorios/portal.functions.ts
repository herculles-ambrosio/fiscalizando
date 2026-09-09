/**
 * Consulta automática da lista de serventias no Portal da Transparência do
 * TJMG. O painel público é lido direto pelo servidor (sem login e sem exportar
 * planilha); o envio manual do arquivo continua disponível como alternativa.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listarCompetenciasPortal = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const { listarCompetenciasTjmg } = await import("./tjmg.server");
    const competencias = await listarCompetenciasTjmg();
    return { ok: true as const, competencias, mensagem: "" };
  } catch (e) {
    return {
      ok: false as const,
      competencias: [] as string[],
      mensagem:
        e instanceof Error
          ? `Não foi possível falar com o portal do TJMG: ${e.message}`
          : "Não foi possível falar com o portal do TJMG.",
    };
  }
});

export const buscarServentiasPortal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        mesAno: z.string().regex(/^\d{1,2}\/\d{4}$/, "Informe a competência no formato mês/ano."),
        municipio: z.string().trim().min(1).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { baixarServentiasTjmg } = await import("./tjmg.server");
      const r = await baixarServentiasTjmg({
        mesAno: data.mesAno,
        municipio: data.municipio ?? null,
      });
      return { ok: true as const, ...r, mensagem: "" };
    } catch (e) {
      return {
        ok: false as const,
        competencia: data.mesAno,
        comarca: null,
        filtro: "estado" as const,
        linhas: [],
        mensagem:
          e instanceof Error
            ? e.message
            : "Não foi possível baixar a lista de serventias do portal do TJMG.",
      };
    }
  });

