/**
 * Tentativa de buscar automaticamente a lista de serventias no Portal da
 * Transparência do TJMG. O painel é um Qlik Sense protegido por firewall e,
 * na maior parte das vezes, recusa acesso automatizado — por isso a função
 * devolve um diagnóstico claro para a tela orientar o envio do arquivo.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PAGINA_TJMG =
  "https://www.tjmg.jus.br/portal-tjmg/transparencia/tj-em-numeros/qlik/genot-portal-da-transparencia.htm";

export const buscarPortalCartorios = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ url: z.string().url().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const alvo = data.url ?? PAGINA_TJMG;
    try {
      const resposta = await fetch(alvo, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });
      const texto = await resposta.text();
      if (!resposta.ok) {
        return {
          ok: false as const,
          status: resposta.status,
          mensagem:
            resposta.status === 403
              ? "O portal do TJMG bloqueou a consulta automática (o painel é protegido). Exporte a lista de serventias no site e envie o arquivo."
              : `O portal respondeu com erro ${resposta.status}.`,
          amostra: texto.slice(0, 400),
        };
      }
      // Se o endereço informado for um CSV/JSON de exportação, devolvemos o
      // conteúdo bruto para a tela ler com o mesmo leitor dos arquivos.
      const tipo = resposta.headers.get("content-type") ?? "";
      const ehTabela =
        tipo.includes("csv") || tipo.includes("json") || tipo.includes("spreadsheet");
      return {
        ok: true as const,
        status: resposta.status,
        tipo,
        conteudo: ehTabela ? texto.slice(0, 4_000_000) : null,
        mensagem: ehTabela
          ? "Conteúdo baixado do endereço informado."
          : "O endereço respondeu, mas devolveu a página do painel (não os dados). Exporte a lista no portal e envie o arquivo.",
      };
    } catch (e) {
      return {
        ok: false as const,
        status: 0,
        mensagem:
          e instanceof Error
            ? `Não foi possível acessar o portal: ${e.message}`
            : "Não foi possível acessar o portal.",
        amostra: "",
      };
    }
  });
