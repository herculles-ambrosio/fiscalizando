/**
 * Consulta automática da "Lista de serventias" no Portal da Transparência do
 * TJMG. O painel é um Qlik Sense público (sem login): abrimos uma sessão
 * anônima, aplicamos os filtros de Mês/Ano e Comarca no estado alternativo
 * "Transparencia" e lemos a tabela inteira pela Engine API.
 */

const HOST = "https://qlik.tjmg.jus.br";
const APP = "a3afcb99-eb94-458d-bb08-2e5a4b1cb34e";
const OBJETO_TABELA = "bGqNC";
const ESTADO = "Transparencia";
const CAMPO_MES = "Mês/Ano";
const CAMPO_COMARCA = "Nome da Comarca";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Sessao = { cookies: string; token: string };

function xrfkey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function abrirSessao(): Promise<Sessao> {
  const inicial = await fetch(`${HOST}/single/?appid=${APP}`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  const bruto = (
    typeof inicial.headers.getSetCookie === "function"
      ? inicial.headers.getSetCookie()
      : [inicial.headers.get("set-cookie") ?? ""]
  ).filter(Boolean);
  const cookies = bruto
    .flatMap((c) => c.split(/,(?=[^;]+=)/))
    .map((c) => c.split(";")[0]!.trim())
    .filter((c) => /^(X-Qlik-Session|BIGipServerpool_qlik)=/i.test(c))
    .join("; ");
  if (!cookies) throw new Error("O portal do TJMG não abriu uma sessão de consulta.");

  const chave = xrfkey();
  const resp = await fetch(`${HOST}/qps/csrftoken?xrfkey=${chave}`, {
    headers: { "User-Agent": UA, Cookie: cookies, "X-Qlik-Xrfkey": chave },
  });
  const token = resp.headers.get("qlik-csrf-token");
  if (!token) throw new Error("O portal do TJMG não liberou o token de consulta.");
  return { cookies, token };
}

type SocketLike = {
  send(data: string): void;
  close(): void;
  addEventListener(tipo: string, ouvinte: (evento: { data?: unknown }) => void): void;
};

async function abrirSocket(sessao: Sessao): Promise<SocketLike> {
  const url = `${HOST}/app/${APP}?qlik-csrf-token=${encodeURIComponent(sessao.token)}`;
  const cabecalhos = {
    "User-Agent": UA,
    Cookie: sessao.cookies,
    Origin: HOST,
    Upgrade: "websocket",
    Connection: "Upgrade",
  };
  // Cloudflare Workers: WebSocket de saída é obtido pelo fetch com Upgrade.
  try {
    const resposta = await fetch(url, { headers: cabecalhos });
    const ws = (resposta as unknown as { webSocket?: SocketLike & { accept(): void } }).webSocket;
    if (ws) {
      ws.accept();
      return ws;
    }
  } catch {
    // ambiente sem suporte a upgrade via fetch — usa o construtor abaixo
  }
  const Ctor = globalThis.WebSocket as unknown as new (
    endereco: string,
    opcoes?: unknown,
  ) => SocketLike & { readyState: number };
  const ws = new Ctor(url.replace(/^https/, "wss"), {
    headers: { "User-Agent": UA, Cookie: sessao.cookies, Origin: HOST },
  });
  await new Promise<void>((ok, falhou) => {
    if (ws.readyState === 1) return ok();
    ws.addEventListener("open", () => ok());
    ws.addEventListener("error", () => falhou(new Error("Conexão recusada pelo portal do TJMG.")));
  });
  return ws;
}

type Resposta = { id?: number; result?: unknown; error?: { message?: string } };

class Engine {
  private id = 0;
  private pendentes = new Map<number, (r: Resposta) => void>();

  constructor(private ws: SocketLike) {
    ws.addEventListener("message", (evento) => {
      let dados: Resposta;
      try {
        dados = JSON.parse(String(evento.data));
      } catch {
        return;
      }
      if (dados.id && this.pendentes.has(dados.id)) {
        this.pendentes.get(dados.id)!(dados);
        this.pendentes.delete(dados.id);
      }
    });
  }

  chamar<T = any>(metodo: string, handle: number, params: unknown[]): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((ok, falhou) => {
      const relogio = setTimeout(() => {
        this.pendentes.delete(id);
        falhou(new Error(`O portal do TJMG demorou para responder (${metodo}).`));
      }, 45_000);
      this.pendentes.set(id, (r) => {
        clearTimeout(relogio);
        if (r.error) falhou(new Error(r.error.message ?? "Erro no painel do TJMG."));
        else ok(r.result as T);
      });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: metodo, handle, params }));
    });
  }

  fechar() {
    try {
      this.ws.close();
    } catch {
      /* ignora */
    }
  }
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function conectar() {
  const sessao = await abrirSessao();
  const engine = new Engine(await abrirSocket(sessao));
  const doc = (await engine.chamar("OpenDoc", -1, [APP])).qReturn.qHandle as number;
  return { engine, doc };
}

/** Lista de valores de um campo, no estado do painel. */
async function valoresDoCampo(engine: Engine, doc: number, campo: string) {
  const lb = (
    await engine.chamar("CreateSessionObject", doc, [
      {
        qInfo: { qType: "lb" },
        qListObjectDef: {
          qStateName: ESTADO,
          qDef: { qFieldDefs: [campo] },
          qInitialDataFetch: [{ qTop: 0, qLeft: 0, qWidth: 1, qHeight: 1000 }],
        },
      },
    ])
  ).qReturn.qHandle as number;
  const layout = (await engine.chamar("GetLayout", lb, [])).qLayout.qListObject;
  const linhas = (layout.qDataPages?.[0]?.qMatrix ?? []) as { qText: string; qElemNumber: number }[][];
  return {
    handle: lb,
    valores: linhas.map((l) => ({ texto: l[0]!.qText, elem: l[0]!.qElemNumber })),
  };
}

