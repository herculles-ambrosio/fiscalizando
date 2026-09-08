/**
 * Conferência dos nomes de município lidos dos PDFs contra a relação oficial
 * dos 853 municípios mineiros.
 *
 * Os PDFs da SEMAD/IEF vêm com o texto quebrado ("Mar liéria", "Port al Sul"),
 * o que gerava municípios duplicados e linhas inexistentes no ranking. Aqui a
 * comparação é feita só pelas letras (sem espaços, acentos ou pontuação), de
 * modo que "Mar liéria" volta a ser "Marliéria" e o que não corresponde a
 * nenhum município é descartado.
 */

import { MUNICIPIOS_SEF } from "@/lib/vaf/municipiosSef";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";

function apenasLetras(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

const INDICE = new Map<string, string>();
for (const nome of Object.values(MUNICIPIOS_SEF)) {
  INDICE.set(apenasLetras(nome), nome);
}

export type MunicipioOficial = { chave: string; nome: string };

/**
 * Devolve o município oficial correspondente ao nome lido, ou `null` quando o
 * texto não é um município (cabeçalho, sigla, sobra de tabela).
 */
export function canonicalizarMunicipio(nomeLido: string): MunicipioOficial | null {
  const bruto = nomeLido.replace(/\s+/g, " ").trim();
  if (!bruto) return null;

  const tentar = (texto: string): MunicipioOficial | null => {
    const oficial = INDICE.get(apenasLetras(texto));
    return oficial ? { chave: normalizarMunicipio(oficial), nome: oficial } : null;
  };

  const direto = tentar(bruto);
  if (direto) return direto;

  // Sobras coladas ao fim do nome ("Marliéria Alterada", "Timóteo Total").
  const palavras = bruto.split(" ");
  for (let corte = palavras.length - 1; corte >= 2; corte--) {
    const achou = tentar(palavras.slice(0, corte).join(" "));
    if (achou) return achou;
  }
  // Sobras coladas ao início do nome.
  for (let inicio = 1; inicio <= palavras.length - 2; inicio++) {
    const achou = tentar(palavras.slice(inicio).join(" "));
    if (achou) return achou;
  }
  return null;
}
