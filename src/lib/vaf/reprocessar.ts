import { supabase } from "@/integrations/supabase/client";
import { LAYOUT_ATIVOS } from "./layouts";
import { decodificarArquivo, parseLinha, separarLinhas } from "./parser";
import {
  registrosSimeiDoRetorno,
  situacoesDoRegime,
  type RegistroSimei,
  type Situacao,
} from "./apurar";


const TAMANHO_PAGINA = 1000;
const CONCORRENCIA = 20;

export type ProgressoReprocesso = { etapa: string; percentual: number };

type LinhaContribuinte = {
  id: string;
  inscricao_estadual: string;
  situacoes: string[];
  regime_recolhimento: string | null;
};

function normalizarRegime(bruto: unknown): string | null {
  const regime = String(bruto ?? "")
    .trim()
    .padStart(2, "0");
  return !regime || regime === "00" ? null : regime;
}

/** Mapa IE -> regime de recolhimento, lido do arquivo de ativos guardado no Storage. */
async function lerRegimesDoArquivo(caminho: string): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.storage.from("uploads").download(caminho);
  if (error || !data) throw error ?? new Error("Arquivo de ativos não encontrado no armazenamento.");
  const texto = decodificarArquivo(await data.arrayBuffer());

  const regimes = new Map<string, string | null>();
  for (const linha of separarLinhas(texto)) {
    const reg = parseLinha(linha, LAYOUT_ATIVOS);
    const ie = String(reg["inscricao_estadual"] ?? "").trim();
    if (!ie) continue;
    regimes.set(ie, normalizarRegime(reg["regime_recolhimento"]));
  }
  return regimes;
}

