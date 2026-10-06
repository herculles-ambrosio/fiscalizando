import { Unzip, UnzipInflate } from "fflate";

/** Linha do arquivo "Estabelecimentos" dos dados abertos do CNPJ (layout oficial da Receita). */
export type EstabelecimentoBase = {
  cnpj: string;
  nome_fantasia: string | null;
  situacao: string;
  situacao_data: string | null;
  data_inicio: string | null;
  cnae_principal: string | null;
  cnaes_secundarios: string[];
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
};

const SITUACAO: Record<string, string> = { "01": "NULA", "02": "ATIVA", "03": "SUSPENSA", "04": "INAPTA", "08": "BAIXADA" };

function campos(linha: string): string[] {
  // Layout: campos entre aspas separados por ";"
  const t = linha.trim();
  return t.slice(1, t.endsWith('"') ? -1 : undefined).split('";"');
}
const v = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const d = (s: string | undefined) =>
  s && /^\d{8}$/.test(s) && s !== "00000000" ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;

function converter(c: string[]): EstabelecimentoBase {
  const tel = [c[21] && c[22] ? `${c[21]}${c[22]}` : "", c[23] && c[24] ? `${c[23]}${c[24]}` : ""]
    .filter(Boolean)
    .join(" / ");
  const tipo = v(c[13]);
  const log = v(c[14]);
  return {
    cnpj: `${c[0]}${c[1]}${c[2]}`,
    nome_fantasia: v(c[4]),
    situacao: SITUACAO[c[5] ?? ""] ?? "DESCONHECIDA",
    situacao_data: d(c[6]),
    data_inicio: d(c[10]),
    cnae_principal: v(c[11]),
    cnaes_secundarios: (c[12] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    logradouro: log ? (tipo ? `${tipo} ${log}` : log) : null,
    numero: v(c[15]),
    complemento: v(c[16]),
    bairro: v(c[17]),
    cep: v(c[18]),
    uf: v(c[19]),
    telefone: tel || null,
    email: v(c[27])?.toLowerCase() ?? null,
  };
}

/** Lê o arquivo Municipios(.zip/.csv) da Receita e devolve código → nome. */
export async function lerMunicipiosReceita(arquivo: File): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  await lerLinhas(arquivo, (l) => {
    const c = campos(l);
    if (c[0] && c[1]) mapa.set(c[0], c[1]);
  });
  return mapa;
}

/**
 * Lê um arquivo de Estabelecimentos (zip ou csv) em fluxo, guardando apenas as
 * linhas do município (código da Receita). Nada é carregado inteiro na memória.
 */
export async function filtrarEstabelecimentos(
  arquivo: File,
  codigoMunicipio: string,
  aoProgredir: (lidos: number, total: number, achados: number) => void,
): Promise<EstabelecimentoBase[]> {
  const achados: EstabelecimentoBase[] = [];
  const marca = `";"MG";"${codigoMunicipio}";"`;
  await lerLinhas(
    arquivo,
    (l) => {
      if (!l.includes(marca)) return;
      const c = campos(l);
      if (c[20] === codigoMunicipio) achados.push(converter(c));
    },
    (lidos) => aoProgredir(lidos, arquivo.size, achados.length),
  );
  return achados;
}

async function lerLinhas(arquivo: File, aoLer: (linha: string) => void, aoProgredir?: (lidos: number) => void) {
  const decod = new TextDecoder("latin1");
  let resto = "";
  const consumir = (bytes: Uint8Array, fim: boolean) => {
    const texto = resto + decod.decode(bytes, { stream: !fim });
    const linhas = texto.split("\n");
    resto = fim ? "" : (linhas.pop() ?? "");
    for (const l of linhas) if (l) aoLer(l);
  };

  const ehZip = /\.zip$/i.test(arquivo.name);
  const leitor = arquivo.stream().getReader();
  let lidos = 0;
  if (!ehZip) {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      lidos += value.length;
      consumir(value, false);
      aoProgredir?.(lidos);
    }
    consumir(new Uint8Array(), true);
    return;
  }

  let concluido = false;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    f.ondata = (err, dados, final) => {
      if (err) throw err;
      consumir(dados, final);
      if (final) concluido = true;
    };
    f.start();
  };
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) {
      unzip.push(new Uint8Array(), true);
      break;
    }
    lidos += value.length;
    // fatia para não travar a tela em blocos grandes
    for (let i = 0; i < value.length; i += 1 << 20) unzip.push(value.subarray(i, i + (1 << 20)));
    aoProgredir?.(lidos);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!concluido) consumir(new Uint8Array(), true);
}
