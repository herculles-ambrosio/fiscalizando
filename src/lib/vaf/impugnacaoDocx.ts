/**
 * Petição de impugnação do índice provisório do VAF, em DOCX,
 * no mesmo timbrado dos demais relatórios do Apura VAF 2.0.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  MARGENS_TIMBRADO,
  cabecalhoTimbrado,
  carregarImagensTimbrado,
  rodapeTimbrado,
  type ImagensTimbrado,
} from "@/lib/reportTimbrado";
import {
  diferencaItem,
  moedaBr,
  totalContestado,
  type DadosImpugnacao,
} from "./impugnacao";

const FONTE = "Arial";
const LARGURA = 9026;
const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const MARGENS = { top: 60, bottom: 60, left: 100, right: 100 };

export type ContextoImpugnacao = {
  municipio: string | null;
  prefeitura: string | null;
  cidadeData: string | null;
  signatarioNome: string | null;
  signatarioCargo: string | null;
};

function texto(t: string, o: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: t, font: FONTE, size: o.size ?? 20, bold: o.bold ?? false });
}

function paragrafo(
  t: string,
  o: { bold?: boolean; size?: number; after?: number; centro?: boolean; justificado?: boolean } = {},
) {
  return new Paragraph({
    spacing: { after: o.after ?? 120 },
    alignment: o.centro
      ? AlignmentType.CENTER
      : o.justificado
        ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT,
    children: [texto(t, { bold: o.bold ?? false, size: o.size ?? 20 })],
  });
}

function celula(
  t: string,
  largura: number,
  o: { bold?: boolean; fill?: string; direita?: boolean } = {},
) {
  return new TableCell({
    borders: BORDAS,
    margins: MARGENS,
    width: { size: largura, type: WidthType.DXA },
    ...(o.fill ? { shading: { fill: o.fill, type: ShadingType.CLEAR } } : {}),
    children: [
      new Paragraph({
        alignment: o.direita ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [texto(t, { bold: o.bold ?? false, size: 16 })],
      }),
    ],
  });
}

function tabelaItens(dados: DadosImpugnacao): Table {
  const cols = [500, 1300, 2626, 2200, 1200, 1200];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        children: [
          celula("Nº", cols[0]!, { bold: true, fill: "EEF2F0" }),
          celula("IE", cols[1]!, { bold: true, fill: "EEF2F0" }),
          celula("Contribuinte", cols[2]!, { bold: true, fill: "EEF2F0" }),
          celula("Motivo", cols[3]!, { bold: true, fill: "EEF2F0" }),
          celula("VAF apurado", cols[4]!, { bold: true, fill: "EEF2F0", direita: true }),
          celula("A recompor", cols[5]!, { bold: true, fill: "EEF2F0", direita: true }),
        ],
      }),
      ...dados.itens.map(
        (i, n) =>
          new TableRow({
            children: [
              celula(String(n + 1), cols[0]!),
              celula(i.ie, cols[1]!),
              celula(i.nome ?? "(sem nome)", cols[2]!),
              celula(i.motivo, cols[3]!),
              celula(moedaBr(i.vafApurado), cols[4]!, { direita: true }),
              celula(moedaBr(diferencaItem(i)), cols[5]!, { direita: true }),
            ],
          }),
      ),
      new TableRow({
        children: [
          celula("", cols[0]!, { fill: "F6F7F6" }),
          celula("", cols[1]!, { fill: "F6F7F6" }),
          celula("", cols[2]!, { fill: "F6F7F6" }),
          celula("Total", cols[3]!, { bold: true, fill: "F6F7F6", direita: true }),
          celula("", cols[4]!, { fill: "F6F7F6" }),
          celula(moedaBr(totalContestado(dados.itens)), cols[5]!, {
            bold: true,
            fill: "F6F7F6",
            direita: true,
          }),
        ],
      }),
    ],
  });
}

export function construirDocImpugnacao(
  dados: DadosImpugnacao,
  ctx: ContextoImpugnacao,
  imagens?: ImagensTimbrado,
): Document {
  const timbrado: ImagensTimbrado = imagens ?? { marca: null, marcaDagua: null };
  const total = totalContestado(dados.itens);
  const anoBase = dados.anoBase ?? dados.exercicio - 2;
  const resolucao = dados.resolucao.trim() || "resolução que fixou os índices provisórios";

  const filhos: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        texto("IMPUGNAÇÃO DO ÍNDICE PROVISÓRIO DO VAF", { bold: true, size: 28 }),
      ],
    }),
    paragrafo("À Secretaria de Estado de Fazenda de Minas Gerais — Diretoria de Informações Econômico-Fiscais", {
      after: 200,
    }),
    paragrafo(
      `${ctx.prefeitura ?? ctx.municipio ?? "O Município"}, pessoa jurídica de direito público interno, por seu representante legal, vem, tempestivamente, com fundamento no art. 3º, § 7º, da Lei Complementar federal nº 63, de 11 de janeiro de 1990, na Lei estadual nº 18.030, de 12 de janeiro de 2009, e na ${resolucao}${
        dados.resolucaoData ? `, publicada em ${dados.resolucaoData}` : ""
      }, apresentar IMPUGNAÇÃO aos dados e ao índice provisório do Valor Adicionado Fiscal fixados para o exercício de ${dados.exercicio} (ano-base ${anoBase}), pelas razões a seguir.`,
      { justificado: true, after: 200 },
    ),
    paragrafo("1. Do índice impugnado", { bold: true, size: 24 }),
    paragrafo(
      `Índice provisório publicado: ${
        dados.indicePublicado != null
          ? dados.indicePublicado.toLocaleString("pt-BR", { minimumFractionDigits: 7 })
          : "conforme publicação"
      }. A apuração desconsiderou ou registrou de forma incorreta o valor adicionado de ${dados.itens.length} contribuinte(s) estabelecido(s) no Município, conforme demonstrado no quadro abaixo e na planilha anexa.`,
      { justificado: true, after: 160 },
    ),
    paragrafo("2. Das razões da impugnação", { bold: true, size: 24 }),
    paragrafo(
      "Cada contribuinte relacionado é identificado pela inscrição estadual e pelo CNPJ, com a indicação precisa da divergência verificada: ausência de entrega da declaração anual, declaração com valor adicionado zerado, queda expressiva sem respaldo na atividade econômica ou valor divergente dos documentos fiscais emitidos. As operações correspondentes foram praticadas no território deste Município e devem compor o seu valor adicionado.",
      { justificado: true, after: 160 },
    ),
    paragrafo("3. Do quadro de contribuintes contestados", { bold: true, size: 24 }),
    tabelaItens(dados),
    paragrafo("", { after: 160 }),
    paragrafo(
      `Valor adicionado total a recompor: ${moedaBr(total)}.`,
      { bold: true, after: 200 },
    ),
  ];

  if (dados.observacao.trim()) {
    filhos.push(paragrafo("4. Considerações complementares", { bold: true, size: 24 }));
    filhos.push(paragrafo(dados.observacao.trim(), { justificado: true, after: 200 }));
  }

  filhos.push(paragrafo("Do pedido", { bold: true, size: 24 }));
  filhos.push(
    paragrafo(
      `Ante o exposto, requer o Município o recebimento e o processamento desta impugnação, com a revisão dos dados dos contribuintes relacionados, a recomposição do valor adicionado fiscal no montante de ${moedaBr(
        total,
      )} e a consequente retificação do índice do VAF a ser fixado em caráter definitivo para o exercício de ${dados.exercicio}, protestando pela juntada de documentos complementares que se façam necessários à instrução do feito.`,
      { justificado: true, after: 240 },
    ),
  );
  filhos.push(paragrafo("Nestes termos, pede deferimento.", { after: 300 }));
  filhos.push(paragrafo(ctx.cidadeData ?? "", { centro: true, after: 400 }));
  filhos.push(paragrafo("__________________________________________", { centro: true, after: 40 }));
  filhos.push(paragrafo(ctx.signatarioNome ?? "", { centro: true, bold: true, after: 20 }));
  filhos.push(paragrafo(ctx.signatarioCargo ?? "", { centro: true, after: 200 }));
  filhos.push(
    paragrafo(
      "Anexo: planilha com a relação completa dos contribuintes contestados (arquivo .xlsx).",
      { after: 120 },
    ),
  );

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: MARGENS_TIMBRADO } },
        headers: { default: cabecalhoTimbrado(timbrado) },
        footers: {
          default: rodapeTimbrado(
            `Apura VAF 2.0 — impugnação gerada em ${new Date().toLocaleDateString("pt-BR")}`,
          ),
        },
        children: filhos,
      },
    ],
  });
}

export async function gerarDocxImpugnacao(
  dados: DadosImpugnacao,
  ctx: ContextoImpugnacao,
): Promise<Blob> {
  const imagens = await carregarImagensTimbrado();
  return Packer.toBlob(construirDocImpugnacao(dados, ctx, imagens));
}
