import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import marcaAsset from "@/assets/timbrado-logo.png.asset.json";
import marcaDaguaAsset from "@/assets/timbrado-dagua.png.asset.json";

export const CONTATO_HTECH = {
  endereco: "Rua Frederico Dolabela, 703 - Centro - Manhuaçu - MG",
  contatos: "33 98414 2223 | contato@htechminas.com.br | www.htechminas.com.br",
};

const FONTE = "Arial";
const LARANJA = "E2582A";
const GRAFITE = "4A4441";
const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SEM_BORDAS = { top: SEM_BORDA, bottom: SEM_BORDA, left: SEM_BORDA, right: SEM_BORDA };

export interface ImagensTimbrado {
  marca: ArrayBuffer | null;
  marcaDagua: ArrayBuffer | null;
}

async function buscar(url: string): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/** Carrega as imagens do papel timbrado (logo e marca d'água) do CDN. */
export async function carregarImagensTimbrado(): Promise<ImagensTimbrado> {
  const [marca, marcaDagua] = await Promise.all([
    buscar(marcaAsset.url),
    buscar(marcaDaguaAsset.url),
  ]);
  return { marca, marcaDagua };
}

/** Cabeçalho com a logo centralizada e a marca d'água ao fundo (repetida em todas as páginas). */
export function cabecalhoTimbrado(imgs: ImagensTimbrado): Header {
  const filhos: Paragraph[] = [];

  if (imgs.marcaDagua) {
    filhos.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: imgs.marcaDagua,
            transformation: { width: 400, height: 271 },
            floating: {
              behindDocument: true,
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: HorizontalPositionAlign.CENTER,
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: VerticalPositionAlign.CENTER,
              },
            },
            altText: {
              title: "H-Tech Minas",
              description: "Marca d'água H-Tech Minas",
              name: "H-Tech Minas",
            },
          }),
        ],
      }),
    );
  }

  if (imgs.marca) {
    filhos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: "png",
            data: imgs.marca,
            transformation: { width: 240, height: 53 },
            altText: {
              title: "H-Tech Minas",
              description: "Logo H-Tech Minas — Consultoria Tributária",
              name: "H-Tech Minas",
            },
          }),
        ],
      }),
    );
  } else {
    filhos.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({ text: "H-TECH", font: FONTE, size: 22, bold: true, color: "58514E" }),
          new TextRun({ text: " MINAS", font: FONTE, size: 22, color: "58514E" }),
        ],
      }),
    );
  }


  return new Header({ children: filhos });
}

/** Rodapé com a faixa laranja/grafite do papel timbrado. */
export function rodapeTimbrado(nota?: string): Footer {
  const cols = [700, 8326];
  const linha = (t: string, opcoes: { size?: number; color?: string } = {}) =>
    new Paragraph({
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: t,
          font: FONTE,
          size: opcoes.size ?? 14,
          color: opcoes.color ?? "FFFFFF",
        }),
      ],
    });

  return new Footer({
    children: [
      new Table({
        width: { size: cols[0]! + cols[1]!, type: WidthType.DXA },
        columnWidths: cols,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: SEM_BORDAS,
                width: { size: cols[0]!, type: WidthType.DXA },
                shading: { fill: LARANJA, type: ShadingType.CLEAR },
                margins: { top: 40, bottom: 40, left: 0, right: 0 },
                children: [new Paragraph({ children: [] })],
              }),
              new TableCell({
                borders: SEM_BORDAS,
                width: { size: cols[1]!, type: WidthType.DXA },
                shading: { fill: GRAFITE, type: ShadingType.CLEAR },
                margins: { top: 60, bottom: 60, left: 200, right: 120 },
                children: [
                  linha(CONTATO_HTECH.endereco),
                  linha(CONTATO_HTECH.contatos),
                  ...(nota ? [linha(nota, { size: 12, color: "D9D3D0" })] : []),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Margens da seção compatíveis com o cabeçalho/rodapé do timbrado. */
export const MARGENS_TIMBRADO = {
  top: 1900,
  right: 1000,
  bottom: 1500,
  left: 1000,
  header: 500,
  footer: 300,
};
