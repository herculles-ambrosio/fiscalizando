/**
 * Documentos próprios de cada prefeitura: modelos que só existem para um
 * município e podem ser emitidos para um destinatário digitado ou para um
 * registro do módulo (cartório, empresa ou contribuinte).
 */

import JSZip from "jszip";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import type { ModeloOficio } from "@/lib/oficios/modelos";
import type { BrasaoImagem, ConfiguracaoMunicipio } from "@/lib/oficios/zerados";
import { nomeArquivoSeguro } from "@/lib/oficios/texto";

export type ModuloDocumento = "cartorios" | "empresas" | "vaf";
export type DestinatarioModelo = "livre" | "dados" | "ambos";

export const ROTULO_DESTINATARIO: Record<DestinatarioModelo, string> = {
  livre: "Destinatário digitado",
  dados: "Registro do módulo",
  ambos: "Digitado ou do módulo",
};

export type ModeloPrefeitura = {
  id?: string;
  modulo: ModuloDocumento;
  chave: string;
  nome: string;
  destinatario: DestinatarioModelo;
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

/** Destinatário do documento: digitado na hora ou vindo dos dados do módulo. */
export type FonteDestinatario = {
  id: string;
  nome: string;
  documento: string;
  endereco: string;
  detalhe?: string | undefined;
  campos?: Record<string, string>;
};

export const PLACEHOLDERS_GERAIS: { chave: string; descricao: string }[] = [
  { chave: "{{destinatario}}", descricao: "Nome do destinatário" },
  { chave: "{{documento}}", descricao: "CNPJ, CPF, CNS ou inscrição do destinatário" },
  { chave: "{{endereco}}", descricao: "Endereço do destinatário" },
  { chave: "{{prazo_dias}}", descricao: "Prazo em dias" },
  { chave: "{{prefeitura}}", descricao: "Nome da prefeitura" },
  { chave: "{{municipio}}", descricao: "Município" },
  { chave: "{{cidade_data}}", descricao: "Cidade/UF do cabeçalho da data" },
  { chave: "{{data_extenso}}", descricao: "Data do documento por extenso" },
];

export function novoModeloPrefeitura(modulo: ModuloDocumento): ModeloPrefeitura {
  return {
    modulo,
    chave: `proprio_${Date.now().toString(36)}`,
    nome: "Novo documento da prefeitura",
    destinatario: "ambos",
    titulo: "NOTIFICAÇÃO",
    corpo: `* Destinatário: {{destinatario}}
* Documento: {{documento}}
* Endereço: {{endereco}}

A Prefeitura de {{municipio}} NOTIFICA o destinatário acima a, no prazo de {{prazo_dias}} dias, ...

Atenciosamente.`,
    ativo: true,
  };
}

/** Substitui os campos do destinatário; os gerais da prefeitura ficam para o gerador do ofício. */
export function aplicarCamposDestinatario(texto: string, d: FonteDestinatario, prazoDias: number): string {
  const mapa: Record<string, string> = {
    ...(d.campos ?? {}),
    destinatario: d.nome || "—",
    documento: d.documento || "—",
    endereco: d.endereco || "—",
    prazo_dias: String(prazoDias),
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, chave: string) => {
    const v = mapa[chave.toLowerCase()];
    return v === undefined ? todo : v;
  });
}

export async function gerarDocxPrefeitura(p: {
  modelo: ModeloPrefeitura;
  destinatario: FonteDestinatario;
  prazoDias: number;
  config: ConfiguracaoMunicipio;
  dataDocumento: string;
  brasao: BrasaoImagem | null;
}): Promise<Blob> {
  const { modelo, destinatario: d, prazoDias } = p;
  const s = (t: string) => aplicarCamposDestinatario(t, d, prazoDias);
  const oficio: ModeloOficio = {
    chave: modelo.chave,
    nome: modelo.nome,
    situacao: "GERAL",
    titulo: s(modelo.titulo),
    corpo: s(modelo.corpo),
    ativo: modelo.ativo,
    margem_topo: modelo.margem_topo ?? 1.9,
    margem_direita: modelo.margem_direita ?? 1.9,
    margem_inferior: modelo.margem_inferior ?? 1.9,
    margem_esquerda: modelo.margem_esquerda ?? 1.9,
    cabecalho: modelo.cabecalho ? s(modelo.cabecalho) : null,
    rodape: modelo.rodape ? s(modelo.rodape) : null,
  };
  const digitos = d.documento.replace(/\D/g, "");
  return gerarDocxOficio({
    modelo: oficio,
    contribuinte: {
      nome: d.nome,
      cnpj: digitos.length === 14 ? digitos : null,
      inscricao_estadual: d.documento,
      endereco: d.endereco,
    },
    config: p.config,
    exercicio: Number(p.dataDocumento.slice(0, 4)) || new Date().getFullYear(),
    dataOficio: p.dataDocumento,
    brasao: p.brasao,
  });
}

export function nomeArquivoPrefeitura(chave: string, d: FonteDestinatario): string {
  return `${nomeArquivoSeguro(chave, 30)}_${nomeArquivoSeguro(d.documento || "sem_doc", 20)}_${nomeArquivoSeguro(d.nome, 40)}.docx`;
}

export async function zipDocumentos(docs: { nome: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const doc of docs) {
    let nome = doc.nome;
    for (let i = 2; usados.has(nome); i++) nome = doc.nome.replace(/\.docx$/, `_${i}.docx`);
    usados.add(nome);
    zip.file(nome, doc.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
