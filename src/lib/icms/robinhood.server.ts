/**
 * Coleta automática dos dados do portal oficial da Lei Robin Hood (FJP).
 *
 * Só roda no servidor. A ideia é dispensar o download manual do extrato:
 *  1. tenta a API do portal novo (robin-hood.fjp.mg.gov.br), descobrindo as
 *     rotas a partir do próprio bundle da página quando necessário;
 *  2. se o portal novo não responder, cai para o portal histórico
 *     (robin-hood-historico.fjp.mg.gov.br), preenchendo os formulários de
 *     "Índices" e "Transferências" mês a mês.
 *
 * Nada aqui é obrigatório para o usuário: a importação manual continua
 * funcionando quando a FJP estiver fora do ar ou mudar o portal.
 */

import { acharCriterio, normalizarRotulo, MESES } from "./criterios";

export type RegistroColetado = {
  criterio: string;
  mes: number;
  indice: number | null;
  valor: number | null;
};

export type ColetaRobinHood = {
  registros: RegistroColetado[];
  fonte: "portal" | "historico" | null;
  tentativas: string[];
  mesesComDados: number[];
};

const PORTAL = "https://robin-hood.fjp.mg.gov.br";
const HISTORICO_BASES = [
  "https://robin-hood-historico.fjp.mg.gov.br",
  "http://robin-hood-historico.fjp.mg.gov.br",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function baixar(
  url: string,
  init?: { method?: string; corpo?: URLSearchParams; referer?: string },
): Promise<string> {
  let ultimo: unknown = null;
  // o portal da FJP costuma demorar/derrubar a primeira conexão: tenta duas vezes
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resp = await fetch(url, {
        method: init?.method ?? "GET",
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9",
          ...(init?.corpo ? { "content-type": "application/x-www-form-urlencoded" } : {}),
          ...(init?.referer ? { referer: init.referer } : {}),
        },
        ...(init?.corpo ? { body: init.corpo.toString() } : {}),
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const tipo = resp.headers.get("content-type") ?? "";
      if (/charset=(iso-8859-1|windows-1252)/i.test(tipo)) {
        return new TextDecoder("iso-8859-1").decode(bytes);
      }
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return new TextDecoder("iso-8859-1").decode(bytes);
      }
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("sem resposta");
}


function semTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function numeroBr(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s|&nbsp;/g, "").trim();
  if (!limpo || !/[0-9]/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Tabelas HTML                                                        */
/* ------------------------------------------------------------------ */

type Tabela = { cabecalho: string[]; linhas: string[][] };

function tabelas(html: string): Tabela[] {
  const saida: Tabela[] = [];
  for (const m of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const corpo = m[1] ?? "";
    const cabecalho = [...corpo.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((c) =>
      semTags(c[1] ?? ""),
    );
    const linhas: string[][] = [];
    for (const tr of corpo.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celulas = [...(tr[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
        semTags(c[1] ?? ""),
      );
      if (celulas.length) linhas.push(celulas);
    }
    if (linhas.length) saida.push({ cabecalho, linhas });
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* Formulários (portal histórico é CodeIgniter com <form> + <select>)  */
/* ------------------------------------------------------------------ */

type Opcao = { valor: string; rotulo: string };
type Campo = { nome: string; opcoes: Opcao[] };
type Formulario = { action: string; method: string; selects: Campo[]; ocultos: [string, string][] };

function atributo(tag: string, nome: string): string {
  return tag.match(new RegExp(`${nome}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";
}

function formularios(html: string, urlBase: string): Formulario[] {
  const saida: Formulario[] = [];
  for (const m of html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = m[1] ?? "";
    const corpo = m[2] ?? "";
    const selects: Campo[] = [];
    for (const s of corpo.matchAll(/<select([^>]*)>([\s\S]*?)<\/select>/gi)) {
      const nome = atributo(s[1] ?? "", "name");
      if (!nome) continue;
      const opcoes: Opcao[] = [];
      for (const o of (s[2] ?? "").matchAll(/<option([^>]*)>([\s\S]*?)<\/option>/gi)) {
        const rotulo = semTags(o[2] ?? "");
        const bruto = atributo(o[1] ?? "", "value");
        const valor = /value\s*=/i.test(o[1] ?? "") ? bruto : rotulo;
        if (!rotulo && !valor) continue;
        opcoes.push({ valor, rotulo });
      }
      if (opcoes.length) selects.push({ nome, opcoes });
    }
    const ocultos: [string, string][] = [];
    for (const i of corpo.matchAll(/<input([^>]*)>/gi)) {
      const attrsInput = i[1] ?? "";
      const tipo = atributo(attrsInput, "type").toLowerCase();
      const nome = atributo(attrsInput, "name");
      if (!nome) continue;
      if (tipo === "hidden") ocultos.push([nome, atributo(attrsInput, "value")]);
    }
    if (!selects.length) continue;
    const action = atributo(attrs, "action");
    saida.push({
      action: action ? new URL(action, urlBase).toString() : urlBase,
      method: (atributo(attrs, "method") || "post").toUpperCase(),
      selects,
      ocultos,
    });
  }
  return saida;
}

const ehAno = (o: Opcao) => /^(19|20)\d{2}$/.test(o.rotulo.trim());
const ehMes = (o: Opcao) => MESES.some((m) => normalizarRotulo(m) === normalizarRotulo(o.rotulo));

function acharSelect(form: Formulario, pred: (o: Opcao) => boolean): Campo | undefined {
  return form.selects.find((c) => c.opcoes.filter(pred).length >= 2);
}

function opcaoPorRotulo(campo: Campo, alvo: string): Opcao | undefined {
  const chave = normalizarRotulo(alvo);
  return (
    campo.opcoes.find((o) => normalizarRotulo(o.rotulo) === chave) ??
    campo.opcoes.find((o) => normalizarRotulo(o.rotulo).startsWith(chave))
  );
}

/** Preenche e envia o formulário de consulta (ano/mês/município). */
async function enviarFormulario(
  urlPagina: string,
  alvo: { exercicio: number; mes: number; municipio: string },
): Promise<string> {
  const html = await baixar(urlPagina);
  const forms = formularios(html, urlPagina);
  for (const form of forms) {
    const campoAno = acharSelect(form, ehAno);
    if (!campoAno) continue;
    const campoMes = acharSelect(form, ehMes);
    const campoMunicipio = form.selects.find(
      (c) => c !== campoAno && c !== campoMes && !!opcaoPorRotulo(c, alvo.municipio),
    );

    const ano = opcaoPorRotulo(campoAno, String(alvo.exercicio));
    if (!ano) continue;
    const corpo = new URLSearchParams(form.ocultos);
    corpo.set(campoAno.nome, ano.valor);
    if (campoMes) {
      const mes = opcaoPorRotulo(campoMes, MESES[alvo.mes - 1] ?? "");
      if (mes) corpo.set(campoMes.nome, mes.valor);
    }
    if (campoMunicipio) {
      const mun = opcaoPorRotulo(campoMunicipio, alvo.municipio);
      if (mun) corpo.set(campoMunicipio.nome, mun.valor);
    }
    // demais selects ficam no primeiro valor (o portal exige todos preenchidos)
    for (const s of form.selects) {
      if (!corpo.has(s.nome) && s.opcoes[0]) corpo.set(s.nome, s.opcoes[0].valor);
    }

    if (form.method === "GET") {
      const url = new URL(form.action);
      corpo.forEach((v, k) => url.searchParams.set(k, v));
      return baixar(url.toString(), { referer: urlPagina });
    }
    return baixar(form.action, { method: "POST", corpo, referer: urlPagina });
  }
  throw new Error("formulário de consulta não reconhecido");
}

/* ------------------------------------------------------------------ */
/* Leitura das tabelas do portal                                       */
/* ------------------------------------------------------------------ */

/** Tabela "um município por linha, um critério por coluna" (índices do mês). */
function lerTabelaLarga(html: string, municipio: string): RegistroColetado[] | null {
  const alvo = normalizarRotulo(municipio);
  for (const t of tabelas(html)) {
    const colunas = t.cabecalho.map((c) => acharCriterio(c));
    if (colunas.filter(Boolean).length < 3) continue;
    const linha = t.linhas.find((cs) => cs.some((c) => normalizarRotulo(c) === alvo));
    if (!linha) continue;
    const registros: RegistroColetado[] = [];
    colunas.forEach((criterio, i) => {
      if (!criterio) return;
      const indice = numeroBr(linha[i] ?? "");
      if (indice == null) return;
      registros.push({ criterio: criterio.slug, mes: 0, indice, valor: null });
    });
    if (registros.length) return registros;
  }
  return null;
}

/** Tabela "um critério por linha" (extrato/transferências do município). */
function lerTabelaCriterios(html: string): RegistroColetado[] | null {
  for (const t of tabelas(html)) {
    const cab = t.cabecalho.map(normalizarRotulo);
    const colIndice = cab.findIndex((c) => c.includes("indice") || c.includes("coeficiente"));
    const colValor = cab.findIndex(
      (c) => c.includes("valor") || c.includes("repasse") || c.includes("transfer") || c === "r$",
    );
    const registros: RegistroColetado[] = [];
    for (const celulas of t.linhas) {
      const criterio = acharCriterio(celulas[0] ?? "");
      if (!criterio) continue;
      let indice: number | null = colIndice >= 0 ? numeroBr(celulas[colIndice] ?? "") : null;
      let valor: number | null = colValor >= 0 ? numeroBr(celulas[colValor] ?? "") : null;
      if (colIndice < 0 && colValor < 0) {
        // sem cabeçalho útil: índice é fração pequena, valor é o número grande
        const numeros = celulas.slice(1).map(numeroBr).filter((n): n is number => n != null);
        indice = numeros.find((n) => n > 0 && n < 1) ?? null;
        valor = numeros.find((n) => n >= 1) ?? null;
      }
      if (indice == null && valor == null) continue;
      registros.push({ criterio: criterio.slug, mes: 0, indice, valor });
    }
    if (registros.length >= 3) return registros;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Portal novo (API JSON)                                              */
/* ------------------------------------------------------------------ */

function candidatosApi(bundle: string): string[] {
  const rotas = new Set<string>();
  for (const m of bundle.matchAll(/["'`](\/(?:api|rest|services?)\/[A-Za-z0-9_\-/{}$.]*)["'`]/g)) {
    const rota = (m[1] ?? "").replace(/\/$/, "");
    if (rota.length > 4) rotas.add(rota);
  }
  for (const m of bundle.matchAll(/["'`](https?:\/\/[^"'`\s]*fjp\.mg\.gov\.br[^"'`\s]*)["'`]/g)) {
    const url = m[1] ?? "";
    if (/api|rest|serv/i.test(url)) rotas.add(url);
  }
  return [...rotas].slice(0, 40);
}

function lerJsonPortal(json: unknown, mesPadrao: number): RegistroColetado[] {
  const linhas: Record<string, unknown>[] = Array.isArray(json)
    ? (json as Record<string, unknown>[])
    : Array.isArray((json as { dados?: unknown })?.dados)
      ? ((json as { dados: Record<string, unknown>[] }).dados)
      : Array.isArray((json as { content?: unknown })?.content)
        ? ((json as { content: Record<string, unknown>[] }).content)
        : [];
  const registros: RegistroColetado[] = [];
  for (const linha of linhas) {
    if (!linha || typeof linha !== "object") continue;
    const chaves = Object.keys(linha);
    const pega = (frag: string) =>
      chaves.find((k) => normalizarRotulo(k).includes(frag)) ?? "";
    const rotulo = String(linha[pega("criterio") || pega("indicenome") || pega("nome")] ?? "");
    const criterio = acharCriterio(rotulo);
    if (!criterio) continue;
    const num = (chave: string): number | null => {
      if (!chave) return null;
      const bruto = linha[chave];
      if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
      if (typeof bruto === "string") return numeroBr(bruto);
      return null;
    };
    const mesBruto = num(pega("mes"));
    registros.push({
      criterio: criterio.slug,
      mes: mesBruto && mesBruto >= 1 && mesBruto <= 12 ? mesBruto : mesPadrao,
      indice: num(pega("indice")) ?? num(pega("coeficiente")),
      valor: num(pega("valor")) ?? num(pega("repasse")),
    });
  }
  return registros;
}

async function coletarPortalNovo(
  municipio: string,
  codigoIbge: string | null,
  exercicio: number,
  tentativas: string[],
): Promise<RegistroColetado[]> {
  let bundle = "";
  try {
    const home = await baixar(`${PORTAL}/`);
    const scripts = [...home.matchAll(/src="([^"]*static\/js\/[^"]+\.js)"/g)].map((m) => m[1] ?? "");
    for (const src of scripts.slice(0, 3)) {
      bundle += await baixar(new URL(src, PORTAL).toString());
    }
  } catch (e) {
    tentativas.push(`portal novo: ${e instanceof Error ? e.message : "indisponível"}`);
    return [];
  }

  const rotas = candidatosApi(bundle);
  if (!rotas.length) {
    tentativas.push("portal novo: nenhuma rota de dados encontrada na página");
    return [];
  }

  const registros: RegistroColetado[] = [];
  for (const rota of rotas) {
    if (!/indice|criterio|municipio|transfer|repasse/i.test(rota)) continue;
    const url = new URL(rota.startsWith("http") ? rota : `${PORTAL}${rota}`);
    url.searchParams.set("ano", String(exercicio));
    url.searchParams.set("exercicio", String(exercicio));
    if (codigoIbge) url.searchParams.set("municipio", codigoIbge);
    else url.searchParams.set("municipio", municipio);
    try {
      const texto = await baixar(url.toString());
      const json: unknown = JSON.parse(texto);
      const lidos = lerJsonPortal(json, 1);
      if (lidos.length) {
        registros.push(...lidos);
        tentativas.push(`portal novo: ${rota} respondeu ${lidos.length} linhas`);
        break;
      }
    } catch {
      // rota candidata que não serve — segue para a próxima
    }
  }
  if (!registros.length) tentativas.push("portal novo: API não devolveu dados reconhecíveis");
  return registros;
}

/* ------------------------------------------------------------------ */
/* Portal histórico                                                    */
/* ------------------------------------------------------------------ */

async function baseHistoricoDisponivel(tentativas: string[]): Promise<string | null> {
  for (const base of HISTORICO_BASES) {
    try {
      await baixar(`${base}/index.php`);
      return base;
    } catch (e) {
      tentativas.push(`histórico ${base}: ${e instanceof Error ? e.message : "sem resposta"}`);
    }
  }
  return null;
}

async function coletarHistorico(
  municipio: string,
  exercicio: number,
  mesesAlvo: number[],
  tentativas: string[],
): Promise<RegistroColetado[]> {
  const base = await baseHistoricoDisponivel(tentativas);
  if (!base) return [];

  const registros: RegistroColetado[] = [];
  for (const mes of mesesAlvo) {
    const doMes: RegistroColetado[] = [];
    // índices do mês (tabela com todos os municípios)
    for (const pagina of ["/index.php/indices/outrosmeses", "/index.php/indices/mesatual"]) {
      try {
        const html =
          pagina.endsWith("mesatual") && mesesAlvo.length === 1
            ? await baixar(`${base}${pagina}`)
            : await enviarFormulario(`${base}${pagina}`, { exercicio, mes, municipio });
        const lidos = lerTabelaLarga(html, municipio) ?? lerTabelaCriterios(html);
        if (lidos?.length) {
          doMes.push(...lidos.map((r) => ({ ...r, mes })));
          break;
        }
      } catch {
        // tenta a próxima página
      }
    }
    // valores em reais (demonstrativo do município)
    for (const pagina of ["/index.php/transferencias/pesquisamunicipio", "/index.php/extrato"]) {
      try {
        const html = await enviarFormulario(`${base}${pagina}`, { exercicio, mes, municipio });
        const lidos = lerTabelaCriterios(html);
        if (lidos?.length) {
          for (const r of lidos) {
            const existente = doMes.find((x) => x.criterio === r.criterio);
            if (existente) {
              existente.valor = r.valor ?? existente.valor;
              existente.indice = existente.indice ?? r.indice;
            } else {
              doMes.push({ ...r, mes });
            }
          }
          break;
        }
      } catch {
        // segue sem os valores em reais
      }
    }
    if (doMes.length) registros.push(...doMes);
  }

  if (!registros.length) tentativas.push("histórico: consulta não devolveu tabelas com critérios");
  return registros;
}

/* ------------------------------------------------------------------ */
/* Orquestração                                                        */
/* ------------------------------------------------------------------ */

export async function coletarRobinHood(params: {
  municipio: string;
  codigoIbge?: string | null;
  exercicio: number;
  meses?: number[];
}): Promise<ColetaRobinHood> {
  const hoje = new Date();
  const limite =
    params.exercicio < hoje.getUTCFullYear() ? 12 : Math.max(1, hoje.getUTCMonth() + 1);
  const meses = (params.meses?.length ? params.meses : Array.from({ length: limite }, (_, i) => i + 1))
    .filter((m) => m >= 1 && m <= 12);

  const tentativas: string[] = [];

  const doPortal = await coletarPortalNovo(
    params.municipio,
    params.codigoIbge ?? null,
    params.exercicio,
    tentativas,
  );
  let fonte: ColetaRobinHood["fonte"] = doPortal.length ? "portal" : null;
  let registros = doPortal;

  if (!registros.length) {
    registros = await coletarHistorico(params.municipio, params.exercicio, meses, tentativas);
    fonte = registros.length ? "historico" : null;
  }

  // um registro por critério/mês
  const mapa = new Map<string, RegistroColetado>();
  for (const r of registros) {
    const mes = r.mes >= 1 && r.mes <= 12 ? r.mes : 1;
    const chave = `${r.criterio}|${mes}`;
    const atual = mapa.get(chave);
    if (atual) {
      atual.indice = atual.indice ?? r.indice;
      atual.valor = atual.valor ?? r.valor;
    } else {
      mapa.set(chave, { ...r, mes });
    }
  }
  const finais = [...mapa.values()].sort((a, b) => a.mes - b.mes || a.criterio.localeCompare(b.criterio));

  return {
    registros: finais,
    fonte,
    tentativas,
    mesesComDados: [...new Set(finais.map((r) => r.mes))].sort((a, b) => a - b),
  };
}
