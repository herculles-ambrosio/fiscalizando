/**
 * Modelos de documentos do Fiscaliza Cartório (notificações, intimações e
 * termos). A estrutura do texto é a mesma dos ofícios do Apura VAF:
 *   texto normal          -> parágrafo justificado
 *   > texto               -> citação em itálico
 *   # texto               -> linha centralizada em negrito
 *   * Rótulo: valor       -> campo com valor em negrito
 */

import { formatarMoeda } from "@/lib/format";
import { MESES_NOME } from "./parser";
import type { LinhaFiscalizacao } from "@/hooks/useCartorios";

export const TIPOS_DOC_CARTORIO = [
  "DIFERENCA",
  "SEM_DECLARACAO",
  "NAO_PAGO",
  "INTIMACAO",
  "TERMO",
  "GERAL",
] as const;

export type TipoDocCartorio = (typeof TIPOS_DOC_CARTORIO)[number];

export const ROTULO_TIPO_DOC: Record<TipoDocCartorio, string> = {
  DIFERENCA: "Diferença de ISS a menor",
  SEM_DECLARACAO: "Cartório sem declaração",
  NAO_PAGO: "ISS declarado e não pago",
  INTIMACAO: "Intimação para apresentar documentos",
  TERMO: "Termo de início de fiscalização",
  GERAL: "Geral (qualquer situação)",
};

export type ModeloCartorio = {
  id?: string;
  chave: string;
  nome: string;
  tipo: TipoDocCartorio;
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

export const PLACEHOLDERS_CARTORIO: { chave: string; descricao: string }[] = [
  { chave: "{{serventia}}", descricao: "Nome da serventia (cartório)" },
  { chave: "{{cns}}", descricao: "Código CNS da serventia" },
  { chave: "{{comarca}}", descricao: "Comarca" },
  { chave: "{{tipo_servico}}", descricao: "Tipo de serviço da serventia" },
  { chave: "{{competencia}}", descricao: "Mês e ano da competência (ex.: junho de 2025)" },
  { chave: "{{competencia_curta}}", descricao: "Competência no formato 06/2025" },
  { chave: "{{aliquota}}", descricao: "Alíquota de ISS do município" },
  { chave: "{{emolumentos}}", descricao: "Emolumentos publicados pelo TJMG" },
  { chave: "{{base_declarada}}", descricao: "Base de cálculo declarada ao município" },
  { chave: "{{iss_devido}}", descricao: "ISS devido sobre os emolumentos" },
  { chave: "{{iss_declarado}}", descricao: "ISS declarado pelo cartório" },
  { chave: "{{iss_pago}}", descricao: "ISS efetivamente pago" },
  { chave: "{{iss_nao_pago}}", descricao: "ISS declarado que não foi recolhido (declarado − pago)" },
  { chave: "{{diferenca_iss}}", descricao: "Diferença de ISS apurada" },
  { chave: "{{diferenca_base}}", descricao: "Diferença entre emolumentos e base declarada" },
  { chave: "{{prazo_dias}}", descricao: "Prazo em dias para resposta" },
  { chave: "{{prefeitura}}", descricao: "Nome da prefeitura" },
  { chave: "{{municipio}}", descricao: "Município" },
  { chave: "{{cidade_data}}", descricao: "Cidade/UF do cabeçalho da data" },
  { chave: "{{data_extenso}}", descricao: "Data do documento por extenso" },
];

export type DadosDocumentoCartorio = {
  linha: LinhaFiscalizacao;
  competencia: { ano: number; mes: number };
  aliquota: number;
  prazoDias: number;
};

/** Substitui os campos próprios do cartório. Os demais ficam para o gerador do ofício. */
export function camposCartorio(dados: DadosDocumentoCartorio): Record<string, string> {
  const { linha, competencia, aliquota, prazoDias } = dados;
  const mapa: Record<string, string> = {
    serventia: linha.nome,
    cns: linha.cns,
    comarca: linha.comarca ?? "—",
    tipo_servico: linha.tipoServico || "—",
    competencia: `${MESES_NOME[competencia.mes - 1]?.toLowerCase() ?? ""} de ${competencia.ano}`,
    competencia_curta: `${String(competencia.mes).padStart(2, "0")}/${competencia.ano}`,
    aliquota: `${String(aliquota).replace(".", ",")}%`,
    emolumentos: formatarMoeda(linha.emolumentos),
    base_declarada: formatarMoeda(linha.baseDeclarada ?? 0),
    iss_devido: formatarMoeda(linha.issDevido),
    iss_declarado: formatarMoeda(linha.issDeclarado ?? 0),
    iss_pago: formatarMoeda(linha.issPago ?? 0),
    iss_nao_pago: formatarMoeda(Math.max((linha.issDeclarado ?? 0) - (linha.issPago ?? 0), 0)),
    diferenca_iss: formatarMoeda(linha.diferencaIss ?? linha.issDevido),
    diferenca_base: formatarMoeda(linha.diferencaBase ?? linha.emolumentos),
    prazo_dias: String(prazoDias),
  };
  return mapa;
}

/** Substitui os campos próprios do cartório. Os demais ficam para o gerador do ofício. */
export function aplicarPlaceholdersCartorio(texto: string, dados: DadosDocumentoCartorio): string {
  const mapa = camposCartorio(dados);
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, chave: string) => {
    const valor = mapa[chave.toLowerCase()];
    return valor === undefined ? todo : valor;
  });
}

