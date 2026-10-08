/** Modelos de notificação do Fiscaliza Banco (mesmo formato de texto dos Ofícios). */

import JSZip from "jszip";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import type { ModeloOficio } from "@/lib/oficios/modelos";
import type { BrasaoImagem, ConfiguracaoMunicipio } from "@/lib/oficios/zerados";
import { nomeArquivoSeguro } from "@/lib/oficios/texto";
import { formatarCnpj, formatarMoeda } from "@/lib/format";

export type ModeloBanco = {
  id?: string;
  chave: string;
  nome: string;
  tipo: string;
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

export type DadosNotificacaoBanco = {
  nome: string;
  cnpj: string;
  competencia: string;
  contas: string;
  issDiferenca: number;
  baseDeclarada: number;
  receitaBc: number;
  prazoDias: number;
};

export const PLACEHOLDERS_BANCO = [
  { chave: "{{banco}}", descricao: "Nome da instituição" },
  { chave: "{{cnpj}}", descricao: "CNPJ" },
  { chave: "{{competencia}}", descricao: "Período analisado" },
  { chave: "{{contas}}", descricao: "Contas COSIF com indício" },
  { chave: "{{iss_diferenca}}", descricao: "ISS que deixou de ser declarado" },
  { chave: "{{base_declarada}}", descricao: "Base declarada no período" },
  { chave: "{{receita_bc}}", descricao: "Receita informada ao Banco Central" },
  { chave: "{{prazo_dias}}", descricao: "Prazo em dias" },
  { chave: "{{prefeitura}}", descricao: "Nome da prefeitura" },
  { chave: "{{municipio}}", descricao: "Município" },
  { chave: "{{cidade_data}}", descricao: "Cidade/UF da data" },
  { chave: "{{data_extenso}}", descricao: "Data por extenso" },
];

export function aplicarPlaceholdersBanco(texto: string, d: DadosNotificacaoBanco): string {
  const mapa: Record<string, string> = {
    banco: d.nome,
    cnpj: d.cnpj.length === 14 ? formatarCnpj(d.cnpj) : d.cnpj,
    competencia: d.competencia,
    contas: d.contas || "—",
    iss_diferenca: formatarMoeda(d.issDiferenca),
    base_declarada: formatarMoeda(d.baseDeclarada),
    receita_bc: formatarMoeda(d.receitaBc),
    prazo_dias: String(d.prazoDias),
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, k: string) => mapa[k.toLowerCase()] ?? todo);
}

const IDENT = `* Instituição: {{banco}}
* CNPJ: {{cnpj}}
* Período: {{competencia}}
`;
const FECHO = `Permanecemos à disposição para os esclarecimentos necessários.

Atenciosamente.`;

export const MODELOS_BANCO_PADRAO: ModeloBanco[] = [
  {
    chave: "desif_completa",
    nome: "Pedido de apresentação da DES-IF completa",
    tipo: "DESIF",
    titulo: "NOTIFICAÇÃO PARA APRESENTAÇÃO DA DES-IF",
    corpo: `${IDENT}
A Fazenda Pública Municipal de {{municipio}}, no exercício da fiscalização do ISSQN incidente sobre os serviços prestados por instituições financeiras (itens 15.01 a 15.18 da lista anexa à Lei Complementar nº 116/2003), solicita a apresentação, no prazo de {{prazo_dias}} dias, da Declaração Eletrônica de Serviços de Instituições Financeiras (DES-IF) referente ao período acima, contendo:

* Módulo 1: Balancete Analítico Mensal
* Módulo 2: Plano Geral de Contas Comentado (PGCC)
* Módulo 3: Demonstrativo da receita tributável por subtítulo COSIF

A ausência ou incompletude da declaração autoriza o arbitramento da base de cálculo e a aplicação das penalidades previstas na legislação municipal.

${FECHO}`,
    ativo: true,
  },
  {
    chave: "contas_nao_tributadas",
    nome: "Contas tributáveis declaradas como não tributáveis",
    tipo: "COSIF",
    titulo: "NOTIFICAÇÃO FISCAL — RECEITAS DE SERVIÇOS NÃO TRIBUTADAS",
    corpo: `${IDENT}
Na análise das contas de resultado declaradas por essa instituição, verificou-se que as contas abaixo, do grupo de rendas de prestação de serviços do COSIF (7.1.7), foram classificadas como não tributáveis ou tributadas com alíquota inferior à prevista:

{{contas}}

* ISSQN apurado a menor: {{iss_diferenca}}

Fica V. Sa. NOTIFICADA a, no prazo de {{prazo_dias}} dias, recolher a diferença com os acréscimos legais ou apresentar justificativa documentada para a classificação adotada.

${FECHO}`,
    ativo: true,
  },
  {
    chave: "divergencia_bc",
    nome: "Esclarecimento sobre divergência com o Banco Central",
    tipo: "BC",
    titulo: "PEDIDO DE ESCLARECIMENTO — DIVERGÊNCIA DE RECEITAS",
    corpo: `${IDENT}
Os dados públicos do Banco Central do Brasil (ESTBAN e IF.data) indicam, para as dependências dessa instituição neste município, receitas de {{receita_bc}} no período, enquanto a base de cálculo do ISSQN declarada foi de {{base_declarada}}.

Solicitamos, no prazo de {{prazo_dias}} dias, a apresentação de esclarecimentos e dos documentos que demonstrem a composição da receita tributável declarada.

${FECHO}`,
    ativo: true,
  },
];

export function comoModeloOficio(m: ModeloBanco, d: DadosNotificacaoBanco): ModeloOficio {
  const s = (t: string | null | undefined) => (t == null ? null : aplicarPlaceholdersBanco(t, d));
  return {
    chave: m.chave, nome: m.nome, situacao: "GERAL",
    titulo: aplicarPlaceholdersBanco(m.titulo, d), corpo: aplicarPlaceholdersBanco(m.corpo, d), ativo: m.ativo,
    ...(m.margem_topo != null ? { margem_topo: m.margem_topo } : {}),
    ...(m.margem_direita != null ? { margem_direita: m.margem_direita } : {}),
    ...(m.margem_inferior != null ? { margem_inferior: m.margem_inferior } : {}),
    ...(m.margem_esquerda != null ? { margem_esquerda: m.margem_esquerda } : {}),
    cabecalho: s(m.cabecalho), rodape: s(m.rodape),
  };
}

export async function gerarDocxBanco(p: { modelo: ModeloBanco; dados: DadosNotificacaoBanco; config: ConfiguracaoMunicipio; dataDocumento: string; brasao?: BrasaoImagem | null }) {
  return gerarDocxOficio({
    modelo: comoModeloOficio(p.modelo, p.dados),
    contribuinte: { nome: p.dados.nome, cnpj: p.dados.cnpj.length === 14 ? p.dados.cnpj : null, inscricao_estadual: "", endereco: null },
    config: p.config,
    exercicio: new Date(p.dataDocumento).getFullYear(),
    dataOficio: p.dataDocumento,
    brasao: p.brasao ?? null,
  });
}

export const nomeArquivoBanco = (chave: string, d: DadosNotificacaoBanco) =>
  `${nomeArquivoSeguro(chave, 30)}_${d.cnpj}_${nomeArquivoSeguro(d.nome, 40)}.docx`;

export async function zipDocs(docs: { nome: string; blob: Blob }[]) {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const d of docs) {
    let n = d.nome;
    for (let i = 2; usados.has(n); i++) n = d.nome.replace(/\.docx$/, `_${i}.docx`);
    usados.add(n);
    zip.file(n, d.blob);
  }
  return zip.generateAsync({ type: "blob" });
}
