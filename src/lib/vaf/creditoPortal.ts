import { decodificarArquivo } from "./parser";

/**
 * Relatório de créditos do Portal do VAF (CSV com separador ";").
 *
 * Regras de leitura confirmadas com o relatório da SEF-MG:
 * - só compõem a base as linhas com `vlrNotaEntraVafb = ENTRA`;
 * - `tipoCredito` classifica entre "Crédito Interno" e "Crédito próprio";
 * - `creditoProprioPara` / `creditoPara` trazem o código SEF do município
 *   beneficiado — usamos para descartar notas de outro município;
 * - o valor considerado é `valorProduto` (o frete é informado à parte).
 */

export type NotaCredito = {
  tipoNota: string;
  numero: string;
  data: string | null;
  remetente: string;
  /** Nome/razão social do remetente, quando a planilha traz a coluna. */
  remetenteNome: string | null;
  municipioRemetente: string;
  destinatario: string;
  municipioDestinatario: string;
  descricao: string;
  valor: number;
};

export type ProdutoresPortal = {
  arquivoNome: string;
  anoBase: number | null;
  /** IE normalizada -> nome do produtor */
  nomes: Map<string, string>;
  total: number;
};

export type ResumoCreditoPortal = {
  arquivoNome: string;
  anoBase: number | null;
  codigoMunicipio: string;
  /** ENTRA + Crédito próprio, do município ativo */
  creditoProprio: number;
  /** ENTRA + Crédito Interno, do município ativo (apenas conferência) */
  creditoInterno: number;
  /** linhas NÃO ENTRA (fora da base de cálculo) */
  naoEntra: number;
  /** frete das notas de crédito próprio (não entra na soma) */
  frete: number;
  totalNotasProprio: number;
  porTipoNota: { tipo: string; quantidade: number; valor: number }[];
  notas: NotaCredito[];
  /** notas de crédito próprio ENTRA cujo município beneficiado é outro */
  ignoradasOutroMunicipio: number;
  valorIgnoradoOutroMunicipio: number;
  /** relatório de produtores rurais cruzado pela IE, quando enviado */
  produtores?: {
    arquivoNome: string;
    anoBase: number | null;
    total: number;
    /** notas de crédito próprio que ganharam nome pelo cruzamento */
    notasIdentificadas: number;
  };
};


function numeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  const limpo = valor.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function limparCampo(valor: string | undefined): string {
  // o portal exporta identificadores como ="0013623450189"
  return (valor ?? "").replace(/^="?/, "").replace(/"$/, "").trim();
}

function separarCsv(texto: string): string[][] {
  return texto
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split(";"));
}

const COLUNAS_OBRIGATORIAS = ["vlrNotaEntraVafb", "tipoCredito", "valorProduto"];

export function lerCreditoPortal(
  buffer: ArrayBuffer,
  arquivoNome: string,
  codigoMunicipio: string,
): ResumoCreditoPortal {
  const texto = decodificarArquivo(buffer).replace(/^\uFEFF/, "");
  const linhas = separarCsv(texto);
  const cabecalho = (linhas[0] ?? []).map((c) => c.replace(/^\uFEFF/, "").trim());
  const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !cabecalho.includes(c));
  if (faltando.length > 0) {
    throw new Error(
      `Este CSV não parece ser o relatório de créditos do Portal do VAF (colunas ausentes: ${faltando.join(", ")}).`,
    );
  }

  const idx = (nome: string) => cabecalho.indexOf(nome);
  const iEntra = idx("vlrNotaEntraVafb");
  const iTipo = idx("tipoCredito");
  const iValor = idx("valorProduto");
  const iProprioPara = idx("creditoProprioPara");
  const iCreditoPara = idx("creditoPara");
  const iFrete = idx("vlrFrete");
  const iAno = idx("anoBase");
  /**
   * O Portal do VAF varia o nome da coluna com o nome/razão social do
   * remetente entre versões do relatório — procuramos qualquer variação.
   */
  const iRemetenteNome = cabecalho.findIndex((c) =>
    /^(nome|razao|razão)(social)?remetente$|^remetente(nome|razaosocial)$|^(nome|razaosocial)_?remetente$/i.test(
      c.replace(/\s+/g, ""),
    ),
  );
  const alvo = String(codigoMunicipio ?? "").replace(/^0+/, "");

  let creditoProprio = 0;
  let creditoInterno = 0;
  let naoEntra = 0;
  let frete = 0;
  let ignoradas = 0;
  let valorIgnorado = 0;
  const anos = new Map<number, number>();
  const porTipo = new Map<string, { tipo: string; quantidade: number; valor: number }>();
  const notas: NotaCredito[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i]!;
    const entra = (c[iEntra] ?? "").trim().toUpperCase();
    const tipoCredito = (c[iTipo] ?? "").trim().toLowerCase();
    if (entra !== "ENTRA" && entra !== "NÃO ENTRA" && entra !== "NAO ENTRA") continue; // rodapé
    const valor = numeroBr(c[iValor]);
    const ano = Number((c[iAno] ?? "").trim());
    if (ano > 1990) anos.set(ano, (anos.get(ano) ?? 0) + 1);

    if (entra !== "ENTRA") {
      naoEntra += valor;
      continue;
    }

    if (tipoCredito.startsWith("crédito próprio") || tipoCredito.startsWith("credito proprio")) {
      const destino = (c[iProprioPara] ?? "").trim().replace(/^0+/, "");
      if (alvo && destino && destino !== alvo) {
        ignoradas += 1;
        valorIgnorado += valor;
        continue;
      }
      creditoProprio += valor;
      frete += numeroBr(c[iFrete]);
      const tipoNota = (c[idx("tipoNota")] ?? "").trim() || "—";
      const atual = porTipo.get(tipoNota) ?? { tipo: tipoNota, quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor += valor;
      porTipo.set(tipoNota, atual);
      notas.push({
        tipoNota,
        numero: limparCampo(c[idx("nfa")]) || limparCampo(c[idx("chaveAcesso")]),
        data: (c[idx("saida")] ?? "").trim() || null,
        remetente: limparCampo(c[idx("identificacaoRemetente")]),
        remetenteNome:
          iRemetenteNome >= 0 ? (c[iRemetenteNome] ?? "").trim() || null : null,
        municipioRemetente: (c[idx("municipioRemetente")] ?? "").trim(),
        destinatario: limparCampo(c[idx("identificacaoDestinatario")]),
        municipioDestinatario: (c[idx("municipioDestinatario")] ?? "").trim(),
        descricao: (c[idx("descricaoProduto")] ?? "").trim(),
        valor,
      });
    } else if (tipoCredito.startsWith("crédito interno") || tipoCredito.startsWith("credito interno")) {
      const destino = (c[iCreditoPara] ?? "").trim().replace(/^0+/, "");
      if (alvo && destino && destino !== alvo) continue;
      creditoInterno += valor;
    }
  }

  notas.sort((a, b) => b.valor - a.valor);
  const anoBase = [...anos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    arquivoNome,
    anoBase,
    codigoMunicipio,
    creditoProprio: Math.round(creditoProprio * 100) / 100,
    creditoInterno: Math.round(creditoInterno * 100) / 100,
    naoEntra: Math.round(naoEntra * 100) / 100,
    frete: Math.round(frete * 100) / 100,
    totalNotasProprio: notas.length,
    porTipoNota: [...porTipo.values()].sort((a, b) => b.valor - a.valor),
    notas,
    ignoradasOutroMunicipio: ignoradas,
    valorIgnoradoOutroMunicipio: Math.round(valorIgnorado * 100) / 100,
  };
}
