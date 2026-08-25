import { normalizarCodigoSef } from "./municipioArquivo";
import { nomeMunicipioSef } from "./municipiosSef";

export type MunicipioCadastro = { id: string; nome: string; uf: string; codigo_sef: string };

export type ResolucaoMunicipio = {
  /** Código SEF normalizado ("641"), ou null quando não foi possível detectar. */
  codigo: string | null;
  /** Nome oficial na tabela da SEF-MG. */
  nomeOficial: string | null;
  /** Nome que deve aparecer na interface (oficial vence o do arquivo). */
  nomeExibicao: string | null;
  /** Cadastro existente com o mesmo código SEF. */
  cadastrado: MunicipioCadastro | null;
  /** O cadastro existe mas está com nome diferente do oficial. */
  nomeDivergente: boolean;
  /** Rótulo pronto: "São Pedro dos Ferros (código 641)". */
  rotulo: string | null;
};

function mesmoNome(a: string, b: string) {
  const limpar = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  return limpar(a) === limpar(b);
}

/**
 * Identidade da prefeitura de um arquivo: o nome oficial do código SEF sempre
 * vence o nome digitado no cadastro e o nome trazido no arquivo, para que um
 * cadastro com nome errado não aponte para o município errado.
 */
export function resolverMunicipioDoArquivo(params: {
  codigo: string | null | undefined;
  nomeArquivo?: string | null;
  municipios: MunicipioCadastro[];
}): ResolucaoMunicipio {
  const codigo = normalizarCodigoSef(params.codigo ?? null);
  if (!codigo) {
    return {
      codigo: null,
      nomeOficial: null,
      nomeExibicao: null,
      cadastrado: null,
      nomeDivergente: false,
      rotulo: null,
    };
  }
  const nomeOficial = nomeMunicipioSef(codigo);
  const nomeExibicao = nomeOficial ?? params.nomeArquivo?.trim() ?? null;
  const cadastrado =
    params.municipios.find((m) => normalizarCodigoSef(m.codigo_sef) === codigo) ?? null;
  const nomeDivergente = !!cadastrado && !!nomeOficial && !mesmoNome(cadastrado.nome, nomeOficial);
  return {
    codigo,
    nomeOficial,
    nomeExibicao,
    cadastrado,
    nomeDivergente,
    rotulo: nomeExibicao ? `${nomeExibicao} (código ${codigo})` : `código ${codigo}`,
  };
}
