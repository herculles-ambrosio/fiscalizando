/**
 * Notificações do módulo Empresas. Usa o mesmo formato de texto dos ofícios
 * do Apura VAF (# centralizado, > citação, * Rótulo: valor) e o mesmo gerador
 * de DOCX (brasão, cabeçalho, assinatura e rodapé das Configurações).
 */

import JSZip from "jszip";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import type { ModeloOficio } from "@/lib/oficios/modelos";
import type { BrasaoImagem, ConfiguracaoMunicipio } from "@/lib/oficios/zerados";
import { nomeArquivoSeguro } from "@/lib/oficios/texto";
import { formatarCnpj } from "@/lib/format";

export const OBSERVACOES_NOTIFICACAO = {
  ATIVA_SEM_CADASTRO: "Ativa na Receita e sem cadastro na prefeitura",
} as const;
export type ObservacaoNotificacao = keyof typeof OBSERVACOES_NOTIFICACAO;

export type ModeloEmpresa = {
  id?: string;
  chave: string;
  nome: string;
  observacao: ObservacaoNotificacao;
  titulo: string;
  corpo: string;
  ativo: boolean;
  margem_topo?: number;
  margem_direita?: number;
  margem_inferior?: number;
  margem_esquerda?: number;
  cabecalho?: string | null;
  rodape?: string | null;
};

export type EmpresaNotificada = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  municipio_nome?: string | null;
  uf?: string | null;
  cnae_principal?: string | null;
  cnae_descricao?: string | null;
  situacao?: string | null;
  data_inicio?: string | null;
};

export const PLACEHOLDERS_EMPRESA: { chave: string; descricao: string }[] = [
  { chave: "{{contribuinte}}", descricao: "Razão social da empresa" },
  { chave: "{{nome_fantasia}}", descricao: "Nome fantasia" },
  { chave: "{{cnpj}}", descricao: "CNPJ formatado" },
  { chave: "{{endereco}}", descricao: "Endereço completo da empresa" },
  { chave: "{{atividade}}", descricao: "CNAE principal e descrição" },
  { chave: "{{situacao}}", descricao: "Situação cadastral na Receita" },
  { chave: "{{data_inicio}}", descricao: "Data de início de atividade" },
  { chave: "{{prazo_dias}}", descricao: "Prazo em dias para regularizar" },
  { chave: "{{prefeitura}}", descricao: "Nome da prefeitura" },
  { chave: "{{municipio}}", descricao: "Município" },
  { chave: "{{cidade_data}}", descricao: "Cidade/UF do cabeçalho da data" },
  { chave: "{{data_extenso}}", descricao: "Data do documento por extenso" },
];

export function enderecoEmpresa(e: EmpresaNotificada): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const partes = [rua, e.complemento, e.bairro, e.municipio_nome && `${e.municipio_nome}${e.uf ? `/${e.uf}` : ""}`, e.cep && `CEP ${e.cep}`];
  return partes.filter(Boolean).join(" - ") || "—";
}

function dataBr(iso?: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Substitui os campos próprios da empresa; os gerais ficam para o gerador do ofício. */
export function aplicarPlaceholdersEmpresa(texto: string, e: EmpresaNotificada, prazoDias: number): string {
  const mapa: Record<string, string> = {
    contribuinte: e.razao_social || "—",
    nome_fantasia: e.nome_fantasia || "—",
    cnpj: formatarCnpj(e.cnpj),
    endereco: enderecoEmpresa(e),
    atividade: [e.cnae_principal, e.cnae_descricao].filter(Boolean).join(" - ") || "—",
    situacao: e.situacao || "—",
    data_inicio: dataBr(e.data_inicio),
    prazo_dias: String(prazoDias),
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, chave: string) => mapa[chave.toLowerCase()] ?? todo);
}

