import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import logoAsset from "@/assets/htechminas-logo.png.asset.json";
import type { DiagnosticoEvolucao, FatorVariacao } from "./diagnostico";
import { ROTULO_PRIORIDADE, type AcaoRecuperacao } from "./recuperacao";


const FONTE = "Arial";
const LARGURA = 9026; // A4 com margens de 1"
const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const MARGENS = { top: 60, bottom: 60, left: 100, right: 100 };

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function texto(t: string, opcoes: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text: t, font: FONTE, size: opcoes.size ?? 20, ...opcoes });
}

function paragrafo(t: string, opcoes: { bold?: boolean; size?: number; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: opcoes.after ?? 120 },
    children: [texto(t, { bold: opcoes.bold ?? false, size: opcoes.size ?? 20 })],
  });
}

function celula(t: string, largura: number, opcoes: { bold?: boolean; fill?: string; direita?: boolean } = {}) {
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

function tabelaFatores(fatores: FatorVariacao[]): Table {
  const cols = [4600, 2400, 2026];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        children: [
          celula("Fator", cols[0]!, { bold: true, fill: "EEF2F0" }),
          celula("Impacto (R$)", cols[1]!, { bold: true, fill: "EEF2F0", direita: true }),
          celula("Peso", cols[2]!, { bold: true, fill: "EEF2F0", direita: true }),
        ],
      }),
      ...fatores.map(
        (f) =>
          new TableRow({
            children: [
              celula(`${f.rotulo}\n${f.detalhe}`, cols[0]!),
              celula(moeda(f.impacto), cols[1]!, { direita: true }),
              celula(pct(f.peso), cols[2]!, { direita: true }),
            ],
          }),
      ),
    ],
  });
}

function tabelaDetalhe(fator: FatorVariacao): Table {
  const cols = [3626, 1800, 1800, 1800];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        children: [
          celula("Item", cols[0]!, { bold: true, fill: "F4F4F4" }),
          celula("Base", cols[1]!, { bold: true, fill: "F4F4F4", direita: true }),
          celula("Comparado/estimado", cols[2]!, { bold: true, fill: "F4F4F4", direita: true }),
          celula("Impacto", cols[3]!, { bold: true, fill: "F4F4F4", direita: true }),
        ],
      }),
      ...fator.itens.map(
        (i) =>
          new TableRow({
            children: [
              celula(i.sub ? `${i.rotulo} — ${i.sub}` : i.rotulo, cols[0]!),
              celula(moeda(i.valorBase), cols[1]!, { direita: true }),
              celula(moeda(i.valorAtual), cols[2]!, { direita: true }),
              celula(moeda(i.impacto), cols[3]!, { direita: true }),
            ],
          }),
      ),
    ],
  });
}

export function construirDocDiagnostico(
  d: DiagnosticoEvolucao,
  baseNome: string,
  atualNome: string,
  municipio?: string | null,
  acoes?: AcaoRecuperacao[],
  imagens?: ImagensTimbrado,
): Document {
  const timbrado: ImagensTimbrado = imagens ?? { marca: null, marcaDagua: null };
  const filhos: Array<Paragraph | Table> = [
    new Paragraph({

      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [texto("Análise da variação do VAF — Por que variou", { bold: true, size: 30 })],
    }),
    paragrafo(`Arquivo base: ${baseNome}`),
    paragrafo(`Arquivo comparado/estimado: ${atualNome}`),
    ...(municipio ? [paragrafo(`Município: ${municipio}`)] : []),
    paragrafo(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, { after: 200 }),


    paragrafo("Resumo", { bold: true, size: 24 }),
    paragrafo(d.resumo, { after: 160 }),

    paragrafo("Valores", { bold: true, size: 24 }),
    paragrafo(
      `Valor líquido base: ${moeda(d.valorBase)} · Comparado/estimado: ${moeda(
        d.valorAtual,
      )} · Diferença: ${moeda(d.diferenca)}${
        d.variacaoPct === null ? "" : ` (${pct(d.variacaoPct)})`
      }`,
      { after: 200 },
    ),

    paragrafo("Ranking de fatores — movimentação de declarantes", { bold: true, size: 24 }),
    tabelaFatores(d.fatoresDeclarantes),
    paragrafo("", { after: 160 }),

    paragrafo("Ranking de fatores — componentes do valor líquido (VAF A/B/C)", {
      bold: true,
      size: 24,
    }),
    tabelaFatores(d.fatores),
    paragrafo("", { after: 160 }),
  ];

  const comDetalhe = d.fatoresDeclarantes.filter((f) => f.itens.length > 0);
  if (comDetalhe.length) {
    filhos.push(paragrafo("Detalhamento por fator", { bold: true, size: 24 }));
    for (const f of comDetalhe) {
      filhos.push(
        paragrafo(
          `${f.rotulo} — ${moeda(f.impacto)}${
            f.totalItens > f.itens.length
              ? ` (exibindo os ${f.itens.length} maiores de ${f.totalItens} itens)`
              : ""
          }`,
          { bold: true, after: 60 },
        ),
      );
      filhos.push(tabelaDetalhe(f));
      filhos.push(paragrafo("", { after: 140 }));
    }
  }

  if (d.topQuedas.length) {
    filhos.push(paragrafo("Maiores quedas por contribuinte", { bold: true, size: 24 }));
    for (const c of d.topQuedas) {
      filhos.push(
        paragrafo(`• ${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): ${moeda(c.diferenca)}`, {
          after: 40,
        }),
      );
    }
    filhos.push(paragrafo("", { after: 120 }));
  }

  if (d.topAltas.length) {
    filhos.push(paragrafo("Maiores altas por contribuinte", { bold: true, size: 24 }));
    for (const c of d.topAltas) {
      filhos.push(
        paragrafo(`• ${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): ${moeda(c.diferenca)}`, {
          after: 40,
        }),
      );
    }
    filhos.push(paragrafo("", { after: 120 }));
  }

  if (d.alertas.length) {
    filhos.push(paragrafo("Ressalvas de comparabilidade", { bold: true, size: 24 }));
    for (const a of d.alertas) filhos.push(paragrafo(`• ${a}`, { after: 40 }));
    filhos.push(paragrafo("", { after: 120 }));
  }

  filhos.push(paragrafo("Conclusão", { bold: true, size: 24 }));
  filhos.push(paragrafo(d.conclusao, { after: 200 }));

  if (acoes && acoes.length) {
    const total = acoes.reduce((s, a) => s + a.valorRecuperavel, 0);
    filhos.push(paragrafo("Plano de recuperação", { bold: true, size: 24 }));
    filhos.push(paragrafo(`Potencial total mapeado: ${moeda(total)}`, { after: 140 }));
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
          { after: 120 },
        ),
      );
    });
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

export async function baixarDocDiagnostico(
  d: DiagnosticoEvolucao,
  baseNome: string,
  atualNome: string,
  municipio?: string | null,
  acoes?: AcaoRecuperacao[],
): Promise<void> {
  const imagens = await carregarImagensTimbrado();
  const doc = construirDocDiagnostico(d, baseNome, atualNome, municipio, acoes, imagens);

  const blob = await Packer.toBlob(doc);
  const limpo = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 40);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analise-vaf_${limpo(baseNome)}_x_${limpo(atualNome)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

