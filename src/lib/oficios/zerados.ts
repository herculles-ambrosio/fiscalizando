import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { dataPorExtenso, nomeArquivoSeguro } from "./texto";
import { formatarCnpj } from "@/lib/format";

export type ConfiguracaoMunicipio = {
  nome_prefeitura: string;
  estado: string;
  secretaria: string;
  setor: string;
  endereco_rodape: string;
  cidade_data: string;
  signatario_nome: string;
  signatario_cargo: string;
  texto_assinatura: string;
};

export type BrasaoImagem = {
  dados: Uint8Array;
  tipo: "png" | "jpg";
};

export type ContribuinteOficio = {
  nome: string | null;
  cnpj: string | null;
  inscricao_estadual: string;
  endereco: string | null;
};

const FONTE = "Arial";

function titulo(texto: string, tamanho: number) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: texto, bold: true, size: tamanho, font: FONTE })],
  });
}

function corpo(texto: string, opcoes: { negrito?: boolean; italico?: boolean } = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 276 },
    children: [
      new TextRun({
        text: texto,
        size: 22,
        font: FONTE,
        bold: opcoes.negrito ?? false,
        italics: opcoes.italico ?? false,
      }),
    ],
  });
}

function campo(rotulo: string, valor: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${rotulo}: `, size: 22, font: FONTE }),
      new TextRun({ text: valor, size: 22, font: FONTE, bold: true }),
    ],
  });
}

export function construirOficioZerado(params: {
  contribuinte: ContribuinteOficio;
  config: ConfiguracaoMunicipio;
  exercicio: number;
  dataOficio: string;
  brasao?: BrasaoImagem | null;
}): Document {
  const { contribuinte, config, exercicio, dataOficio, brasao } = params;

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

  cabecalho.push(
    titulo(config.nome_prefeitura, 26),
    titulo(config.estado, 22),
    titulo(config.secretaria, 22),
    titulo(config.setor, 20),
    new Paragraph({
      spacing: { after: 240 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 },
      },
      children: [],
    }),
  );

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          ...cabecalho,

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `PEDIDO DE RETIFICAÇÃO EMPRESAS COM DECLARAÇÃO ZERADAS VAF ${exercicio}`,
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

          corpo("Prezado,"),

          campo("Contribuinte", contribuinte.nome ?? "—"),
          campo("CNPJ", formatarCnpj(contribuinte.cnpj)),
          campo("Inscrição Estadual", contribuinte.inscricao_estadual),
          campo("Endereço", contribuinte.endereco ?? "—"),

          new Paragraph({ spacing: { after: 120 }, children: [] }),

          corpo(
            "Valor Adicionado Fiscal (VAF) é um indicador econômico-contábil utilizado pelo Estado para calcular o índice de participação municipal no repasse de receita do Imposto sobre Operações relativas à Circulação de Mercadorias e sobre Prestações de Serviços de Transporte Interestadual e Intermunicipal e de Comunicação (ICMS) e do Imposto sobre Produtos Industrializados (IPI) aos municípios mineiros. É apurado pela Secretaria de Estado de Fazenda de Minas Gerais (SEF-MG), com base em declarações anuais apresentadas pelas empresas estabelecidas nos respectivos municípios.",
          ),

          corpo(
            `Prezado contribuinte responsável pelas informações do VAF ${exercicio}. Estamos acompanhando o VAF ${exercicio} do Município de ${config.cidade_data.split("/")[0]}. A resolução 4.306/2011 da SRE- Secretaria da Receita Estadual legaliza o município de indicar um representante para coletar e acompanhar a correta transmissão dos dados e regularidade das informações, conforme art. 21 in verbis:`,
          ),

          corpo(
            "Art. 21. O município indicará a Secretaria de Estado de Fazenda até 31 de Maio de cada exercício, o nome da pessoa responsável para acompanhamento da coleta de dados, da análise da informações recebidas e da apuração do valor adicionado.",
            { italico: true },
          ),

          corpo(
            "Como representante do município, solicitamos a retificação da DAMEF/VAF-PGDAS/DEFIS da empresa acima relacionada, de sua responsabilidade.",
          ),

          corpo(
            `Com efeito, de acordo com o banco de dados da Receita Estadual o contribuinte não realizou a validação da DAMEF, sendo assim, solicitamos que seja providenciado junto ao sitio da Receita Estadual a regularização da declaração DAMEF/VAF referente ao ano de ${exercicio}.`,
          ),

          corpo(
            "A multa por deixar de entregar a declaração varia de 100 a 500 UFEMG, conforme previsto no artigo 215 do RICMS, inciso III, alíneas “a” e “b”, ou seja, varia em torno de R$ 553,10 (Quinhentos e cinquenta e três reais e dez centavos) para as microempresas a R$ 2.765,50 (Dois mil setecentos e sessenta e cinco reais e cinquenta centavos), para as demais.",
          ),

          corpo(
            "Art. 215. As multas calculadas com base na UFEMG, ou no valor do imposto não declarado, são:",
            { italico: true },
          ),

          corpo(
            "III - por deixar de entregar ao Fisco documento informativo do movimento econômico ou fiscal, exceto o previsto no inciso VIII do caput deste artigo, na forma e no prazo definidos neste regulamento:",
            { italico: true },
          ),

          corpo(
            `Ressaltamos que é de suma importância à participação de sua empresa para o crescimento de seu município. Pois através desta declaração o mesmo receberá a parcela do ICMS que lhe é devida no exercício de ${exercicio + 1}. Convicto de vosso apoio e atenção ao pleito subscrevemos com protesto de mais elevada estima e consideração.`,
          ),

          corpo("Atenciosamente."),

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
                  children: [
                    new TextRun({ text: config.signatario_nome, size: 22, font: FONTE }),
                  ],
                }),
              ]
            : []),
          ...(config.signatario_cargo
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: config.signatario_cargo, size: 20, font: FONTE }),
                  ],
                }),
              ]
            : []),

          new Paragraph({ spacing: { after: 400 }, children: [] }),

          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: "Recebi ____/____/____", size: 22, font: FONTE })],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: config.endereco_rodape, size: 18, font: FONTE }),
            ],
          }),
        ],
      },
    ],
  });
}

export async function gerarDocxZerado(params: {
  contribuinte: ContribuinteOficio;
  config: ConfiguracaoMunicipio;
  exercicio: number;
  dataOficio: string;
  brasao?: BrasaoImagem | null;
}): Promise<Blob> {
  return Packer.toBlob(construirOficioZerado(params));
}

export function nomeArquivoOficio(contribuinte: ContribuinteOficio): string {
  const cnpj = (contribuinte.cnpj ?? contribuinte.inscricao_estadual).replace(/\D/g, "");
  return `${cnpj}_${nomeArquivoSeguro(contribuinte.nome ?? "contribuinte")}.docx`;
}
