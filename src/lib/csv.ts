/** Helpers para exportar exatamente o que está visível na tela em CSV. */

function celula(valor: unknown): string {
  const texto = valor == null ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

export function montarCsv(cabecalho: string[], linhas: unknown[][]): string {
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\n");
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
