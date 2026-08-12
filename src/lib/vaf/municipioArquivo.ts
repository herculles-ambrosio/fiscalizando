import { decodificarArquivo } from "./parser";
import { codigoMunicipioDoArquivo } from "./tipoRetorno";

export type MunicipioArquivo = { codigo: string | null; nome: string | null };

export function normalizarCodigoSef(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const digitos = codigo.replace(/\D/g, "");
  if (!digitos) return null;
  return String(Number(digitos));
}

function primeirasLinhas(texto: string, quantidade = 400): string[] {
  return texto.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, quantidade);
}

/** Código (pos. 3-5) e nome do município (registro 01) do arquivo de retorno. */
export function detectarMunicipioRetorno(texto: string): MunicipioArquivo {
  const linhas = primeirasLinhas(texto);
  const codigo = normalizarCodigoSef(linhas[0]?.slice(2, 5) ?? null);
  const registro01 = linhas.find((l) => l.slice(0, 2) === "01");
  const nome = registro01 ? registro01.slice(124, 154).trim() || null : null;
  return { codigo, nome };
}

/** Código do município do contribuinte (pos. 517-519) no arquivo de ativos. */
export function detectarMunicipioAtivos(texto: string): MunicipioArquivo {
  const linhas = primeirasLinhas(texto);
  const contagem = new Map<string, number>();
  for (const l of linhas) {
    const cod = normalizarCodigoSef(l.slice(516, 519));
    if (cod) contagem.set(cod, (contagem.get(cod) ?? 0) + 1);
  }
  const maisComum = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { codigo: maisComum, nome: null };
}

async function lerInicio(file: File): Promise<string> {
  const pedaco = file.slice(0, 400_000);
  return decodificarArquivo(await pedaco.arrayBuffer());
}

/**
 * Detecta a qual prefeitura os arquivos pertencem, usando o conteúdo
 * (código SEF e nome do município) e, como reserva, o nome do arquivo.
 */
export async function detectarMunicipioDosArquivos(params: {
  ativos?: File | null;
  retorno?: File | null;
}): Promise<MunicipioArquivo> {
  const { ativos, retorno } = params;
  let codigo: string | null = null;
  let nome: string | null = null;

  if (retorno) {
    const info = detectarMunicipioRetorno(await lerInicio(retorno));
    codigo = info.codigo;
    nome = info.nome;
  }
  if (!codigo && ativos) {
    codigo = detectarMunicipioAtivos(await lerInicio(ativos)).codigo;
  }
  if (!codigo) {
    codigo =
      normalizarCodigoSef(retorno ? codigoMunicipioDoArquivo(retorno.name) : null) ??
      normalizarCodigoSef(ativos ? codigoMunicipioDoArquivo(ativos.name) : null);
  }
  return { codigo, nome };
}

export type EvidenciaMunicipio = {
  arquivo: "ativos" | "retorno";
  linha: number;
  registro: string;
  codigo: string;
  trecho: string;
};

export type ConferenciaArquivos = {
  ativos: MunicipioArquivo | null;
  retorno: MunicipioArquivo | null;
  divergente: boolean;
  evidencias: EvidenciaMunicipio[];
};

function evidenciasAtivos(texto: string): EvidenciaMunicipio[] {
  const out: EvidenciaMunicipio[] = [];
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length && out.length < 2000; i++) {
    const l = linhas[i];
    if (!l || !l.trim()) continue;
    const codigo = normalizarCodigoSef(l.slice(516, 519));
    if (!codigo) continue;
    out.push({
      arquivo: "ativos",
      linha: i + 1,
      registro: l.slice(0, 2),
      codigo,
      trecho: l.slice(0, 60).trim(),
    });
  }
  return out;
}

function evidenciasRetorno(texto: string): EvidenciaMunicipio[] {
  const out: EvidenciaMunicipio[] = [];
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length && out.length < 2000; i++) {
    const l = linhas[i];
    if (!l || !l.trim()) continue;
    const codigo = normalizarCodigoSef(l.slice(2, 5));
    if (!codigo) continue;
    out.push({
      arquivo: "retorno",
      linha: i + 1,
      registro: l.slice(0, 2),
      codigo,
      trecho: l.slice(0, 60).trim(),
    });
  }
  return out;
}

/**
 * Compara o município do arquivo de ativos com o do retorno e devolve
 * os registros (linha + trecho) que comprovam a divergência.
 */
export async function conferirMunicipioEntreArquivos(params: {
  ativos?: File | null;
  retorno?: File | null;
}): Promise<ConferenciaArquivos> {
  const { ativos, retorno } = params;
  if (!ativos || !retorno) {
    return { ativos: null, retorno: null, divergente: false, evidencias: [] };
  }
  const [textoAtivos, textoRetorno] = await Promise.all([lerInicio(ativos), lerInicio(retorno)]);
  const infoAtivos = detectarMunicipioAtivos(textoAtivos);
  const infoRetorno = detectarMunicipioRetorno(textoRetorno);

  const codA =
    infoAtivos.codigo ?? normalizarCodigoSef(codigoMunicipioDoArquivo(ativos.name));
  const codR =
    infoRetorno.codigo ?? normalizarCodigoSef(codigoMunicipioDoArquivo(retorno.name));

  const divergente = !!codA && !!codR && codA !== codR;
  if (!divergente) {
    return {
      ativos: { ...infoAtivos, codigo: codA },
      retorno: { ...infoRetorno, codigo: codR },
      divergente: false,
      evidencias: [],
    };
  }

  const evidencias = [
    ...evidenciasAtivos(textoAtivos)
      .filter((e) => e.codigo === codA)
      .slice(0, 3),
    ...evidenciasRetorno(textoRetorno)
      .filter((e) => e.codigo === codR)
      .slice(0, 3),
  ];

  return {
    ativos: { ...infoAtivos, codigo: codA },
    retorno: { ...infoRetorno, codigo: codR },
    divergente: true,
    evidencias,
  };
}
