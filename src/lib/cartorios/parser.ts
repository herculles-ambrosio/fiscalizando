/**
 * Leitura das planilhas do módulo Fiscaliza Cartório.
 *
 * Duas origens:
 *  - lista de serventias exportada do Portal da Transparência do TJMG
 *    (colunas Nome da Serventia, Código CNS, Comarca, Tipo de Serviço, Status,
 *    Emolumentos (DAP), Recompe (DAP), TFJ (DAP), Despesa);
 *  - relação do sistema de ISS da prefeitura com o que cada cartório declarou.
 *
 * Aceita CSV (separador ; ou ,) e Excel (.xlsx/.xls).
 */

export type LinhaEmolumento = {
  cns: string;
  nome: string;
  comarca: string | null;
  municipio: string | null;
  tipoServico: string;
  status: string | null;
  emolumentos: number;
  recompe: number;
  tfj: number;
  despesa: number;
  outrasReceitas: number;
  mes: number | null;
  ano: number | null;
};


export type LinhaDeclaracao = {
  cns: string;
  nome: string | null;
  municipio: string | null;
  tipoServico: string;
  baseDeclarada: number;
  issDeclarado: number;
  issPago: number;
  mes: number | null;
  ano: number | null;
};


export type ResultadoLeitura<T> = {
  linhas: T[];
  colunasIgnoradas: string[];
  competencia: { mes: number; ano: number } | null;
};

/** Texto sem acento, minúsculo e sem pontuação — para comparar cabeçalhos. */
export function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** "R$ 58.782,62" → 58782.62 ; "1,234.56" → 1234.56 */
export function numeroBr(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (typeof valor !== "string") return 0;
  const limpo = valor.replace(/R\$|\s|\u00a0/g, "").trim();
  if (!limpo || /^-+$/.test(limpo)) return 0;
  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");
  let normal = limpo;
  if (temVirgula && temPonto) normal = limpo.replace(/\./g, "").replace(",", ".");
  else if (temVirgula) normal = limpo.replace(",", ".");
  const n = Number(normal.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** "6/2024", "06/2024", "jun/2024", "2024-06" → { mes, ano } */
export function lerCompetencia(texto: string): { mes: number; ano: number } | null {
  const t = texto.trim();
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  let m = /^(\d{1,2})\s*[\/\-.]\s*(\d{4})$/.exec(t);
  if (m) return { mes: Number(m[1]), ano: Number(m[2]) };
  m = /^(\d{4})\s*[\/\-.]\s*(\d{1,2})$/.exec(t);
  if (m) return { mes: Number(m[2]), ano: Number(m[1]) };
  m = /^([a-zA-Zçãé]{3,})\s*[\/\-. ]\s*(\d{4})$/.exec(t);
  if (m) {
    const i = meses.indexOf(chave(m[1]!).slice(0, 3));
    if (i >= 0) return { mes: i + 1, ano: Number(m[2]) };
  }
  return null;
}

function linhaCsv(linha: string, sep: string): string[] {
  const celulas: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      celulas.push(atual);
      atual = "";
    } else atual += c;
  }
  celulas.push(atual);
  return celulas.map((c) => c.trim());
}

/** Converte o arquivo enviado em uma matriz de células. */
export async function lerMatriz(arquivo: File): Promise<unknown[][]> {
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
    const linhas: unknown[][] = [];
    for (const aba of wb.SheetNames) {
      const dados = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba]!, { header: 1, raw: true });
      for (const l of dados) if (Array.isArray(l)) linhas.push(l);
    }
    return linhas;
  }
  const texto = await arquivo.text();
  const primeira = texto.split(/\r?\n/).find((l) => l.trim().length) ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  return texto
    .split(/\r?\n/)
    .filter((l) => l.trim().length)
    .map((l) => linhaCsv(l, sep));
}

/** Acha a linha de cabeçalho procurando as palavras esperadas. */
function acharCabecalho(matriz: unknown[][], esperados: string[][]): number {
  for (let i = 0; i < Math.min(matriz.length, 40); i++) {
    const celulas = matriz[i]!.map((c) => chave(String(c ?? "")));
    const achou = esperados.filter((grupo) =>
      celulas.some((c) => grupo.some((termo) => c.includes(termo))),
    );
    if (achou.length >= 2) return i;
  }
  return -1;
}

function indicePor(cabecalho: string[], termos: string[]): number {
  return cabecalho.findIndex((c) => termos.some((t) => c.includes(t)));
}

