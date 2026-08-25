/**
 * Fila de reconsulta das situações da Receita Federal.
 * CNPJs que falharam por rede/limite entram aqui e são reprocessados em
 * horários escalonados por um worker agendado (pg_cron -> rota pública).
 */
import { consultarLote } from "./cnpj.server";

/** Espera entre tentativas (minutos), escalonada. */
const ESPERA_MINUTOS = [10, 60, 360, 1440];
const MAX_TENTATIVAS = ESPERA_MINUTOS.length + 1;

function proximaEm(tentativas: number): string {
  const minutos = ESPERA_MINUTOS[Math.min(tentativas, ESPERA_MINUTOS.length) - 1] ?? 10;
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Registra/atualiza CNPJs sem resposta para nova tentativa mais tarde. */
export async function enfileirarFalhas(cnpjs: string[], erro: string) {
  if (!cnpjs.length) return;
  const db = await admin();
  const { data: atuais } = await db
    .from("receita_fila")
    .select("cnpj, tentativas")
    .in("cnpj", cnpjs);
  const mapa = new Map((atuais ?? []).map((r) => [r.cnpj, r.tentativas ?? 0]));
  const linhas = cnpjs.map((cnpj) => {
    const tentativas = (mapa.get(cnpj) ?? 0) + 1;
    return {
      cnpj,
      tentativas,
      ultimo_erro: erro.slice(0, 500),
      status: tentativas >= MAX_TENTATIVAS ? "desistido" : "pendente",
      proxima_em: proximaEm(tentativas),
      atualizado_em: new Date().toISOString(),
    };
  });
  await db.from("receita_fila").upsert(linhas as never, { onConflict: "cnpj" });
}

/** Marca como concluídos os CNPJs que já obtiveram resposta. */
export async function concluirFila(cnpjs: string[]) {
  if (!cnpjs.length) return;
  const db = await admin();
  await db
    .from("receita_fila")
    .update({ status: "concluido", atualizado_em: new Date().toISOString() } as never)
    .in("cnpj", cnpjs);
}

/** Trava de execução única (lease com validade), para não rodar em paralelo. */
async function tomarTrava(chave: string, segundos: number): Promise<boolean> {
  const db = await admin();
  const agora = new Date();
  const { data } = await db.from("jobs_lease").select("chave, expira_em").eq("chave", chave).maybeSingle();
  if (data && new Date(data.expira_em) > agora) return false;
  const expira = new Date(agora.getTime() + segundos * 1000).toISOString();
  const { error } = await db
    .from("jobs_lease")
    .upsert({ chave, expira_em: expira, atualizado_em: agora.toISOString() } as never, {
      onConflict: "chave",
    });
  return !error;
}

async function soltarTrava(chave: string) {
  const db = await admin();
  await db
    .from("jobs_lease")
    .update({ expira_em: new Date().toISOString() } as never)
    .eq("chave", chave);
}

export type ResultadoFila = {
  processados: number;
  atualizados: number;
  naoEncontrados: number;
  falhas: number;
  restantes: number;
  ignorado?: string;
};

/** Processa um lote limitado de CNPJs pendentes cujo horário já chegou. */
export async function processarFilaReceita(limite = 40): Promise<ResultadoFila> {
  const vazio: ResultadoFila = {
    processados: 0,
    atualizados: 0,
    naoEncontrados: 0,
    falhas: 0,
    restantes: 0,
  };
  const chave = "receita-fila";
  if (!(await tomarTrava(chave, 300))) {
    return { ...vazio, ignorado: "Outra execução em andamento." };
  }
  try {
    const db = await admin();
    const agora = new Date().toISOString();
    const { data: pendentes, error } = await db
      .from("receita_fila")
      .select("cnpj")
      .eq("status", "pendente")
      .lte("proxima_em", agora)
      .order("proxima_em", { ascending: true })
      .limit(Math.min(limite, 100));
    if (error) throw new Error(error.message);
    const cnpjs = (pendentes ?? []).map((r) => r.cnpj);
    if (!cnpjs.length) return vazio;

    const resultados = await consultarLote(cnpjs, 3);
    const ok = resultados.filter((r) => r.ok);
    const naoEncontrados = resultados
      .filter((r) => !r.ok && (r as { naoEncontrado: boolean }).naoEncontrado)
      .map((r) => r.cnpj);
    const falhas = resultados
      .filter((r) => !r.ok && !(r as { naoEncontrado: boolean }).naoEncontrado)
      .map((r) => r.cnpj);

    if (ok.length) {
      const linhas = ok.map((r) => ({
        ...(r as { registro: Record<string, unknown> }).registro,
        consultado_em: new Date().toISOString(),
      }));
      const { error: erroUpsert } = await db
        .from("situacoes_receita")
        .upsert(linhas as never, { onConflict: "cnpj" });
      if (erroUpsert) throw new Error(erroUpsert.message);
    }

    await concluirFila([...ok.map((r) => r.cnpj), ...naoEncontrados]);
    await enfileirarFalhas(falhas, "Sem resposta das bases públicas no worker agendado.");

    const { count } = await db
      .from("receita_fila")
      .select("cnpj", { count: "exact", head: true })
      .eq("status", "pendente");

    return {
      processados: cnpjs.length,
      atualizados: ok.length,
      naoEncontrados: naoEncontrados.length,
      falhas: falhas.length,
      restantes: count ?? 0,
    };
  } finally {
    await soltarTrava(chave);
  }
}