/** Competências (Mês/Ano) disponíveis hoje no painel, da mais recente para a mais antiga. */
export async function listarCompetenciasTjmg(): Promise<string[]> {
  const { engine, doc } = await conectar();
  try {
    const { valores } = await valoresDoCampo(engine, doc, CAMPO_MES);
    return valores
      .map((v) => v.texto)
      .filter((t) => /^\d{1,2}\/\d{4}$/.test(t))
      .sort((a, b) => {
        const [ma, aa] = a.split("/").map(Number) as [number, number];
        const [mb, ab] = b.split("/").map(Number) as [number, number];
        return ab - aa || mb - ma;
      });
  } finally {
    engine.fechar();
  }
}

export type ServentiaTjmg = {
  nome: string;
  cns: string;
  comarca: string;
  status: string;
  emolumentos: number;
  recompe: number;
  tfj: number;
  despesa: number;
};

/** "Registro de Imóveis de Dom Silvério" contém "Dom Silvério"? (sem acento/caixa) */
function nomeCitaMunicipio(nome: string, municipio: string): boolean {
  const limpar = (t: string) =>
    ` ${t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()} `;
  return limpar(nome).includes(limpar(municipio));
}

/**
 * Baixa a lista de serventias já filtrada por mês/ano.
 *
 * Quando o município é sede de comarca, filtra pela comarca no próprio painel.
 * Quando não é (ex.: Dom Silvério pertence à comarca de Alvinópolis), traz a
 * lista do estado e seleciona as serventias cujo nome cita o município.
 */
export async function baixarServentiasTjmg(opcoes: {
  mesAno: string;
  /** município da prefeitura ativa; nulo traz o estado inteiro */
  municipio?: string | null;
}): Promise<{
  competencia: string;
  comarca: string | null;
  filtro: "comarca" | "nome" | "estado";
  linhas: ServentiaTjmg[];
}> {
  const { engine, doc } = await conectar();
  try {
    const meses = await valoresDoCampo(engine, doc, CAMPO_MES);
    const mes = meses.valores.find((v) => v.texto === opcoes.mesAno);
    if (!mes)
      throw new Error(
        `O portal do TJMG não tem dados de ${opcoes.mesAno}. Competências disponíveis: ${meses.valores
          .map((v) => v.texto)
          .join(", ")}.`,
      );
    await engine.chamar("SelectListObjectValues", meses.handle, [
      "/qListObjectDef",
      [mes.elem],
      false,
    ]);

    let comarcaEscolhida: string | null = null;
    let filtro: "comarca" | "nome" | "estado" = "estado";
    if (opcoes.municipio) {
      const comarcas = await valoresDoCampo(engine, doc, CAMPO_COMARCA);
      const alvo = normalizar(opcoes.municipio);
      const achada = comarcas.valores.find((v) => normalizar(v.texto) === alvo);
      if (achada) {
        await engine.chamar("SelectListObjectValues", comarcas.handle, [
          "/qListObjectDef",
          [achada.elem],
          false,
        ]);
        comarcaEscolhida = achada.texto;
        filtro = "comarca";
      } else {
        // município não é sede de comarca: filtramos pelo nome da serventia
        filtro = "nome";
      }
    }


    const objeto = (await engine.chamar("GetObject", doc, [OBJETO_TABELA])).qReturn
      .qHandle as number;
    const layout = (await engine.chamar("GetLayout", objeto, [])).qLayout;
    const cubo = layout.qHyperCube;
    const largura: number = cubo.qSize?.qcx ?? 0;
    const altura: number = cubo.qSize?.qcy ?? 0;
    if (!largura || !altura)
      throw new Error(
        cubo.qCalcCondMsg ||
          "O painel do TJMG não devolveu linhas para os filtros escolhidos.",
      );

    const linhas: ServentiaTjmg[] = [];
    const passo = Math.max(1, Math.floor(9000 / largura));
    for (let topo = 0; topo < altura; topo += passo) {
      const pagina = await engine.chamar("GetHyperCubeData", objeto, [
        "/qHyperCubeDef",
        [{ qTop: topo, qLeft: 0, qWidth: largura, qHeight: Math.min(passo, altura - topo) }],
      ]);
      const matriz = (pagina.qDataPages?.[0]?.qMatrix ?? []) as {
        qText: string;
        qNum: number | string;
      }[][];
      for (const linha of matriz) {
        const num = (i: number) => {
          const v = linha[i]?.qNum;
          return typeof v === "number" && Number.isFinite(v) ? v : 0;
        };
        const nome = (linha[0]?.qText ?? "").trim();
        const cns = (linha[1]?.qText ?? "").trim();
        if (!nome || !cns) continue;
        linhas.push({
          nome,
          cns,
          comarca: (linha[2]?.qText ?? "").trim(),
          status: (linha[3]?.qText ?? "").trim(),
          emolumentos: num(4),
          recompe: num(5),
          tfj: num(6),
          despesa: num(7),
        });
      }
    }

    return { competencia: opcoes.mesAno, comarca: comarcaEscolhida, linhas };
  } finally {
    engine.fechar();
  }
}