const IDENTIFICACAO = `* Serventia: {{serventia}}
* Código CNS: {{cns}}
* Comarca: {{comarca}}
* Tipo de serviço: {{tipo_servico}}
* Competência: {{competencia}}
`;

const BASE_LEGAL = `> Lei Complementar nº 116/2003, item 21.01 da lista anexa: registros públicos, cartorários e notariais — serviço sujeito ao ISSQN no município onde está instalada a serventia.

> Constituição Federal, art. 236: os serviços notariais e de registro são exercidos em caráter privado, por delegação do Poder Público, o que afasta a imunidade recíproca.`;

const FECHO = `Permanecemos à disposição para os esclarecimentos necessários.

Atenciosamente.`;

const CORPO_DIFERENCA = `${IDENTIFICACAO}
A Fazenda Pública Municipal de {{municipio}}, no exercício da fiscalização tributária, confrontou os valores de emolumentos publicados pelo Portal da Transparência do Tribunal de Justiça de Minas Gerais com o ISSQN declarado por essa serventia na competência {{competencia}}, apurando o seguinte:

* Emolumentos publicados (TJMG): {{emolumentos}}
* Base de cálculo declarada ao município: {{base_declarada}}
* ISSQN devido ({{aliquota}}): {{iss_devido}}
* ISSQN declarado: {{iss_declarado}}
* ISSQN recolhido: {{iss_pago}}
* Diferença apurada: {{diferenca_iss}}

${BASE_LEGAL}

Fica V. Sa. NOTIFICADA a, no prazo de {{prazo_dias}} dias contados do recebimento deste, recolher a diferença apurada com os acréscimos legais ou apresentar defesa escrita acompanhada dos documentos que comprovem a regularidade da declaração (DAP, livros de registro de emolumentos e guias de recolhimento da competência).

O não atendimento no prazo autoriza o lançamento de ofício do tributo, com multa e juros, e a inscrição do débito em dívida ativa.

${FECHO}`;

const CORPO_SEM_DECLARACAO = `${IDENTIFICACAO}
Consta no Portal da Transparência do Tribunal de Justiça de Minas Gerais o recolhimento de emolumentos por essa serventia na competência {{competencia}}, no valor de {{emolumentos}}. Todavia, não localizamos nesta Fazenda Pública Municipal qualquer declaração de ISSQN referente ao período.

* Emolumentos publicados (TJMG): {{emolumentos}}
* ISSQN estimado ({{aliquota}}): {{iss_devido}}

${BASE_LEGAL}

Fica V. Sa. NOTIFICADA a apresentar, no prazo de {{prazo_dias}} dias, a declaração da competência {{competencia}} e o comprovante de recolhimento do ISSQN, ou justificar formalmente a ausência de movimento tributável.

${FECHO}`;

const CORPO_NAO_PAGO = `${IDENTIFICACAO}
A Fazenda Pública Municipal de {{municipio}} verificou que essa serventia apresentou declaração de ISSQN referente à competência {{competencia}}, porém não consta o recolhimento do imposto declarado, apurando-se o seguinte:

* Emolumentos publicados (TJMG): {{emolumentos}}
* Base de cálculo declarada ao município: {{base_declarada}}
* ISSQN declarado: {{iss_declarado}}
* ISSQN recolhido: {{iss_pago}}
* ISSQN declarado e não pago: {{iss_nao_pago}}
* ISSQN devido sobre os emolumentos ({{aliquota}}): {{iss_devido}}
* Diferença total apurada: {{diferenca_iss}}

${BASE_LEGAL}

> A declaração do contribuinte constitui o crédito tributário, dispensando qualquer outra providência do Fisco para a sua cobrança (Súmula 436 do STJ).

Fica V. Sa. NOTIFICADA a, no prazo de {{prazo_dias}} dias contados do recebimento deste, efetuar o recolhimento do ISSQN declarado e não pago, bem como da eventual diferença apurada, com os acréscimos legais, ou apresentar o comprovante de pagamento da competência.

O não atendimento no prazo autoriza a inscrição do débito em dívida ativa e a adoção das medidas de cobrança cabíveis.

${FECHO}`;

