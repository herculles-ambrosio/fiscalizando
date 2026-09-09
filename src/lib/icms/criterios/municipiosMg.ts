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
/**
 * Índice tolerante à grafia antiga com "h" ("São Thomé das Letras" no relatório
 * de Turismo x "São Tomé das Letras" na relação oficial). Conferido: nenhuma
 * colisão entre os 853 municípios.
 */
const INDICE_SEM_H = new Map<string, string>();
for (const nome of Object.values(MUNICIPIOS_SEF)) {
  INDICE.set(apenasLetras(nome), nome);
  INDICE_SEM_H.set(apenasLetras(nome).replace(/H/g, ""), nome);
}

export type MunicipioOficial = { chave: string; nome: string };

/** Relação oficial dos municípios mineiros, em ordem alfabética. */
export const MUNICIPIOS_MG: MunicipioOficial[] = [
  ...new Map(
    Object.values(MUNICIPIOS_SEF).map((nome) => [
      normalizarMunicipio(nome),
      { chave: normalizarMunicipio(nome), nome },
    ]),
  ).values(),
].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));


/**
 * Correspondência exata (sem tentar cortar sobras): usada quando o texto lido
 * pode conter, na mesma linha, o município e outra informação — caso do
 * relatório de Turismo, em que o circuito turístico vem logo depois do nome.
 */
export function municipioExato(nomeLido: string): MunicipioOficial | null {
  const chave = apenasLetras(nomeLido);
  const oficial = INDICE.get(chave) ?? INDICE_SEM_H.get(chave.replace(/H/g, ""));
  return oficial ? { chave: normalizarMunicipio(oficial), nome: oficial } : null;
}



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
