/**
 * Gera os documentos de fiscalização de cartório em DOCX, reaproveitando o
 * mesmo layout (brasão, cabeçalho, margens, assinatura e rodapé) dos ofícios
 * do Apura VAF.
 */

import JSZip from "jszip";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import type { ModeloOficio } from "@/lib/oficios/modelos";
import type { BrasaoImagem, ConfiguracaoMunicipio } from "@/lib/oficios/zerados";
import { nomeArquivoSeguro } from "@/lib/oficios/texto";
import {
  aplicarPlaceholdersCartorio,
  type DadosDocumentoCartorio,
  type ModeloCartorio,
} from "./modelos";

export type ParametrosDocCartorio = DadosDocumentoCartorio & {
  modelo: ModeloCartorio;
  config: ConfiguracaoMunicipio;
  dataDocumento: string;
  brasao?: BrasaoImagem | null;
};

function comoModeloOficio(modelo: ModeloCartorio, dados: DadosDocumentoCartorio): ModeloOficio {
  const s = (t: string | null | undefined) =>
    t == null ? t : aplicarPlaceholdersCartorio(t, dados);
  return {
    chave: modelo.chave,
    nome: modelo.nome,
    situacao: "GERAL",
    titulo: aplicarPlaceholdersCartorio(modelo.titulo, dados),
    corpo: aplicarPlaceholdersCartorio(modelo.corpo, dados),
    ativo: modelo.ativo,
    ...(modelo.margem_topo != null ? { margem_topo: modelo.margem_topo } : {}),
    ...(modelo.margem_direita != null ? { margem_direita: modelo.margem_direita } : {}),
    ...(modelo.margem_inferior != null ? { margem_inferior: modelo.margem_inferior } : {}),
    ...(modelo.margem_esquerda != null ? { margem_esquerda: modelo.margem_esquerda } : {}),
    cabecalho: s(modelo.cabecalho) ?? null,
    rodape: s(modelo.rodape) ?? null,
  };
}

export async function gerarDocxCartorio(params: ParametrosDocCartorio): Promise<Blob> {
  const { modelo, config, dataDocumento, brasao, ...dados } = params;
  return gerarDocxOficio({
    modelo: comoModeloOficio(modelo, dados),
    contribuinte: {
      nome: dados.linha.nome,
      cnpj: null,
      inscricao_estadual: dados.linha.cns,
      endereco: dados.linha.comarca,
    },
    config,
    exercicio: dados.competencia.ano,
    dataOficio: dataDocumento,
    brasao: brasao ?? null,
  });
}

export function nomeArquivoDocCartorio(
  chaveModelo: string,
  cns: string,
  nome: string,
  competencia: { ano: number; mes: number },
): string {
  const mes = String(competencia.mes).padStart(2, "0");
  return `${nomeArquivoSeguro(chaveModelo, 30)}_${mes}${competencia.ano}_${cns}_${nomeArquivoSeguro(nome, 40)}.docx`;
}

export async function gerarZipCartorio(
  documentos: { nome: string; blob: Blob }[],
): Promise<Blob> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const doc of documentos) {
    let nome = doc.nome;
    let i = 2;
    while (usados.has(nome)) {
      nome = doc.nome.replace(/\.docx$/, `_${i}.docx`);
      i += 1;
    }
    usados.add(nome);
    zip.file(nome, doc.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
