/**
 * Repasse do critério Educação, município a município, buscado no portal da
 * Lei Robin Hood (FJP). Serve para conferir o índice de Educação calculado a
 * partir da planilha da FJP com o dinheiro que o município realmente recebeu.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const repasseEducacaoFjp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        exercicio: z.number().int().min(1991).max(2100),
        municipios: z
          .array(z.object({ id: z.number().int().positive(), nome: z.string().trim().min(1) }))
          .min(1)
          .max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { coletarCriterioAnual } = await import("./robinhood.server");

    const linhas: {
      id: number;
      nome: string;
      valor: number | null;
      indice: number | null;
      meses: number;
      erro: string | null;
    }[] = [];

    // Em blocos pequenos: o portal derruba conexões quando recebe muitas
    // requisições ao mesmo tempo.
    const bloco = 4;
    for (let i = 0; i < data.municipios.length; i += bloco) {
      const parte = data.municipios.slice(i, i + bloco);
      const resultado = await Promise.all(
        parte.map(async (m) => {
          try {
            const r = await coletarCriterioAnual(m.id, data.exercicio, "educacao");
            return { id: m.id, nome: m.nome, ...r, erro: null as string | null };
          } catch (e) {
            return {
              id: m.id,
              nome: m.nome,
              valor: null,
              indice: null,
              meses: 0,
              erro: e instanceof Error ? e.message : "sem resposta do portal",
            };
          }
        }),
      );
      linhas.push(...resultado);
    }

    return { exercicio: data.exercicio, linhas };
  });
