import { nomeArquivoSeguro } from "./texto";

export type ConfiguracaoMunicipio = {
  nome_prefeitura: string;
  estado: string;
  secretaria: string;
  setor: string;
  endereco_rodape: string;
  cidade_data: string;
  signatario_nome: string;
  signatario_cargo: string;
  texto_assinatura: string;
};

export type BrasaoImagem = {
  dados: Uint8Array;
  tipo: "png" | "jpg";
};

export type ContribuinteOficio = {
  nome: string | null;
  cnpj: string | null;
  inscricao_estadual: string;
  endereco: string | null;
};

export function nomeArquivoOficio(contribuinte: ContribuinteOficio): string {
  const cnpj = (contribuinte.cnpj ?? contribuinte.inscricao_estadual).replace(/\D/g, "");
  return `${cnpj}_${nomeArquivoSeguro(contribuinte.nome ?? "contribuinte")}.docx`;
}
