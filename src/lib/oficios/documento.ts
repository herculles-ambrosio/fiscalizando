import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  analisarCorpo,
  aplicarPlaceholders,
  cmParaTwips,
  MARGENS_PADRAO,
  MODELOS_PADRAO,
  type ModeloOficio,
} from "./modelos";
import { dataPorExtenso } from "./texto";
import type { BrasaoImagem, ConfiguracaoMunicipio, ContribuinteOficio } from "./zerados";


const FONTE = "Arial";

export type ParametrosOficio = {
  modelo: ModeloOficio;
  contribuinte: ContribuinteOficio;
  config: ConfiguracaoMunicipio;
  exercicio: number;
  /** Ano em que o índice será aplicado. Ausente, mantém o legado: exercício + 1. */
  anoAplicacao?: number | null;
  dataOficio: string;
  brasao?: BrasaoImagem | null;
};

function tituloCabecalho(texto: string, tamanho: number) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: texto, bold: true, size: tamanho, font: FONTE })],
  });
}

export function construirOficio(params: ParametrosOficio): Document {
  const { modelo, contribuinte, config, exercicio, anoAplicacao, dataOficio, brasao } = params;
  const subst = (t: string) =>
    aplicarPlaceholders(t, {
      contribuinte,
      config,
      exercicio,
      ...(anoAplicacao !== undefined ? { anoAplicacao } : {}),
      dataOficio,
    });

  const cabecalho: Paragraph[] = [];

  if (brasao) {
    cabecalho.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new ImageRun({
            type: brasao.tipo,
            data: brasao.dados,
            transformation: { width: 70, height: 70 },
            altText: {
              title: "Brasão",
              description: `Brasão da ${config.nome_prefeitura}`,
              name: "brasao",
            },
          }),
        ],
      }),
    );
  }

  const linhasCabecalho = (modelo.cabecalho ?? "")
    .split(/\r?\n/)
    .map((l) => subst(l).trim())
    .filter(Boolean);

  cabecalho.push(
    ...(linhasCabecalho.length
      ? linhasCabecalho.map((linha, i) => tituloCabecalho(linha, i === 0 ? 26 : 22))
      : [
          tituloCabecalho(config.nome_prefeitura, 26),
          tituloCabecalho(config.estado, 22),
        ]),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      children: [],
    }),
  );


  const corpo: Paragraph[] = analisarCorpo(modelo.corpo).map((bloco) => {
    switch (bloco.tipo) {
      case "espaco":
        return new Paragraph({ spacing: { after: 100 }, children: [] });
      case "citacao":
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 276 },
          children: [
            new TextRun({ text: subst(bloco.texto), size: 22, font: FONTE, italics: true }),
          ],
        });
      case "centralizado":
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [new TextRun({ text: subst(bloco.texto), size: 22, font: FONTE, bold: true })],
        });
      case "campo":
        return new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${subst(bloco.rotulo)}: `, size: 22, font: FONTE }),
            new TextRun({ text: subst(bloco.valor), size: 22, font: FONTE, bold: true }),
          ],
        });
      default:
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 276 },
          children: [new TextRun({ text: subst(bloco.texto), size: 22, font: FONTE })],
        });
    }
  });

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: cmParaTwips(modelo.margem_topo ?? MARGENS_PADRAO.margem_topo),
              right: cmParaTwips(modelo.margem_direita ?? MARGENS_PADRAO.margem_direita),
              bottom: cmParaTwips(modelo.margem_inferior ?? MARGENS_PADRAO.margem_inferior),
              left: cmParaTwips(modelo.margem_esquerda ?? MARGENS_PADRAO.margem_esquerda),
            },
          },
        },

        children: [
          ...cabecalho,

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: subst(modelo.titulo),
                bold: true,
                size: 24,
                font: FONTE,
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `${config.cidade_data}, ${dataPorExtenso(dataOficio)}.`,
                size: 22,
                font: FONTE,
              }),
            ],
          }),

          ...corpo,

          new Paragraph({ spacing: { after: 320 }, children: [] }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: config.texto_assinatura, bold: true, size: 22, font: FONTE }),
            ],
          }),
          ...(config.signatario_nome
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: config.signatario_nome, size: 22, font: FONTE })],
                }),
              ]
            : []),
          ...(config.signatario_cargo
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: config.signatario_cargo, size: 20, font: FONTE })],
                }),
              ]
            : []),

          new Paragraph({ spacing: { after: 400 }, children: [] }),

          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: "Recebi ____/____/____", size: 22, font: FONTE })],
          }),

          ...(modelo.rodape?.trim() ? subst(modelo.rodape).split(/\r?\n/) : [config.endereco_rodape])
            .filter((l) => l.trim())
            .map(
              (linha) =>
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: linha.trim(), size: 18, font: FONTE })],
                }),
            ),

        ],
      },
    ],
  });
}

export async function gerarDocxOficio(params: ParametrosOficio): Promise<Blob> {
  return Packer.toBlob(construirOficio(params));
}

export const MODELO_ZERADO_PADRAO = MODELOS_PADRAO.find((m) => m.chave === "zerado")!;