const CORPO_ATIVA_SEM_CADASTRO = `* Contribuinte: {{contribuinte}}
* CNPJ: {{cnpj}}
* Endereço: {{endereco}}
* Atividade principal: {{atividade}}
* Situação na Receita Federal: {{situacao}}

A Fazenda Pública Municipal de {{municipio}}, no exercício de suas atribuições de fiscalização, verificou que a empresa acima identificada consta como ATIVA no Cadastro Nacional da Pessoa Jurídica da Receita Federal, com endereço neste município, porém NÃO POSSUI INSCRIÇÃO no Cadastro Econômico Municipal.

> O exercício de atividade econômica no território do município exige a prévia inscrição no cadastro mobiliário municipal, conforme a legislação tributária municipal.

Fica V. Sa. NOTIFICADA a, no prazo de {{prazo_dias}} dias contados do recebimento deste, comparecer ao setor de Tributação desta Prefeitura para promover a inscrição municipal, apresentando o contrato social ou documento equivalente, o cartão CNPJ e o comprovante de endereço, ou justificar por escrito a inexistência de atividade no município.

O não atendimento no prazo poderá ensejar a inscrição de ofício e a aplicação das penalidades previstas na legislação municipal.

Permanecemos à disposição para os esclarecimentos necessários.

Atenciosamente.`;

export const MODELOS_EMPRESA_PADRAO: ModeloEmpresa[] = [
  {
    chave: "ativa_sem_cadastro",
    nome: "Notificação de inscrição no cadastro municipal",
    observacao: "ATIVA_SEM_CADASTRO",
    titulo: "NOTIFICAÇÃO PARA INSCRIÇÃO NO CADASTRO ECONÔMICO MUNICIPAL",
    corpo: CORPO_ATIVA_SEM_CADASTRO,
    ativo: true,
  },
];

export function novaChaveEmpresa(): string {
  return `personalizado_${Date.now().toString(36)}`;
}

export type ParametrosNotificacao = {
  modelo: ModeloEmpresa;
  empresa: EmpresaNotificada;
  prazoDias: number;
  config: ConfiguracaoMunicipio;
  dataDocumento: string;
  brasao?: BrasaoImagem | null;
};

export function comoModeloOficio(modelo: ModeloEmpresa, e: EmpresaNotificada, prazo: number): ModeloOficio {
  const s = (t: string | null | undefined) => (t == null ? null : aplicarPlaceholdersEmpresa(t, e, prazo));
  return {
    chave: modelo.chave,
    nome: modelo.nome,
    situacao: "GERAL",
    titulo: aplicarPlaceholdersEmpresa(modelo.titulo, e, prazo),
    corpo: aplicarPlaceholdersEmpresa(modelo.corpo, e, prazo),
    ativo: modelo.ativo,
    ...(modelo.margem_topo != null ? { margem_topo: modelo.margem_topo } : {}),
    ...(modelo.margem_direita != null ? { margem_direita: modelo.margem_direita } : {}),
    ...(modelo.margem_inferior != null ? { margem_inferior: modelo.margem_inferior } : {}),
    ...(modelo.margem_esquerda != null ? { margem_esquerda: modelo.margem_esquerda } : {}),
    cabecalho: s(modelo.cabecalho),
    rodape: s(modelo.rodape),
  };
}

export async function gerarDocxNotificacao(p: ParametrosNotificacao): Promise<Blob> {
  return gerarDocxOficio({
    modelo: comoModeloOficio(p.modelo, p.empresa, p.prazoDias),
    contribuinte: {
      nome: p.empresa.razao_social,
      cnpj: p.empresa.cnpj,
      inscricao_estadual: "",
      endereco: enderecoEmpresa(p.empresa),
    },
    config: p.config,
    exercicio: new Date(p.dataDocumento).getFullYear(),
    dataOficio: p.dataDocumento,
    brasao: p.brasao ?? null,
  });
}

export function nomeArquivoNotificacao(chave: string, e: EmpresaNotificada): string {
  return `${nomeArquivoSeguro(chave, 30)}_${e.cnpj}_${nomeArquivoSeguro(e.razao_social ?? "empresa", 40)}.docx`;
}

export async function gerarZipNotificacoes(docs: { nome: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const d of docs) {
    let nome = d.nome;
    for (let i = 2; usados.has(nome); i++) nome = d.nome.replace(/\.docx$/, `_${i}.docx`);
    usados.add(nome);
    zip.file(nome, d.blob);
  }
  return zip.generateAsync({ type: "blob" });
}

/** Empresas ativas na Receita cujo CNPJ não aparece no cadastro da prefeitura. */
export function ativasSemCadastro<E extends { cnpj: string; situacao: string | null }>(
  empresas: E[],
  prefeitura: { documento: string; tipo_documento: string }[],
): E[] {
  const cnpjs = new Set(prefeitura.filter((p) => p.tipo_documento === "CNPJ").map((p) => p.documento));
  return empresas.filter((e) => e.situacao === "ATIVA" && !cnpjs.has(e.cnpj));
}