const CORPO_INTIMACAO = `${IDENTIFICACAO}
Em procedimento de fiscalização do ISSQN incidente sobre os serviços notariais e de registro, fica V. Sa. INTIMADA a apresentar a esta Fazenda Pública Municipal, no prazo de {{prazo_dias}} dias, os seguintes documentos relativos à competência {{competencia}}:

* Documento: Demonstrativo de Arrecadação de Produtividade (DAP) do período
* Documento: Livro de registro diário auxiliar de emolumentos
* Documento: Guias de recolhimento do ISSQN e respectivos comprovantes de pagamento
* Documento: Relação analítica dos atos praticados, com valores de emolumentos, Recompe, TFJ e despesas

Os documentos podem ser entregues no setor de fiscalização ou enviados em meio digital ao endereço eletrônico desta Secretaria.

> O embaraço à fiscalização sujeita o infrator às penalidades previstas na legislação tributária municipal.

${FECHO}`;

const CORPO_TERMO = `# TERMO DE INÍCIO DE AÇÃO FISCAL

${IDENTIFICACAO}
Aos {{data_extenso}}, em cumprimento à ordem de serviço da Secretaria Municipal de Fazenda de {{municipio}}, fica lavrado o presente TERMO DE INÍCIO DE AÇÃO FISCAL em face da serventia acima identificada, para verificação do cumprimento das obrigações relativas ao ISSQN — item 21.01 da lista anexa à Lei Complementar nº 116/2003.

O período fiscalizado abrange a competência {{competencia}}, podendo ser estendido aos demais períodos não alcançados pela decadência.

A partir desta data fica excluída a espontaneidade do sujeito passivo quanto às infrações relacionadas ao tributo e ao período fiscalizado.

O contribuinte deverá apresentar, no prazo de {{prazo_dias}} dias, os livros, arquivos e documentos requisitados pela fiscalização.

${FECHO}`;

export const MODELOS_CARTORIO_PADRAO: ModeloCartorio[] = [
  {
    chave: "notificacao_diferenca",
    nome: "Notificação — ISSQN recolhido a menor",
    tipo: "DIFERENCA",
    titulo: "NOTIFICAÇÃO FISCAL — ISSQN SOBRE EMOLUMENTOS {{competencia_curta}}",
    corpo: CORPO_DIFERENCA,
    ativo: true,
  },
  {
    chave: "notificacao_sem_declaracao",
    nome: "Notificação — ausência de declaração",
    tipo: "SEM_DECLARACAO",
    titulo: "NOTIFICAÇÃO — AUSÊNCIA DE DECLARAÇÃO DE ISSQN {{competencia_curta}}",
    corpo: CORPO_SEM_DECLARACAO,
    ativo: true,
  },
  {
    chave: "notificacao_iss_nao_pago",
    nome: "Notificação — ISS não pago",
    tipo: "NAO_PAGO",
    titulo: "NOTIFICAÇÃO FISCAL — ISSQN DECLARADO E NÃO PAGO {{competencia_curta}}",
    corpo: CORPO_NAO_PAGO,
    ativo: true,
  },
  {
    chave: "intimacao_documentos",
    nome: "Intimação para apresentação de documentos",
    tipo: "INTIMACAO",
    titulo: "INTIMAÇÃO FISCAL — APRESENTAÇÃO DE DOCUMENTOS {{competencia_curta}}",
    corpo: CORPO_INTIMACAO,
    ativo: true,
  },
  {
    chave: "termo_inicio",
    nome: "Termo de início de ação fiscal",
    tipo: "TERMO",
    titulo: "TERMO DE INÍCIO DE AÇÃO FISCAL {{competencia_curta}}",
    corpo: CORPO_TERMO,
    ativo: true,
  },
];

export function novaChaveCartorio(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${base || "modelo"}_${Date.now().toString(36)}`;
}