/** Procura "Município: Abre Campo" nas linhas impressas acima da tabela. */
function municipioNoTopo(matriz: unknown[][], ateLinha: number): string | null {
  for (let i = 0; i < ateLinha; i++) {
    for (const celula of matriz[i] ?? []) {
      const texto = String(celula ?? "").trim();
      const m = /(?:munic[ií]pio|cidade|comarca)\s*[:\-]\s*(.+)$/i.exec(texto);
      const achado = m?.[1]?.trim();
      if (achado && achado.length > 2) return achado;
    }
  }
  return null;
}

export type ConferenciaMunicipio = {
  /** true quando o arquivo bate com a prefeitura ativa ou não traz essa informação. */
  ok: boolean;
  /** de onde veio a informação usada na conferência */
  base: "municipio" | "comarca" | "indefinido";
  /** nomes de município/comarca encontrados no arquivo */
  encontrados: string[];
};

/**
 * Confere se a planilha enviada é da prefeitura selecionada.
 * Usa a coluna de município quando existe; senão, a comarca (que pode abranger
 * cidades vizinhas, por isso a tela permite confirmar manualmente nesse caso).
 */
export function conferirMunicipio(
  linhas: { municipio?: string | null; comarca?: string | null }[],
  nomeAtivo: string | null | undefined,
): ConferenciaMunicipio {
  if (!nomeAtivo) return { ok: true, base: "indefinido", encontrados: [] };
  const alvo = chave(nomeAtivo);

  const juntar = (campo: "municipio" | "comarca") => {
    const nomes = new Set<string>();
    for (const l of linhas) {
      const v = (l[campo] ?? "").toString().trim();
      if (v) nomes.add(v);
    }
    return [...nomes];
  };

  const municipios = juntar("municipio");
  if (municipios.length) {
    return {
      ok: municipios.some((n) => chave(n) === alvo),
      base: "municipio",
      encontrados: municipios,
    };
  }

  const comarcas = juntar("comarca");
  if (comarcas.length) {
    return { ok: comarcas.some((n) => chave(n) === alvo), base: "comarca", encontrados: comarcas };
  }

  return { ok: true, base: "indefinido", encontrados: [] };
}



/** Lista de serventias do portal do TJMG. */
export async function lerEmolumentos(arquivo: File): Promise<ResultadoLeitura<LinhaEmolumento>> {
  const matriz = await lerMatriz(arquivo);
  const iCab = acharCabecalho(matriz, [["serventia", "nomedaserventia"], ["cns"], ["emolumento"]]);
  if (iCab < 0)
    throw new Error(
      "Não encontrei as colunas da lista de serventias (nome, CNS e emolumentos). Confira o arquivo exportado do portal.",
    );

  const cabecalho = matriz[iCab]!.map((c) => chave(String(c ?? "")));
  const idx = {
    nome: indicePor(cabecalho, ["nomedaserventia", "serventia", "cartorio"]),
    cns: indicePor(cabecalho, ["codigocns", "cns"]),
    comarca: indicePor(cabecalho, ["comarca"]),
    municipio: indicePor(cabecalho, ["municipio", "cidade"]),

    tipo: indicePor(cabecalho, ["tipodeservico", "tiposervico"]),
    status: indicePor(cabecalho, ["status", "situacao"]),
    emolumentos: indicePor(cabecalho, ["emolumento"]),
    recompe: indicePor(cabecalho, ["recompe"]),
    tfj: indicePor(cabecalho, ["tfj"]),
    despesa: indicePor(cabecalho, ["despesa"]),
    outras: indicePor(cabecalho, ["outrasreceitas", "outrareceita"]),
    competencia: indicePor(cabecalho, ["mesano", "competencia", "periodo"]),
  };

  const usados = new Set(Object.values(idx).filter((i) => i >= 0));
  const colunasIgnoradas = matriz[iCab]!
    .map((c, i) => (usados.has(i) ? null : String(c ?? "").trim()))
    .filter((c): c is string => !!c);

  let competencia: { mes: number; ano: number } | null = null;
  // O portal costuma imprimir "Transparência: 6/2024" acima da tabela.
  for (let i = 0; i < iCab; i++) {
    for (const celula of matriz[i]!) {
      const achado = lerCompetencia(String(celula ?? "").replace(/.*:\s*/, ""));
      if (achado) competencia = achado;
    }
  }

  const municipioTopo = municipioNoTopo(matriz, iCab);


  const linhas: LinhaEmolumento[] = [];
  for (let i = iCab + 1; i < matriz.length; i++) {
    const linha = matriz[i]!;
    const nome = String(linha[idx.nome] ?? "").trim();
    const cns = String(linha[idx.cns] ?? "").trim();
    if (!nome || chave(nome) === "totais" || chave(nome) === "total") continue;
    if (!cns) continue;
    const comp =
      idx.competencia >= 0 ? lerCompetencia(String(linha[idx.competencia] ?? "")) : null;
    linhas.push({
      cns,
      nome,
      comarca: idx.comarca >= 0 ? String(linha[idx.comarca] ?? "").trim() || null : null,
      municipio:
        idx.municipio >= 0 ? String(linha[idx.municipio] ?? "").trim() || null : municipioTopo,

      tipoServico: idx.tipo >= 0 ? String(linha[idx.tipo] ?? "").trim() : "",
      status: idx.status >= 0 ? String(linha[idx.status] ?? "").trim() || null : null,
      emolumentos: numeroBr(linha[idx.emolumentos]),
      recompe: idx.recompe >= 0 ? numeroBr(linha[idx.recompe]) : 0,
      tfj: idx.tfj >= 0 ? numeroBr(linha[idx.tfj]) : 0,
      despesa: idx.despesa >= 0 ? numeroBr(linha[idx.despesa]) : 0,
      outrasReceitas: idx.outras >= 0 ? numeroBr(linha[idx.outras]) : 0,
      mes: comp?.mes ?? competencia?.mes ?? null,
      ano: comp?.ano ?? competencia?.ano ?? null,
    });
  }

  if (!linhas.length) throw new Error("Nenhum cartório foi encontrado no arquivo.");
  return { linhas, colunasIgnoradas, competencia };
}

