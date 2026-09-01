import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Comparativo entre municípios buscado direto no portal oficial da Lei
 * Robin Hood (FJP), sem depender do extrato em arquivo.
 */

export const listarMunicipiosFjpFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listarMunicipiosFjp } = await import("./robinhood.server");
  return await listarMunicipiosFjp();
});

export const compararMunicipiosFjp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        exercicio: z.number().int().min(1991).max(2100),
        municipios: z
          .array(z.object({ id: z.number().int().positive(), nome: z.string().trim().min(1) }))
          .min(1)
          .max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { coletarValoresMunicipio } = await import("./robinhood.server");

    const resultados: {
      nome: string;
      registros: { criterio: string; mes: number; valor: number | null }[];
      erro: string | null;
    }[] = [];

    for (const m of data.municipios) {
      try {
        const registros = await coletarValoresMunicipio(m.id, data.exercicio);
        resultados.push({
          nome: m.nome,
          registros: registros.map((r) => ({ criterio: r.criterio, mes: r.mes, valor: r.valor })),
          erro: null,
        });
      } catch (e) {
        resultados.push({
          nome: m.nome,
          registros: [],
          erro: e instanceof Error ? e.message : "sem resposta do portal",
        });
      }
    }

    return { exercicio: data.exercicio, resultados };
  });
