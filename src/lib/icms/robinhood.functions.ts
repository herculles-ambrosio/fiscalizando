import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Sincronização automática com o portal oficial da Lei Robin Hood (FJP).
 * A coleta em si vive em robinhood.server.ts e é carregada dentro do handler
 * para não entrar no bundle do navegador.
 */
export const sincronizarRobinHood = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        municipio: z.string().trim().min(2).max(120),
        codigoIbge: z.string().trim().max(10).optional().nullable(),
        exercicio: z.number().int().min(1991).max(2100),
        meses: z.array(z.number().int().min(1).max(12)).max(12).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { coletarRobinHood } = await import("./robinhood.server");
    const coleta = await coletarRobinHood({
      municipio: data.municipio,
      codigoIbge: data.codigoIbge ?? null,
      exercicio: data.exercicio,
      ...(data.meses ? { meses: data.meses } : {}),
    });
    return {
      exercicio: data.exercicio,
      fonte: coleta.fonte,
      registros: coleta.registros,
      mesesComDados: coleta.mesesComDados,
      tentativas: coleta.tentativas,
    };
  });