/** Planilha do sistema de ISS da prefeitura (o que o cartório declarou). */
export async function lerDeclaracoes(arquivo: File): Promise<ResultadoLeitura<LinhaDeclaracao>> {
  const matriz = await lerMatriz(arquivo);
  const iCab = acharCabecalho(matriz, [["cns", "serventia", "cartorio"], ["base", "valor", "iss"]]);
  if (iCab < 0)
    throw new Error(
      "Não encontrei as colunas da planilha de declarações (cartório/CNS e base ou ISS).",
    );

  const cabecalho = matriz[iCab]!.map((c) => chave(String(c ?? "")));
  const idx = {
    cns: indicePor(cabecalho, ["codigocns", "cns"]),
    nome: indicePor(cabecalho, ["serventia", "cartorio", "razaosocial", "nome"]),
    tipo: indicePor(cabecalho, ["tipodeservico", "tiposervico"]),
    base: indicePor(cabecalho, ["basedecalculo", "basedeclarada", "base", "receita", "faturamento"]),
    issDeclarado: indicePor(cabecalho, ["issdeclarado", "issdevido", "valoriss", "iss"]),
    issPago: indicePor(cabecalho, ["isspago", "recolhido", "pago"]),
    municipio: indicePor(cabecalho, ["municipio", "cidade"]),
    competencia: indicePor(cabecalho, ["mesano", "competencia", "periodo"]),

  };
  if (idx.cns < 0 && idx.nome < 0)
    throw new Error("A planilha precisa ter a coluna do CNS ou do nome do cartório.");

  const usados = new Set(Object.values(idx).filter((i) => i >= 0));
  const colunasIgnoradas = matriz[iCab]!
    .map((c, i) => (usados.has(i) ? null : String(c ?? "").trim()))
    .filter((c): c is string => !!c);

  const linhas: LinhaDeclaracao[] = [];
  for (let i = iCab + 1; i < matriz.length; i++) {
    const linha = matriz[i]!;
    const cns = idx.cns >= 0 ? String(linha[idx.cns] ?? "").trim() : "";
    const nome = idx.nome >= 0 ? String(linha[idx.nome] ?? "").trim() : "";
    if (!cns && !nome) continue;
    if (chave(nome) === "total" || chave(nome) === "totais") continue;
    const comp =
      idx.competencia >= 0 ? lerCompetencia(String(linha[idx.competencia] ?? "")) : null;
    linhas.push({
      cns: cns || nome,
      nome: nome || null,
      tipoServico: idx.tipo >= 0 ? String(linha[idx.tipo] ?? "").trim() : "",
      baseDeclarada: idx.base >= 0 ? numeroBr(linha[idx.base]) : 0,
      issDeclarado: idx.issDeclarado >= 0 ? numeroBr(linha[idx.issDeclarado]) : 0,
      issPago: idx.issPago >= 0 ? numeroBr(linha[idx.issPago]) : 0,
      mes: comp?.mes ?? null,
      ano: comp?.ano ?? null,
    });
  }
  if (!linhas.length) throw new Error("Nenhuma declaração foi encontrada no arquivo.");
  return { linhas, colunasIgnoradas, competencia: null };
}

export const MESES_NOME = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
