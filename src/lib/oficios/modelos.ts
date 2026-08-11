import { dataPorExtenso } from "./texto";
import { formatarCnpj } from "@/lib/format";
import type { ConfiguracaoMunicipio, ContribuinteOficio } from "./zerados";

export const SITUACOES_OFICIO = [
  "ZERADO",
  "OMISSO",
  "FORA_DO_PRAZO",
  "DISCREPANTE",
  "SIMPLES_NACIONAL",
  "SIMEI",
  "GERAL",
] as const;

export type SituacaoOficio = (typeof SITUACOES_OFICIO)[number];

export const ROTULO_SITUACAO: Record<SituacaoOficio, string> = {
  ZERADO: "Zerado",
  OMISSO: "Omisso",
  FORA_DO_PRAZO: "Fora do prazo",
  DISCREPANTE: "Discrepante",
  SIMPLES_NACIONAL: "Simples Nacional",
  SIMEI: "SIMEI (MEI)",
  GERAL: "Geral (qualquer situação)",
};

export type ModeloOficio = {
  id?: string;
  chave: string;
  nome: string;
  situacao: SituacaoOficio;
  titulo: string;
  corpo: string;
  ativo: boolean;
};

export const PLACEHOLDERS: { chave: string; descricao: string }[] = [
  { chave: "{{contribuinte}}", descricao: "Nome do contribuinte" },
  { chave: "{{cnpj}}", descricao: "CNPJ formatado" },
  { chave: "{{ie}}", descricao: "Inscrição estadual" },
  { chave: "{{endereco}}", descricao: "Endereço do contribuinte" },
  { chave: "{{exercicio}}", descricao: "Exercício da apuração" },
  { chave: "{{exercicio_repasse}}", descricao: "Exercício seguinte (repasse)" },
  { chave: "{{prefeitura}}", descricao: "Nome da prefeitura" },
  { chave: "{{municipio}}", descricao: "Município (da cidade/UF)" },
  { chave: "{{cidade_data}}", descricao: "Cidade/UF do cabeçalho da data" },
  { chave: "{{data_extenso}}", descricao: "Data do ofício por extenso" },
];

export function aplicarPlaceholders(
  texto: string,
  dados: {
    contribuinte: ContribuinteOficio;
    config: ConfiguracaoMunicipio;
    exercicio: number;
    dataOficio: string;
  },
): string {
  const { contribuinte, config, exercicio, dataOficio } = dados;
  const municipio = (config.cidade_data.split("/")[0] ?? "").trim();
  const mapa: Record<string, string> = {
    contribuinte: contribuinte.nome ?? "—",
    cnpj: formatarCnpj(contribuinte.cnpj),
    ie: contribuinte.inscricao_estadual,
    endereco: contribuinte.endereco ?? "—",
    exercicio: String(exercicio),
    exercicio_repasse: String(exercicio + 1),
    prefeitura: config.nome_prefeitura,
    municipio,
    cidade_data: config.cidade_data,
    data_extenso: dataPorExtenso(dataOficio),
  };
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (todo, chave: string) => {
    const valor = mapa[chave.toLowerCase()];
    return valor === undefined ? todo : valor;
  });
}

export type BlocoModelo =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "citacao"; texto: string }
  | { tipo: "centralizado"; texto: string }
  | { tipo: "campo"; rotulo: string; valor: string }
  | { tipo: "espaco" };

/**
 * Sintaxe do corpo:
 *   texto normal          -> parágrafo justificado
 *   > texto               -> citação em itálico
 *   # texto               -> linha centralizada em negrito
 *   * Rótulo: valor       -> campo com valor em negrito
 *   linha em branco       -> espaçamento
 */
