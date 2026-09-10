/**
 * Anexos da impugnação do índice provisório do VAF.
 * Anexo I  – planilha de contribuintes (XLSX, ver impugnacao.ts)
 * Anexo II – demonstrativo do levantamento e da metodologia (DOCX)
 * Anexo III – fichas individuais por contribuinte, para juntar documentos (DOCX)
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
import { diferencaItem, moedaBr, totalContestado, type DadosImpugnacao } from "./impugnacao";
import type { ContextoImpugnacao } from "./impugnacaoDocx";

const FONTE = "Arial";
const LARGURA = 9026;
const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const MARGENS = { top: 60, bottom: 60, left: 100, right: 100 };

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

function titulo(t: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [texto(t, { bold: true, size: 26 })],
  });
}

function documento(filhos: Array<Paragraph | Table>, rodape: string): Document {
  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: MARGENS_TIMBRADO } },
        headers: { default: cabecalhoTimbrado(imagensAtuais) },
        footers: { default: rodapeTimbrado(rodape) },
        children: filhos,
      },
    ],
  });
}

let imagensAtuais: ImagensTimbrado = { marca: null, marcaDagua: null };

/** Agrupa os contribuintes por motivo, para o demonstrativo do Anexo II. */
function porMotivo(dados: DadosImpugnacao) {
  const mapa = new Map<string, { qtd: number; apurado: number; recompor: number }>();
  for (const i of dados.itens) {
    const chave = i.motivo?.trim() || "Divergência não especificada";
    const atual = mapa.get(chave) ?? { qtd: 0, apurado: 0, recompor: 0 };
    atual.qtd += 1;
    atual.apurado += Number(i.vafApurado) || 0;
    atual.recompor += diferencaItem(i);
    mapa.set(chave, atual);
  }
  return [...mapa.entries()].sort((a, b) => b[1].recompor - a[1].recompor);
}

export function construirAnexoII(dados: DadosImpugnacao, ctx: ContextoImpugnacao): Document {
  const anoBase = dados.anoBase ?? dados.exercicio - 2;
  const municipio = ctx.municipio ?? "do Município";
  const grupos = porMotivo(dados);
  const cols = [4226, 1200, 1800, 1800];

  const filhos: Array<Paragraph | Table> = [
    titulo("ANEXO II – DEMONSTRATIVO DO LEVANTAMENTO E DA METODOLOGIA"),
    paragrafo(
      `Impugnação dos índices provisórios do VAF — Município ${municipio}/MG — ano-base ${anoBase} — exercício ${dados.exercicio}.`,
      { centro: true, after: 240 },
    ),

    paragrafo("1. Fonte dos dados", { bold: true, size: 24 }),
    paragrafo(
      `O levantamento foi elaborado a partir dos arquivos de retorno do VAF disponibilizados pela Secretaria de Estado de Fazenda de Minas Gerais para o ano-base ${anoBase}, confrontados com o cadastro de contribuintes ativos no território municipal e com a situação cadastral dos respectivos CNPJ na Receita Federal do Brasil.`,
      { justificado: true },
    ),
    paragrafo(
      "As informações foram processadas e conferidas individualmente, contribuinte a contribuinte, identificando-se as declarações omissas, zeradas, inconsistentes ou pendentes de validação/revalidação.",
      { justificado: true, after: 200 },
    ),

    paragrafo("2. Critérios de seleção dos contribuintes", { bold: true, size: 24 }),
    paragrafo("a) ausência de entrega da declaração (DAMEF/SIARE) no ano-base;", { after: 40 }),
    paragrafo("b) declaração entregue com valor adicionado igual a zero;", { after: 40 }),
    paragrafo("c) redução expressiva do valor adicionado sem respaldo econômico verificável;", {
      after: 40,
    }),
    paragrafo("d) valor adicionado divergente dos documentos e informações fiscais conhecidos;", {
      after: 40,
    }),
    paragrafo("e) operações praticadas no Município e atribuídas a outra unidade municipal.", {
      after: 200,
    }),

    paragrafo("3. Consolidação por tipo de divergência", { bold: true, size: 24 }),
    new Table({
      width: { size: LARGURA, type: WidthType.DXA },
      columnWidths: cols,
      rows: [
        new TableRow({
          children: [
            celula("Tipo de divergência", cols[0]!, { bold: true, fill: "EEF2F0" }),
            celula("Contribuintes", cols[1]!, { bold: true, fill: "EEF2F0", direita: true }),
            celula("VAF apurado", cols[2]!, { bold: true, fill: "EEF2F0", direita: true }),
            celula("A recompor", cols[3]!, { bold: true, fill: "EEF2F0", direita: true }),
          ],
        }),
        ...grupos.map(
          ([motivo, v]) =>
            new TableRow({
              children: [
                celula(motivo, cols[0]!),
                celula(String(v.qtd), cols[1]!, { direita: true }),
                celula(moedaBr(v.apurado), cols[2]!, { direita: true }),
                celula(moedaBr(v.recompor), cols[3]!, { direita: true }),
              ],
            }),
        ),
        new TableRow({
          children: [
            celula("Total", cols[0]!, { bold: true, fill: "F6F7F6" }),
            celula(String(dados.itens.length), cols[1]!, {
              bold: true,
              fill: "F6F7F6",
              direita: true,
            }),
            celula(
              moedaBr(dados.itens.reduce((s, i) => s + (Number(i.vafApurado) || 0), 0)),
              cols[2]!,
              { bold: true, fill: "F6F7F6", direita: true },
            ),
            celula(moedaBr(totalContestado(dados.itens)), cols[3]!, {
              bold: true,
              fill: "F6F7F6",
              direita: true,
            }),
          ],
        }),
      ],
    }),
    paragrafo("", { after: 160 }),

    paragrafo("4. Efeito pretendido", { bold: true, size: 24 }),
    paragrafo(
      `Acolhidas as divergências, o valor adicionado do Município relativo ao ano-base ${anoBase} deve ser acrescido de ${moedaBr(
        totalContestado(dados.itens),
      )}, com o consequente recálculo do índice de participação na receita do ICMS para o exercício de ${dados.exercicio}${
        dados.indicePublicado != null
          ? `, hoje publicado no percentual provisório de ${dados.indicePublicado.toLocaleString(
              "pt-BR",
              { minimumFractionDigits: 7 },
            )}%`
          : ""
      }.`,
      { justificado: true, after: 200 },
    ),
    paragrafo(
      `Demonstrativo emitido em ${new Date().toLocaleDateString("pt-BR")} e integrante da impugnação apresentada pelo Município ${municipio}/MG.`,
      { justificado: true },
    ),
  ];

  return documento(filhos, `Anexo II — impugnação do VAF ${dados.exercicio} · ${municipio}`);
}

