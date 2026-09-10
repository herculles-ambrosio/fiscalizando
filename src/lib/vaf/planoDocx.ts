import { sufixoReceita, type MapaReceitaPorIe } from "@/lib/receita/porIe";
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
import { ROTULO_PRIORIDADE, potencialConsolidado, type AcaoRecuperacao } from "./recuperacao";

const FONTE = "Arial";
const LARGURA = 9026; // A4 com margens de 1"
const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const MARGENS = { top: 60, bottom: 60, left: 100, right: 100 };

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function texto(t: string, opcoes: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: t, font: FONTE, size: opcoes.size ?? 20, bold: opcoes.bold ?? false });
}

function paragrafo(t: string, opcoes: { bold?: boolean; size?: number; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: opcoes.after ?? 120 },
    children: [texto(t, { bold: opcoes.bold ?? false, size: opcoes.size ?? 20 })],
  });
}

function celula(
  t: string,
  largura: number,
  opcoes: { bold?: boolean; fill?: string; direita?: boolean } = {},
) {
  return new TableCell({
    borders: BORDAS,
    margins: MARGENS,
    width: { size: largura, type: WidthType.DXA },
    ...(opcoes.fill ? { shading: { fill: opcoes.fill, type: ShadingType.CLEAR } } : {}),
    children: [
      new Paragraph({
        alignment: opcoes.direita ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [texto(t, { bold: opcoes.bold ?? false, size: 18 })],
      }),
    ],
  });
}

function tabelaResumo(acoes: AcaoRecuperacao[]): Table {
  const cols = [4100, 1500, 1400, 2026];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        children: [
          celula("Ação", cols[0]!, { bold: true, fill: "EEF2F0" }),
          celula("Prioridade", cols[1]!, { bold: true, fill: "EEF2F0" }),
          celula("Contribuintes", cols[2]!, { bold: true, fill: "EEF2F0", direita: true }),
          celula("Potencial (R$)", cols[3]!, { bold: true, fill: "EEF2F0", direita: true }),
        ],
      }),
      ...acoes.map(
        (a) =>
          new TableRow({
            children: [
              celula(a.titulo, cols[0]!),
              celula(ROTULO_PRIORIDADE[a.prioridade], cols[1]!),
              celula(String(a.contribuintes.length), cols[2]!, { direita: true }),
              celula(moeda(a.valorRecuperavel), cols[3]!, { direita: true }),
            ],
          }),
      ),
    ],
  });
}

export function construirDocPlano(
  acoes: AcaoRecuperacao[],
  contexto: {
    municipio?: string | null;
    exercicio?: number | null;
    referencia?: string | null;
    situacoesReceita?: MapaReceitaPorIe | null;
  },
  imagens?: ImagensTimbrado,
): Document {
  const situacoesReceita = contexto.situacoesReceita ?? null;
  const timbrado: ImagensTimbrado = imagens ?? { marca: null, marcaDagua: null };
  const total = potencialConsolidado(acoes);

  const filhos: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [texto("Plano de recuperação do VAF — o que fazer para recuperar", {
        bold: true,
        size: 30,
      })],
    }),
    ...(contexto.municipio ? [paragrafo(`Município: ${contexto.municipio}`)] : []),
    ...(contexto.exercicio ? [paragrafo(`Exercício: ${contexto.exercicio}`)] : []),
    ...(contexto.referencia ? [paragrafo(`Análise: ${contexto.referencia}`)] : []),
    paragrafo(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, { after: 200 }),
    paragrafo(`Potencial total mapeado: ${moeda(total)}`, { bold: true, size: 24, after: 160 }),
  ];

  if (acoes.length) {
    filhos.push(paragrafo("Resumo das ações", { bold: true, size: 24 }));
    filhos.push(tabelaResumo(acoes));
    filhos.push(paragrafo("", { after: 200 }));

    filhos.push(paragrafo("Detalhamento das ações", { bold: true, size: 24 }));
    acoes.forEach((a, i) => {
      filhos.push(
        paragrafo(
          `${i + 1}. ${a.titulo} — ${ROTULO_PRIORIDADE[a.prioridade]}${
            a.valorRecuperavel > 0 ? ` · ${moeda(a.valorRecuperavel)}` : ""
          }`,
          { bold: true, after: 40 },
        ),
      );
      filhos.push(paragrafo(`Motivo: ${a.motivo}`, { after: 30 }));
      filhos.push(paragrafo(`Como fazer: ${a.comoFazer}`, { after: 30 }));
      filhos.push(
        paragrafo(
          `Prazo: ${a.prazoSugerido}` +
            (a.contribuintes.length ? ` · Contribuintes: ${a.contribuintes.length}` : "") +
            (a.fundamento ? ` · ${a.fundamento}` : ""),
          { after: 60 },
        ),
      );
      if (a.contribuintes.length) {
        const lista = a.contribuintes
          .slice(0, 30)
          .map(
            (c) =>
              `${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual})` +
              sufixoReceita(situacoesReceita, c.inscricao_estadual),
          )
          .join("; ");
        filhos.push(
          paragrafo(
            `Contribuintes: ${lista}${a.contribuintes.length > 30 ? " …" : ""}`,
            { after: 140 },
          ),
        );
      }
    });
  } else {
    filhos.push(paragrafo("Nenhuma ação sugerida para esta análise.", { after: 160 }));
  }

  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: MARGENS_TIMBRADO } },
        headers: { default: cabecalhoTimbrado(timbrado) },
        footers: {
          default: rodapeTimbrado(
            `Apura VAF 2.0 — relatório gerado em ${new Date().toLocaleDateString("pt-BR")}`,
          ),
        },
        children: filhos,
      },
    ],
  });
}

export async function baixarDocPlano(
  acoes: AcaoRecuperacao[],
  contexto: {
    municipio?: string | null;
    exercicio?: number | null;
    referencia?: string | null;
    situacoesReceita?: MapaReceitaPorIe | null;
  },
): Promise<void> {
  const imagens = await carregarImagensTimbrado();
  const doc = construirDocPlano(acoes, contexto, imagens);
  const blob = await Packer.toBlob(doc);
  const limpo = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 40);
  const sufixo = [contexto.municipio, contexto.exercicio ? String(contexto.exercicio) : null]
    .filter(Boolean)
    .map((s) => limpo(String(s)))
    .join("_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plano-recuperacao-vaf${sufixo ? `_${sufixo}` : ""}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
