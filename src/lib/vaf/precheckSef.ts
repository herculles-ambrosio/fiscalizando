import { normalizarCodigoSef } from "./municipioArquivo";
import { nomeMunicipioSef } from "./municipiosSef";
import type { MunicipioCadastro } from "./resolverMunicipio";

export type DivergenciaSef = {
  id: string;
  codigo: string;
  nomeCadastrado: string;
  nomeOficial: string;
  /** Ação sugerida em linguagem direta. */
  acaoSugerida: string;
};

function limpar(v: string) {
  return v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Pré-check de códigos SEF: lista todos os cadastros cujo nome difere do nome
 * oficial da tabela da SEF-MG, com a ação sugerida para cada um.
 */
export function divergenciasSef(municipios: MunicipioCadastro[]): DivergenciaSef[] {
  const lista: DivergenciaSef[] = [];
  for (const m of municipios) {
    const codigo = normalizarCodigoSef(m.codigo_sef);
    if (!codigo) continue;
    const oficial = nomeMunicipioSef(codigo);
    if (!oficial) continue;
    if (limpar(m.nome) === limpar(oficial)) continue;
    lista.push({
      id: m.id,
      codigo,
      nomeCadastrado: m.nome,
      nomeOficial: oficial,
      acaoSugerida: `Aplicar o nome oficial "${oficial}" ao código ${codigo}`,
    });
  }
  return lista.sort((a, b) => a.codigo.localeCompare(b.codigo));
}