export function analisarCorpo(corpo: string): BlocoModelo[] {
  return corpo.split(/\r?\n/).map((linha): BlocoModelo => {
    const t = linha.trim();
    if (!t) return { tipo: "espaco" };
    if (t.startsWith(">")) return { tipo: "citacao", texto: t.slice(1).trim() };
    if (t.startsWith("#")) return { tipo: "centralizado", texto: t.slice(1).trim() };
    if (t.startsWith("*")) {
      const resto = t.slice(1).trim();
      const i = resto.indexOf(":");
      if (i > 0) {
        return {
          tipo: "campo",
          rotulo: resto.slice(0, i).trim(),
          valor: resto.slice(i + 1).trim(),
        };
      }
      return { tipo: "paragrafo", texto: resto };
    }
    return { tipo: "paragrafo", texto: t };
  });
}

const CORPO_ZERADO = `Prezado,

* Contribuinte: {{contribuinte}}
* CNPJ: {{cnpj}}
* Inscrição Estadual: {{ie}}
* Endereço: {{endereco}}

Valor Adicionado Fiscal (VAF) é um indicador econômico-contábil utilizado pelo Estado para calcular o índice de participação municipal no repasse de receita do Imposto sobre Operações relativas à Circulação de Mercadorias e sobre Prestações de Serviços de Transporte Interestadual e Intermunicipal e de Comunicação (ICMS) e do Imposto sobre Produtos Industrializados (IPI) aos municípios mineiros. É apurado pela Secretaria de Estado de Fazenda de Minas Gerais (SEF-MG), com base em declarações anuais apresentadas pelas empresas estabelecidas nos respectivos municípios.

Prezado contribuinte responsável pelas informações do VAF {{exercicio}}. Estamos acompanhando o VAF {{exercicio}} do Município de {{municipio}}. A resolução 4.306/2011 da SRE- Secretaria da Receita Estadual legaliza o município de indicar um representante para coletar e acompanhar a correta transmissão dos dados e regularidade das informações, conforme art. 21 in verbis:

> Art. 21. O município indicará a Secretaria de Estado de Fazenda até 31 de Maio de cada exercício, o nome da pessoa responsável para acompanhamento da coleta de dados, da análise da informações recebidas e da apuração do valor adicionado.

Como representante do município, solicitamos a retificação da DAMEF/VAF-PGDAS/DEFIS da empresa acima relacionada, de sua responsabilidade.

Com efeito, de acordo com o banco de dados da Receita Estadual o contribuinte não realizou a validação da DAMEF, sendo assim, solicitamos que seja providenciado junto ao sitio da Receita Estadual a regularização da declaração DAMEF/VAF referente ao ano de {{exercicio}}.

A multa por deixar de entregar a declaração varia de 100 a 500 UFEMG, conforme previsto no artigo 215 do RICMS, inciso III, alíneas “a” e “b”, ou seja, varia em torno de R$ 553,10 (Quinhentos e cinquenta e três reais e dez centavos) para as microempresas a R$ 2.765,50 (Dois mil setecentos e sessenta e cinco reais e cinquenta centavos), para as demais.

> Art. 215. As multas calculadas com base na UFEMG, ou no valor do imposto não declarado, são:

> III - por deixar de entregar ao Fisco documento informativo do movimento econômico ou fiscal, exceto o previsto no inciso VIII do caput deste artigo, na forma e no prazo definidos neste regulamento:

Ressaltamos que é de suma importância à participação de sua empresa para o crescimento de seu município. Pois através desta declaração o mesmo receberá a parcela do ICMS que lhe é devida no exercício de {{exercicio_repasse}}. Convicto de vosso apoio e atenção ao pleito subscrevemos com protesto de mais elevada estima e consideração.

Atenciosamente.`;

const CABECALHO_CONTRIBUINTE = `Prezado,

* Contribuinte: {{contribuinte}}
* CNPJ: {{cnpj}}
* Inscrição Estadual: {{ie}}
* Endereço: {{endereco}}
`;

