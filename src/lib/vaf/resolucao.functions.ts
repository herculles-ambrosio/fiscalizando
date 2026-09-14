import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseAnexoResolucao, type AnexoResolucao } from "./resolucao";

const entrada = z.object({
  url: z
    .string()
    .url()
    .refine((u) => {
      try {
        return new URL(u).hostname.endsWith("fazenda.mg.gov.br");
      } catch {
        return false;
      }
    }, "Informe um endereço do site da Fazenda de Minas Gerais (fazenda.mg.gov.br)."),
});

/** Baixa a página da resolução na SEF-MG e devolve o anexo já interpretado. */
export const buscarResolucao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrada.parse(input))
  .handler(async ({ data }): Promise<AnexoResolucao> => {
    const resposta = await fetch(data.url, {
      headers: { "User-Agent": "ApuraVAF/1.0 (+https://apuravaf20.com)" },
    });
    if (!resposta.ok) {
      throw new Error(`A página da resolução respondeu com erro ${resposta.status}.`);
    }
    const bytes = await resposta.arrayBuffer();
    const bruto = new TextDecoder("utf-8").decode(bytes);
    const latin = /charset=["']?(iso-8859-1|windows-1252)/i.test(bruto) || bruto.includes("\uFFFD");
    const html = latin ? new TextDecoder("iso-8859-1").decode(bytes) : bruto;
    return parseAnexoResolucao(html);
  });
