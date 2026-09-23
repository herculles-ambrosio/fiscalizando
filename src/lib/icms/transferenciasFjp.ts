/**
 * Leitura da tabela "Transferências de <ano>" do portal da FJP.
 *
 * O usuário copia a tabela do portal (ou o CSV baixado) e daqui saem os
 * valores mensais da transferência líquida, dos 75% repassados pelo VAF
 * (a "bolada" que é rateada pelos índices) e dos 25% da Lei Robin Hood.
 */

export type MesEstado = {
  /** 1 = janeiro */
  mes: number;
  transferenciaLiquida: number | null;
  vaf75: number | null;
  robinHood25: number | null;
};

export type LeituraTransferencias = {
  meses: MesEstado[];
  /** exercício lido do título, quando presente */
  exercicio: number | null;
  /** quantos meses vieram com o valor do VAF */
  mesesComVaf: number;
};

/** Converte "1.083.066.222,00" em 1083066222. */
export function numeroPtBr(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo || !/^-?\d+(\.\d+)?$/.test(limpo)) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

/** Extrai até 12 números de uma linha da tabela. */
function valoresDaLinha(linha: string): (number | null)[] {
  const achados = linha.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g) ?? [];
  return achados.slice(0, 12).map((t) => numeroPtBr(t));
}

function vazio(): MesEstado[] {
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    transferenciaLiquida: null,
    vaf75: null,
    robinHood25: null,
  }));
}

export function lerTransferencias(texto: string): LeituraTransferencias {
  const meses = vazio();
  let exercicio: number | null = null;

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const chave = semAcento(linha);

    if (exercicio == null && chave.includes("TRANSFERENCIAS DE")) {
      const ano = linha.match(/(20\d{2})/);
      if (ano) exercicio = Number(ano[1]);
    }

    const valores = valoresDaLinha(linha);
    if (!valores.length) continue;

    const aplicar = (campo: keyof Omit<MesEstado, "mes">) => {
      valores.forEach((v, i) => {
        if (v != null) meses[i]![campo] = v;
      });
    };

    if (chave.includes("REPASSADO PELO VAF")) aplicar("vaf75");
    else if (chave.includes("ROBIN HOOD")) aplicar("robinHood25");
    else if (chave.includes("TRANSFERENCIA LIQUIDA")) aplicar("transferenciaLiquida");
  }

  return {
    meses,
    exercicio,
    mesesComVaf: meses.filter((m) => m.vaf75 != null).length,
  };
}