const RODAPE_PADRAO = `Ressaltamos que é de suma importância à participação de sua empresa para o crescimento de seu município. Pois através desta declaração o mesmo receberá a parcela do ICMS que lhe é devida no exercício de {{exercicio_repasse}}. Convicto de vosso apoio e atenção ao pleito subscrevemos com protesto de mais elevada estima e consideração.

Atenciosamente.`;

const CORPO_OMISSO = `${CABECALHO_CONTRIBUINTE}
Como representante do Município de {{municipio}} no acompanhamento do Valor Adicionado Fiscal (VAF), informamos que, de acordo com os dados da Secretaria de Estado de Fazenda de Minas Gerais, a empresa acima relacionada consta como OMISSA na entrega da declaração referente ao exercício de {{exercicio}}.

Solicitamos, portanto, a imediata entrega/validação da DAMEF/VAF-PGDAS/DEFIS do exercício de {{exercicio}}, sob pena das sanções previstas na legislação estadual.

> Art. 215. As multas calculadas com base na UFEMG, ou no valor do imposto não declarado, são: III - por deixar de entregar ao Fisco documento informativo do movimento econômico ou fiscal, na forma e no prazo definidos neste regulamento.

${RODAPE_PADRAO}`;

const CORPO_FORA_PRAZO = `${CABECALHO_CONTRIBUINTE}
Como representante do Município de {{municipio}} no acompanhamento do Valor Adicionado Fiscal (VAF), informamos que a declaração da empresa acima relacionada, referente ao exercício de {{exercicio}}, foi entregue FORA DO PRAZO legal estabelecido pela Secretaria de Estado de Fazenda de Minas Gerais.

Solicitamos que a empresa observe os prazos de entrega nos próximos exercícios e confirme a regularidade das informações já transmitidas, evitando prejuízo ao índice de participação do município e a aplicação das multas previstas no artigo 215 do RICMS.

${RODAPE_PADRAO}`;

const CORPO_DISCREPANTE = `${CABECALHO_CONTRIBUINTE}
Como representante do Município de {{municipio}} no acompanhamento do Valor Adicionado Fiscal (VAF), verificamos DIVERGÊNCIA RELEVANTE entre o valor adicionado declarado no exercício de {{exercicio}} e o do exercício anterior para a empresa acima relacionada.

Solicitamos a conferência dos valores informados na DAMEF/VAF-PGDAS/DEFIS e, se constatado erro, a devida retificação junto à Secretaria de Estado de Fazenda de Minas Gerais, de modo a assegurar a correta apuração do índice de participação do município.

${RODAPE_PADRAO}`;

export const MODELOS_PADRAO: ModeloOficio[] = [
  {
    chave: "zerado",
    nome: "Pedido de retificação — declaração zerada",
    situacao: "ZERADO",
    titulo: "PEDIDO DE RETIFICAÇÃO EMPRESAS COM DECLARAÇÃO ZERADAS VAF {{exercicio}}",
    corpo: CORPO_ZERADO,
    ativo: true,
  },
  {
    chave: "omisso",
    nome: "Notificação — omissão de declaração",
    situacao: "OMISSO",
    titulo: "NOTIFICAÇÃO DE OMISSÃO DE DECLARAÇÃO VAF {{exercicio}}",
    corpo: CORPO_OMISSO,
    ativo: true,
  },
  {
    chave: "fora_do_prazo",
    nome: "Notificação — entrega fora do prazo",
    situacao: "FORA_DO_PRAZO",
    titulo: "NOTIFICAÇÃO DE ENTREGA FORA DO PRAZO VAF {{exercicio}}",
    corpo: CORPO_FORA_PRAZO,
    ativo: true,
  },
  {
    chave: "discrepante",
    nome: "Pedido de conferência — variação discrepante",
    situacao: "DISCREPANTE",
    titulo: "PEDIDO DE CONFERÊNCIA DE VALORES DECLARADOS VAF {{exercicio}}",
    corpo: CORPO_DISCREPANTE,
    ativo: true,
  },
];
