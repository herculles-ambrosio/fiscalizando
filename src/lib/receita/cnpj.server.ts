import { normalizarRetorno, type RegistroReceita } from "./normalizar";

type Fonte = { nome: string; url: (cnpj: string) => string };

/** Fontes gratuitas dos dados abertos do CNPJ, tentadas nesta ordem. */
const FONTES: Fonte[] = [
  { nome: "opencnpj", url: (c) => `https://api.opencnpj.org/${c}` },
  { nome: "minhareceita", url: (c) => `https://minhareceita.org/${c}` },
  { nome: "brasilapi", url: (c) => `https://brasilapi.com.br/api/cnpj/v1/${c}` },
];

export type ResultadoConsulta =
  | { cnpj: string; ok: true; registro: RegistroReceita }
  | { cnpj: string; ok: false; naoEncontrado: boolean; erro: string };

async function buscarEm(fonte: Fonte, cnpj: string): Promise<ResultadoConsulta | null> {
  const controle = new AbortController();
  const timeout = setTimeout(() => controle.abort(), 15000);
  try {
    const resposta = await fetch(fonte.url(cnpj), {
      headers: { accept: "application/json" },
      signal: controle.signal,
    });
    if (resposta.status === 404) {
      return { cnpj, ok: false, naoEncontrado: true, erro: "CNPJ não encontrado na base pública." };
    }
    if (!resposta.ok) return null; // tenta a próxima fonte (limite, indisponibilidade…)
    const bruto = (await resposta.json()) as Record<string, unknown>;
    return { cnpj, ok: true, registro: normalizarRetorno(cnpj, fonte.nome, bruto) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function consultarCnpj(cnpj: string, tentativas = 3): Promise<ResultadoConsulta> {
  // Cada rodada tenta todas as fontes; entre rodadas espera um pouco (limite de uso).
  for (let rodada = 0; rodada < tentativas; rodada++) {
    for (const fonte of FONTES) {
      const resultado = await buscarEm(fonte, cnpj);
      if (resultado) return resultado;
    }
    if (rodada < tentativas - 1) {
      await new Promise((r) => setTimeout(r, 600 * (rodada + 1)));
    }
  }
  return {
    cnpj,
    ok: false,
    naoEncontrado: false,
    erro: "Nenhuma das fontes públicas respondeu. Tente novamente em alguns minutos.",
  };
}


/** Consulta com concorrência limitada, para não ser bloqueado pelas fontes públicas. */
export async function consultarLote(cnpjs: string[], concorrencia = 4) {
  const resultados: ResultadoConsulta[] = [];
  let indice = 0;
  async function trabalhador() {
    while (indice < cnpjs.length) {
      const cnpj = cnpjs[indice++]!;
      resultados.push(await consultarCnpj(cnpj));
      await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concorrencia, cnpjs.length) }, () => trabalhador()),
  );
  return resultados;
}
