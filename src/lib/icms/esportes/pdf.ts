import type { PaginaTexto, LinhaPos } from "./parser";

let workerConfigurado = false;

async function carregarPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !workerConfigurado) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    workerConfigurado = true;
  }
  return pdfjs;
}

/**
 * Lê o PDF página a página e devolve as linhas de texto com a coordenada
 * vertical de cada uma (necessária para juntar nomes de município quebrados
 * em várias linhas no ranking).
 */
export async function extrairPaginas(
  dados: ArrayBuffer | Uint8Array,
  aoProgredir?: (pagina: number, total: number) => void,
): Promise<PaginaTexto[]> {
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({
    data: dados instanceof Uint8Array ? dados : new Uint8Array(dados),
    useSystemFonts: false,
  }).promise;

  const paginas: PaginaTexto[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const conteudo = await page.getTextContent();
    const porLinha = new Map<number, { y: number; itens: { x: number; texto: string }[] }>();

    for (const item of conteudo.items as { str?: string; transform?: number[] }[]) {
      const texto = item.str ?? "";
      if (!texto.trim()) continue;
      const x = item.transform?.[4] ?? 0;
      const y = item.transform?.[5] ?? 0;
      const chave = Math.round(y / 3);
      const linha = porLinha.get(chave) ?? { y, itens: [] };
      linha.itens.push({ x, texto });
      porLinha.set(chave, linha);
    }

    const linhas: LinhaPos[] = [...porLinha.values()]
      .sort((a, b) => b.y - a.y)
      .map((l) => ({
        y: l.y,
        texto: l.itens
          .sort((a, b) => a.x - b.x)
          .map((i) => i.texto)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((l) => l.texto.length > 0);

    paginas.push({ pagina: n, linhas });
    page.cleanup();
    aoProgredir?.(n, doc.numPages);
  }

  await doc.cleanup();
  return paginas;
}
