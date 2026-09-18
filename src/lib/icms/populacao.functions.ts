/**
 * População oficial dos municípios mineiros (IBGE).
 *
 * É a mesma base que a Lei 18.030/2009 usa nos critérios População e
 * População dos 50 mais populosos, e serve de denominador para comparar
 * repasse por habitante entre municípios de portes diferentes.
 *
 * Duas fontes: o Censo 2022 (agregado 4714, variável 93) e a estimativa mais
 * recente publicada (agregado 6579, variável 9324).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ESTIMATIVA =
  "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6%5BN3%5B31%5D%5D";
const CENSO =
  "https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6%5BN3%5B31%5D%5D";

type Serie = {
  localidade: { id: string; nome: string };
  serie: Record<string, string>;
};

type LinhaPopulacao = {
  codigo_ibge: string;
  ano: number;
  nome: string;
  uf: string;
  populacao: number;
  fonte: string;
};

async function lerAgregado(url: string, fonte: string): Promise<LinhaPopulacao[]> {
  const resposta = await fetch(url, { headers: { accept: "application/json" } });
  if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
  const json = (await resposta.json()) as {
    resultados: { series: Serie[] }[];
  }[];
  const series = json[0]?.resultados?.[0]?.series ?? [];
  const linhas: LinhaPopulacao[] = [];
  for (const s of series) {
    const [ano, valor] = Object.entries(s.serie)[0] ?? [];
    const numero = Number(valor);
    if (!ano || !Number.isFinite(numero) || numero <= 0) continue;
    linhas.push({
      codigo_ibge: s.localidade.id,
      ano: Number(ano),
      nome: s.localidade.nome.replace(/\s*-\s*MG$/i, "").trim(),
      uf: "MG",
      populacao: Math.round(numero),
      fonte,
    });
  }
  return linhas;
}

/**
 * Busca no IBGE e regrava a população de todos os municípios mineiros.
 * Só a consultoria pode disparar a carga; a leitura é livre para usuários
 * autenticados.
 */
export const atualizarPopulacaoIbge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: perfil } = await context.supabase
      .from("perfis")
      .select("papel")
      .eq("id", context.userId)
      .maybeSingle();
    const papel = perfil?.papel ?? "";
    if (papel !== "superadmin" && papel !== "consultor") {
      throw new Error("Apenas a consultoria pode atualizar a população.");
    }

    const [estimativa, censo] = await Promise.all([
      lerAgregado(ESTIMATIVA, "IBGE — estimativa"),
      lerAgregado(CENSO, "IBGE — Censo 2022"),
    ]);
    const linhas = [...censo, ...estimativa];
    if (!linhas.length) throw new Error("O IBGE não devolveu nenhum município.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < linhas.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("municipios_populacao")
        .upsert(linhas.slice(i, i + 500), { onConflict: "codigo_ibge,ano" });
      if (error) throw new Error(error.message);
    }

    const anoEstimativa = estimativa[0]?.ano ?? null;
    return {
      total: linhas.length,
      municipios: new Set(linhas.map((l) => l.codigo_ibge)).size,
      anoEstimativa,
    };
  });
