const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2025-11-03" -> "03 de novembro de 2025" */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia} de ${MESES[Number(mes) - 1]} de ${ano}`;
}

export function hojeIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Remove acentos e caracteres inválidos para nome de arquivo. */
export function nomeArquivoSeguro(texto: string, maximo = 60): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 _-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, maximo) || "documento"
  );
}
