/** Exporta um gráfico Recharts (SVG dentro de um container) como SVG ou PNG. */

function svgSerializado(container: HTMLElement): { texto: string; largura: number; altura: number } | null {
  const svg = container.querySelector("svg");
  if (!svg) return null;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const largura = Math.max(1, Math.round(rect.width));
  const altura = Math.max(1, Math.round(rect.height));

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(largura));
  clone.setAttribute("height", String(altura));

  // Resolve tokens CSS (var(--...)) em valores concretos para o arquivo ficar autônomo.
  const estiloRaiz = getComputedStyle(document.documentElement);
  const origem = svg.querySelectorAll("*");
  clone.querySelectorAll("*").forEach((el, i) => {
    const ref = origem[i];
    if (!ref) return;
    const cs = getComputedStyle(ref as Element);
    for (const prop of ["fill", "stroke", "stroke-width", "font-size", "font-family", "opacity"]) {
      const v = cs.getPropertyValue(prop);
      if (v && v !== "none") el.setAttribute(prop, v.trim());
    }
  });

  const fundo = estiloRaiz.getPropertyValue("--card").trim() || "#ffffff";
  const texto =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">` +
    `<rect width="100%" height="100%" fill="${fundo}"/>` +
    clone.innerHTML +
    `</svg>`;

  return { texto, largura, altura };
}

function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function baixarGraficoSvg(container: HTMLElement | null, nomeArquivo: string) {
  if (!container) return false;
  const dados = svgSerializado(container);
  if (!dados) return false;
  baixarBlob(nomeArquivo, new Blob([dados.texto], { type: "image/svg+xml;charset=utf-8" }));
  return true;
}

export async function baixarGraficoPng(
  container: HTMLElement | null,
  nomeArquivo: string,
  escala = 2,
) {
  if (!container) return false;
  const dados = svgSerializado(container);
  if (!dados) return false;

  const url = URL.createObjectURL(new Blob([dados.texto], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Falha ao renderizar o gráfico"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = dados.largura * escala;
    canvas.height = dados.altura * escala;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(escala, escala);
    ctx.drawImage(img, 0, 0, dados.largura, dados.altura);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return false;
    baixarBlob(nomeArquivo, blob);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