export function construirAnexoIII(dados: DadosImpugnacao, ctx: ContextoImpugnacao): Document {
  const anoBase = dados.anoBase ?? dados.exercicio - 2;
  const municipio = ctx.municipio ?? "do Município";
  const cols = [2600, 6426];

  const filhos: Array<Paragraph | Table> = [
    titulo("ANEXO III – FICHAS INDIVIDUAIS DOS CONTRIBUINTES CONTESTADOS"),
    paragrafo(
      `Impugnação dos índices provisórios do VAF — Município ${municipio}/MG — ano-base ${anoBase} — exercício ${dados.exercicio}.`,
      { centro: true, after: 120 },
    ),
    paragrafo(
      "Cada ficha reúne a identificação do contribuinte, a divergência apontada e os valores envolvidos, servindo de capa para os documentos comprobatórios que a acompanham.",
      { justificado: true, after: 240 },
    ),
  ];

  dados.itens.forEach((i, n) => {
    filhos.push(
      paragrafo(`Ficha ${n + 1} de ${dados.itens.length} — ${i.nome ?? "(sem nome)"}`, {
        bold: true,
        size: 24,
        after: 80,
      }),
    );
    const linhas: Array<[string, string]> = [
      ["Inscrição estadual", i.ie],
      ["CNPJ", i.cnpj ?? "—"],
      ["Divergência apontada", i.motivo],
      ["VAF apurado pela SEF/MG", moedaBr(i.vafApurado)],
      ["VAF entendido como correto", moedaBr(i.vafCorreto)],
      ["Valor a recompor", moedaBr(diferencaItem(i))],
      ["Observações do Município", i.observacao?.trim() || "—"],
      ["Documentos que instruem a ficha", "(   ) DAMEF   (   ) NF-e   (   ) Ofício   (   ) Outros"],
    ];
    filhos.push(
      new Table({
        width: { size: LARGURA, type: WidthType.DXA },
        columnWidths: cols,
        rows: linhas.map(
          ([rotulo, valor]) =>
            new TableRow({
              children: [
                celula(rotulo, cols[0]!, { bold: true, fill: "F6F7F6" }),
                celula(valor, cols[1]!),
              ],
            }),
        ),
      }),
    );
    filhos.push(paragrafo("", { after: 200 }));
  });

  if (!dados.itens.length) {
    filhos.push(paragrafo("Nenhum contribuinte contestado nesta impugnação.", { after: 120 }));
  }

  return documento(filhos, `Anexo III — impugnação do VAF ${dados.exercicio} · ${municipio}`);
}

export async function gerarAnexosImpugnacao(
  dados: DadosImpugnacao,
  ctx: ContextoImpugnacao,
): Promise<{ anexoII: Blob; anexoIII: Blob }> {
  imagensAtuais = await carregarImagensTimbrado();
  const anexoII = await Packer.toBlob(construirAnexoII(dados, ctx));
  const anexoIII = await Packer.toBlob(construirAnexoIII(dados, ctx));
  return { anexoII, anexoIII };
}
