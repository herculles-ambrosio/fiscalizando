import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Entrada = z.object({
  pergunta: z.string().min(3).max(1000),
  contexto: z.string().min(1).max(20000),
});

const SISTEMA = [
  "Você é um analista de finanças públicas municipais de Minas Gerais especializado em VAF e ICMS.",
  "Responda em português do Brasil, de forma simples e direta, para servidores municipais sem formação técnica.",
  "Use exclusivamente os números da memória de cálculo fornecida; nunca invente valores.",
  "Quando útil, mostre a conta passo a passo (índice × bolada do Estado, participação do mês, etc.).",
  "Lembre que o repasse mensal é o índice do município aplicado sobre a bolada do VAF do Estado (75% da transferência líquida) e que a previsão é uma estimativa.",
  "Máximo de 250 palavras.",
].join(" ");

export const explicarPrevisao = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => {
    const chave = process.env["LOVABLE_API_KEY"];
    if (!chave) throw new Error("A chave da IA não está configurada.");

    const resposta = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": chave,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        instructions: SISTEMA,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Memória de cálculo exibida na tela:\n\n${data.contexto}\n\nDúvida do servidor municipal: ${data.pergunta}`,
              },
            ],
          },
        ],
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text().catch(() => "");
      if (resposta.status === 429)
        throw new Error("Muitas consultas seguidas. Aguarde alguns instantes e tente de novo.");
      if (resposta.status === 402)
        throw new Error("Os créditos de IA acabaram. Adicione créditos para continuar usando.");
      throw new Error(`Não foi possível consultar a IA (${resposta.status}). ${texto.slice(0, 200)}`);
    }

    const leitor = resposta.body?.getReader();
    if (!leitor) throw new Error("A IA não retornou resposta.");
    const decoder = new TextDecoder();
    let buffer = "";
    let texto = "";

    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const partes = buffer.split("\n\n");
      buffer = partes.pop() ?? "";
      for (const bloco of partes) {
        for (const linha of bloco.split("\n")) {
          if (!linha.startsWith("data:")) continue;
          const bruto = linha.slice(5).trim();
          if (!bruto || bruto === "[DONE]") continue;
          try {
            const evento = JSON.parse(bruto) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (evento.type === "response.output_text.delta" && evento.delta) {
              texto += evento.delta;
            } else if (
              evento.type === "response.completed" &&
              !texto &&
              evento.response?.output_text
            ) {
              texto = evento.response.output_text;
            }
          } catch {
            // ignora eventos parciais
          }
        }
      }
    }

    return {
      resposta:
        texto.trim() ||
        "A IA não conseguiu formular uma explicação desta vez. Tente reformular a dúvida.",
    };
  });
