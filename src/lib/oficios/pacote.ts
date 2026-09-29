import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import {
  nomeArquivoOficio,
  type BrasaoImagem,
  type ConfiguracaoMunicipio,
  type ContribuinteOficio,
} from "./zerados";
import { gerarDocxOficio } from "./documento";
import type { ModeloOficio } from "./modelos";
import { nomeArquivoSeguro } from "./texto";

export async function carregarBrasao(path: string | null): Promise<BrasaoImagem | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("brasoes").download(path);
  if (error || !data) return null;
  const buffer = new Uint8Array(await data.arrayBuffer());
  const tipo: BrasaoImagem["tipo"] = path.toLowerCase().endsWith(".png") ? "png" : "jpg";
  return { dados: buffer, tipo };
}

export type ProgressoOficios = {
  fase: "documentos" | "compactando" | "concluido";
  feitos: number;
  total: number;
  nomeAtual?: string | undefined;
};

const respirar = () => new Promise((r) => setTimeout(r, 0));

export async function gerarZipOficios(params: {
  contribuintes: ContribuinteOficio[];
  modelo: ModeloOficio;
  config: ConfiguracaoMunicipio;
  exercicio: number;
  anoAplicacao?: number | null;
  dataOficio: string;
  brasaoPath: string | null;
  onProgresso?: (p: ProgressoOficios) => void;
}): Promise<Blob> {
  const {
    contribuintes,
    modelo,
    config,
    exercicio,
    anoAplicacao,
    dataOficio,
    brasaoPath,
    onProgresso,
  } = params;
  const total = contribuintes.length;
  const brasao = await carregarBrasao(brasaoPath);
  const zip = new JSZip();
  const usados = new Set<string>();

  onProgresso?.({ fase: "documentos", feitos: 0, total });

  for (let i = 0; i < contribuintes.length; i += 1) {
    const contribuinte = contribuintes[i]!;
    const blob = await gerarDocxOficio({
      contribuinte,
      modelo,
      config,
      exercicio,
      anoAplicacao,
      dataOficio,
      brasao,
    });
    let nome = nomeArquivoOficio(contribuinte);
    let sufixo = 2;
    while (usados.has(nome)) {
      nome = nomeArquivoOficio(contribuinte).replace(/\.docx$/, `_${sufixo}.docx`);
      sufixo += 1;
    }
    usados.add(nome);
    zip.file(nome, blob);
    onProgresso?.({
      fase: "documentos",
      feitos: i + 1,
      total,
      nomeAtual: contribuinte.nome ?? undefined,
    });
    // devolve o controle ao navegador para a barra de progresso repintar
    if (i % 5 === 0) await respirar();
  }

  onProgresso?.({ fase: "compactando", feitos: 0, total: 100 });
  const zipBlob = await zip.generateAsync({ type: "blob" }, (meta) => {
    onProgresso?.({ fase: "compactando", feitos: Math.round(meta.percent), total: 100 });
  });
  onProgresso?.({ fase: "concluido", feitos: total, total });
  return zipBlob;
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function nomeZip(chaveModelo: string, cidade: string, exercicio: number): string {
  return `oficios_${nomeArquivoSeguro(chaveModelo)}_${nomeArquivoSeguro(cidade)}_${exercicio}.zip`;
}