async function carregarContribuintes(cargaId: string): Promise<LinhaContribuinte[]> {
  const todos: LinhaContribuinte[] = [];
  for (let pagina = 0; ; pagina += 1) {
    const { data, error } = await supabase
      .from("contribuintes_apurados")
      .select("id, inscricao_estadual, situacoes, regime_recolhimento")
      .eq("carga_id", cargaId)
      .order("id")
      .range(pagina * TAMANHO_PAGINA, (pagina + 1) * TAMANHO_PAGINA - 1);
    if (error) throw error;
    todos.push(...((data ?? []) as LinhaContribuinte[]));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return todos;
}

function situacoesAtualizadas(
  situacoes: string[],
  regime: string | null,
  simei: boolean,
): Situacao[] {
  const base = (situacoes ?? []).filter((s) => s !== "SIMPLES_NACIONAL" && s !== "SIMEI");
  return [...base, ...situacoesDoRegime(regime, simei)] as Situacao[];
}

/** Registros SIMEI (tipo 40) do arquivo de retorno guardado. */
async function lerSimeiDoRetorno(caminho: string | null): Promise<Map<string, RegistroSimei>> {
  if (!caminho) return new Map();
  const { data, error } = await supabase.storage.from("uploads").download(caminho);
  if (error || !data) return new Map();
  return registrosSimeiDoRetorno(decodificarArquivo(await data.arrayBuffer()));
}

/** Reprocessa uma apuração já gravada, preenchendo regime e as situações Simples Nacional/SIMEI. */
export async function reprocessarRegimesDaCarga(
  cargaId: string,
  onProgresso?: (p: ProgressoReprocesso) => void,
): Promise<{ atualizados: number; simplesNacional: number; simei: number; incluidos: number }> {
  const progresso = onProgresso ?? (() => {});

  progresso({ etapa: "Localizando arquivo de ativos", percentual: 5 });
  const { data: carga, error: erroCarga } = await supabase
    .from("cargas")
    .select("id, municipio_id, arquivo_ativos_path, arquivo_retorno_path")
    .eq("id", cargaId)
    .single();
  if (erroCarga || !carga) throw erroCarga ?? new Error("Apuração não encontrada.");
  if (!carga.arquivo_ativos_path)
    throw new Error("Esta apuração não guardou o arquivo de ativos; reenvie os arquivos.");

  progresso({ etapa: "Lendo arquivo de ativos", percentual: 15 });
  const regimes = await lerRegimesDoArquivo(carga.arquivo_ativos_path);
  const registrosSimei = await lerSimeiDoRetorno(carga.arquivo_retorno_path);
  const iesSimei = new Set(registrosSimei.keys());


  progresso({ etapa: "Carregando contribuintes", percentual: 30 });
  const contribuintes = await carregarContribuintes(cargaId);

  const pendentes = contribuintes
    .map((c) => {
      const regime = regimes.get(c.inscricao_estadual) ?? null;
      const situacoes = situacoesAtualizadas(c.situacoes, regime, iesSimei.has(c.inscricao_estadual));
      const mudou =
        regime !== c.regime_recolhimento ||
        situacoes.join("|") !== (c.situacoes ?? []).join("|");
      return { id: c.id, regime, situacoes, mudou };
    })
    .filter((c) => c.mudou);

  for (let i = 0; i < pendentes.length; i += CONCORRENCIA) {
    const lote = pendentes.slice(i, i + CONCORRENCIA);
    await Promise.all(
      lote.map(async (c) => {
        const { error } = await supabase
          .from("contribuintes_apurados")
          .update({ regime_recolhimento: c.regime, situacoes: c.situacoes })
          .eq("id", c.id);
        if (error) throw error;
      }),
    );
    progresso({
      etapa: `Atualizando contribuintes (${Math.min(i + CONCORRENCIA, pendentes.length)}/${pendentes.length})`,
      percentual: 35 + Math.round(((i + lote.length) / Math.max(pendentes.length, 1)) * 55),
    });
  }

  // Totais finais recalculados sobre o conjunto completo da carga.
  let simplesNacional = 0;
  let simei = 0;
  for (const c of contribuintes) {
    const regime = regimes.get(c.inscricao_estadual) ?? null;
    const situacoes = situacoesAtualizadas(c.situacoes, regime, iesSimei.has(c.inscricao_estadual));
    if (situacoes.includes("SIMPLES_NACIONAL")) simplesNacional += 1;
    if (situacoes.includes("SIMEI")) simei += 1;
  }

  progresso({ etapa: "Atualizando totais", percentual: 95 });
  const { error: erroTotais } = await supabase
    .from("cargas")
    .update({ total_simples_nacional: simplesNacional, total_simei: simei })
    .eq("id", cargaId);
  if (erroTotais) throw erroTotais;

  progresso({ etapa: "Concluída", percentual: 100 });
  return { atualizados: pendentes.length, simplesNacional, simei };
}

export type CargaPendente = { id: string; exercicio: number };

/** Apurações concluídas que ainda não têm os totais de regime calculados. */
export async function listarCargasSemRegime(municipioId: string): Promise<CargaPendente[]> {
  const { data, error } = await supabase
    .from("cargas")
    .select("id, exercicio, total_simples_nacional, total_simei, arquivo_ativos_path")
    .eq("municipio_id", municipioId)
    .eq("status", "concluida")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter(
      (c) => c.arquivo_ativos_path && (c.total_simples_nacional == null || c.total_simei == null),
    )
    .map((c) => ({ id: c.id, exercicio: c.exercicio }));
}

/** Reprocessa em sequência todas as apurações pendentes do município. */
export async function reprocessarCargasPendentes(
  municipioId: string,
  onProgresso?: (p: ProgressoReprocesso) => void,
): Promise<{ cargas: number; erros: string[] }> {
  const progresso = onProgresso ?? (() => {});
  const pendentes = await listarCargasSemRegime(municipioId);
  const erros: string[] = [];

  for (let i = 0; i < pendentes.length; i += 1) {
    const carga = pendentes[i]!;
    try {
      await reprocessarRegimesDaCarga(carga.id, (p) =>
        progresso({
          etapa: `Exercício ${carga.exercicio}: ${p.etapa}`,
          percentual: Math.round(((i + p.percentual / 100) / pendentes.length) * 100),
        }),
      );
    } catch (erro) {
      erros.push(
        `Exercício ${carga.exercicio}: ${erro instanceof Error ? erro.message : "falha desconhecida"}`,
      );
    }
  }

  progresso({ etapa: "Concluído", percentual: 100 });
  return { cargas: pendentes.length - erros.length, erros };
}
