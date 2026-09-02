/**
 * Catálogo dos critérios de distribuição do ICMS aos municípios mineiros
 * (Lei nº 18.030/2009 — "Lei Robin Hood" — e alterações posteriores).
 *
 * Cada critério traz a base legal resumida, quem apura o dado, com que
 * periodicidade e o que a prefeitura pode fazer para melhorar a pontuação.
 * É esse conteúdo que alimenta o diagnóstico e o plano de melhoria.
 */

export type Criterio = {
  slug: string;
  nome: string;
  /** Rótulos usados nos extratos da FJP que devem cair neste critério. */
  sinonimos: string[];
  /**
   * Participação no total distribuído (Anexo I da Lei 18.030/2009, já com as
   * alterações posteriores e a parcela de educação da EC 108/2020).
   *
   * Os pesos foram conferidos contra o repasse real do portal da FJP
   * (peso = valor recebido ÷ (índice do critério × valor de 1 ponto de índice)).
   * Quando a lei e o portal divergiam, prevaleceu o portal — é ele que gera o
   * repasse. As divergências corrigidas estão anotadas critério a critério.
   */
  percentual: number | null;
  baseLegal: string;
  orgao: string;
  periodicidade: string;
  /** O que o critério mede, em linguagem de gestor. */
  oQueMede: string;
  /** Ações concretas para melhorar a pontuação. */
  comoMelhorar: string[];
  /** Critério que o município não controla (não adianta plano de ação). */
  estrutural?: boolean;
  /** Subcritério de outro (usado só no extrato de transferências). */
  paiSlug?: string;
  /** Linha de fechamento do extrato, não é critério. */
  agregado?: boolean;
};

export const CRITERIOS: Criterio[] = [
  {
    slug: "vaf",
    nome: "VAF",
    sinonimos: ["vaf", "valor adicionado fiscal"],
    percentual: 75,
    baseLegal: "Art. 1º, I da Lei 18.030/2009 (CF, art. 158, parágrafo único, I)",
    orgao: "SEF/MG",
    periodicidade: "Anual (índice), com repasse mensal",
    oQueMede:
      "Movimento econômico do município: saídas menos entradas das empresas inscritas, apurado pela DAMEF/VAF.",
    comoMelhorar: [
      "Apurar as declarações de todos os contribuintes ativos e notificar omissos e zerados dentro do prazo de impugnação.",
      "Conferir o crédito próprio (produtor rural, AF/SIARE) e o rateio de transportadoras e energia.",
      "Revisar o cadastro estadual: empresas que operam no município mas declaram em outro.",
      "Usar o módulo Apura VAF deste sistema para a apuração completa.",
    ],
  },
  {
    slug: "cota_minima",
    nome: "Cota Mínima",
    sinonimos: ["cota minima"],
    percentual: 5.5,
    baseLegal: "Anexo I, item 2 da Lei 18.030/2009",
    orgao: "FJP",
    periodicidade: "Anual",
    oQueMede: "Parcela igual dividida entre todos os municípios mineiros.",
    comoMelhorar: ["Distribuição igualitária: não há ação municipal capaz de alterá-la."],
    estrutural: true,
  },
  {
    slug: "area_geografica",
    nome: "Área Geográfica",
    sinonimos: ["area geografica"],
    percentual: 1,
    baseLegal: "Anexo I, item 3 da Lei 18.030/2009",
    orgao: "IBGE / FJP",
    periodicidade: "Anual",
    oQueMede: "Área do município em relação à área total do Estado.",
    comoMelhorar: [
      "Conferir a área oficial publicada pelo IBGE e pedir retificação quando houver erro de limite territorial.",
    ],
    estrutural: true,
  },
  {
    slug: "populacao",
    nome: "População",
    sinonimos: ["populacao", "populacao total"],
    percentual: 2.7,
    baseLegal: "Anexo I, item 4 da Lei 18.030/2009",
    orgao: "IBGE",
    periodicidade: "Anual (estimativa) / Censo",
    oQueMede: "População do município frente à população do Estado.",
    comoMelhorar: [
      "Acompanhar a estimativa anual do IBGE e apresentar contestação fundamentada quando houver subestimação.",
      "Apoiar a coleta censitária com cadastro atualizado de domicílios.",
    ],
  },
  {
    slug: "populacao_50",
    nome: "População dos 50 mais populosos",
    sinonimos: ["populacao 50 populosos", "populacao dos 50 mais populosos", "populacao 50 +"],
    percentual: 2,
    baseLegal: "Anexo I, item 5 da Lei 18.030/2009",
    orgao: "IBGE",
    periodicidade: "Anual",
    oQueMede: "Parcela reservada apenas aos 50 municípios mais populosos do Estado.",
    comoMelhorar: ["Critério restrito aos 50 maiores municípios; não há ação possível fora desse grupo."],
    estrutural: true,
  },
  {
    slug: "educacao",
    nome: "Educação",
    sinonimos: ["educacao"],
    percentual: 2,
    baseLegal: "Anexo I, item 6 da Lei 18.030/2009",
    orgao: "Secretaria de Estado de Educação (SEE/MG)",
    periodicidade: "Anual — informação até o prazo fixado em resolução da SEE",
    oQueMede:
      "Alunos matriculados na rede municipal e o índice de qualidade/atendimento na educação básica.",
    comoMelhorar: [
      "Fechar o Censo Escolar (INEP) no prazo, conferindo matrícula por matrícula — matrícula não declarada é receita perdida.",
      "Enviar à SEE, dentro do prazo da resolução anual, os dados de atendimento da rede municipal.",
      "Ampliar matrícula em creche e pré-escola, que pesam no indicador de atendimento.",
      "Monitorar os resultados do SIMAVE/IDEB, que compõem a parcela de qualidade.",
    ],
  },
  {
    slug: "producao_alimentos",
    nome: "Produção de Alimentos",
    sinonimos: ["producao de alimentos", "producao alimentos"],
    percentual: 1,
    baseLegal: "Anexo I, item 7 da Lei 18.030/2009",
    orgao: "SEAPA / EMATER-MG",
    periodicidade: "Anual",
    oQueMede:
      "Área cultivada e número de pequenos produtores rurais atendidos por programas de apoio à agricultura familiar.",
    comoMelhorar: [
      "Cadastrar todos os pequenos produtores na EMATER e manter o Programa Municipal de Apoio à Agricultura Familiar ativo e comprovado.",
      "Enviar à SEAPA os relatórios de área cultivada e de assistência técnica dentro do prazo.",
      "Comprovar despesa municipal em programas de apoio ao produtor (patrulha mecanizada, distribuição de insumos, feira livre).",
    ],
  },
  {
    slug: "patrimonio_cultural",
    nome: "Patrimônio Cultural",
    sinonimos: ["patrimonio cultural"],
    percentual: 1,
    baseLegal: "Anexo I, item 8 da Lei 18.030/2009 e deliberações do CONEP",
    orgao: "IEPHA-MG",
    periodicidade: "Anual — entrega do dossiê no prazo do IEPHA",
    oQueMede:
      "Ações municipais de proteção ao patrimônio: tombamentos, inventário, conselho e fundo municipal de patrimônio.",
    comoMelhorar: [
      "Manter o Conselho Municipal do Patrimônio Cultural ativo, com atas e reuniões registradas.",
      "Entregar o dossiê anual ao IEPHA rigorosamente no prazo — atraso zera a pontuação do ano.",
      "Concluir inventários de proteção e novos tombamentos/registros de bens imateriais.",
      "Executar (e comprovar) despesa do Fundo Municipal de Patrimônio Cultural.",
    ],
  },
  {
    slug: "meio_ambiente",
    nome: "Meio Ambiente",
    sinonimos: ["meio ambiente", "meio ambiente (a+b+c)", "icms ecologico"],
    percentual: 1.1,
    baseLegal: "Anexo I, item 9 da Lei 18.030/2009 (subcritérios A, B e C)",
    orgao: "FEAM / SEMAD / IEF",
    periodicidade: "Semestral / Anual conforme o subcritério",
    oQueMede:
      "Saneamento ambiental (aterro e tratamento de esgoto), unidades de conservação e áreas de mata seca.",
    comoMelhorar: [
      "Licenciar e manter em operação regular o aterro sanitário ou usina de triagem — é o subcritério de maior retorno.",
      "Ampliar o percentual de esgoto tratado com estação licenciada pela FEAM.",
      "Criar e regularizar unidades de conservação municipais e cadastrá-las no IEF.",
      "Manter o cadastro atualizado junto à FEAM em todas as janelas de atualização do ano.",
    ],
  },
  {
    slug: "meio_ambiente_saneamento",
    nome: "Meio Ambiente — Saneamento",
    sinonimos: ["meio ambiente - saneamento", "meio ambiente saneamento", "saneamento"],
    percentual: null,
    paiSlug: "meio_ambiente",
    baseLegal: "Anexo I, item 9, subcritério A da Lei 18.030/2009",
    orgao: "FEAM",
    periodicidade: "Semestral",
    oQueMede: "Sistemas licenciados de tratamento/destinação de resíduos sólidos e de esgoto sanitário.",
    comoMelhorar: [
      "Regularizar a licença do aterro sanitário e manter a operação dentro das condicionantes.",
      "Elevar a população atendida por tratamento de esgoto licenciado.",
    ],
  },
  {
    slug: "meio_ambiente_conservacao",
    nome: "Meio Ambiente — Conservação",
    sinonimos: ["meio ambiente - conservacao", "meio ambiente conservacao", "conservacao"],
    percentual: null,
    paiSlug: "meio_ambiente",
    baseLegal: "Anexo I, item 9, subcritério B da Lei 18.030/2009",
    orgao: "IEF",
    periodicidade: "Anual",
    oQueMede: "Unidades de conservação e áreas protegidas existentes no território municipal.",
    comoMelhorar: [
      "Criar RPPNs, parques e APAs municipais e registrá-las no cadastro estadual de UCs.",
      "Comprovar plano de manejo e gestão efetiva — a pontuação considera a qualidade da UC.",
    ],
  },
  {
    slug: "meio_ambiente_mata_seca",
    nome: "Meio Ambiente — Mata Seca",
    sinonimos: ["meio ambiente - mata seca", "meio ambiente mata seca", "mata seca"],
    percentual: null,
    paiSlug: "meio_ambiente",
    baseLegal: "Anexo I, item 9, subcritério C da Lei 18.030/2009",
    orgao: "IEF / SEMAD",
    periodicidade: "Anual",
    oQueMede: "Áreas de mata seca preservadas no município.",
    comoMelhorar: [
      "Aplicável apenas a municípios com ocorrência de mata seca; nesse caso, cadastrar e comprovar a área preservada junto ao IEF.",
    ],
    estrutural: true,
  },
  {
    slug: "saude_per_capita",
    nome: "Saúde per capita",
    sinonimos: ["saude per capita"],
    percentual: 2,
    baseLegal: "Anexo I, item 10 da Lei 18.030/2009",
    orgao: "Secretaria de Estado de Saúde (SES/MG)",
    periodicidade: "Anual",
    oQueMede: "Gasto municipal em saúde por habitante e cumprimento das metas pactuadas.",
    comoMelhorar: [
      "Alimentar o SIOPS corretamente e no prazo — a despesa não informada não pontua.",
      "Manter o percentual constitucional de aplicação em saúde acima do mínimo.",
      "Cumprir as metas pactuadas na Programação Anual de Saúde.",
    ],
  },
  {
    slug: "psf",
    nome: "Programa Saúde da Família",
    sinonimos: ["programa saude da familia", "psf", "saude da familia"],
    percentual: null,
    baseLegal: "Anexo I da Lei 18.030/2009 (critério de saúde)",
    orgao: "SES/MG / Ministério da Saúde",
    periodicidade: "Mensal (cadastro) / Anual (índice)",
    oQueMede: "Cobertura populacional das equipes de Saúde da Família habilitadas.",
    comoMelhorar: [
      "Habilitar novas equipes de ESF e manter as existentes com equipe completa.",
      "Manter o cadastro no CNES atualizado — equipe incompleta reduz a cobertura contabilizada.",
    ],
  },
  {
    slug: "receita_propria",
    nome: "Receita Própria",
    sinonimos: ["receita propria"],
    percentual: 1.9,
    baseLegal: "Anexo I, item 11 da Lei 18.030/2009",
    orgao: "Tribunal de Contas de MG (TCE-MG) / FJP",
    periodicidade: "Anual",
    oQueMede: "Arrecadação própria do município (IPTU, ISS, taxas) frente à sua receita total.",
    comoMelhorar: [
      "Atualizar a planta genérica de valores e o cadastro imobiliário — é o maior ganho isolado.",
      "Recadastrar prestadores de serviço e fiscalizar o ISS retido na fonte.",
      "Cobrar a dívida ativa (protesto extrajudicial e parcelamento).",
      "Enviar as prestações de contas ao TCE-MG no prazo: dado não entregue vira pontuação zero.",
    ],
  },
  {
    slug: "municipios_mineradores",
    nome: "Municípios Mineradores",
    sinonimos: ["municipios mineradores", "municipio minerador"],
    percentual: 0.11,
    baseLegal: "Anexo I, item 12 da Lei 18.030/2009",
    orgao: "ANM / FJP",
    periodicidade: "Anual",
    oQueMede: "Compensação para municípios com atividade mineradora (base na CFEM).",
    comoMelhorar: [
      "Aplicável apenas a municípios com extração mineral registrada na ANM.",
      "Havendo mineração, conferir se a CFEM está sendo recolhida com o município correto como destino.",
    ],
    estrutural: true,
  },
  {
    slug: "recursos_hidricos",
    nome: "Recursos Hídricos",
    sinonimos: ["recursos hidricos"],
    percentual: 0.25,
    baseLegal: "Anexo I, item 13 da Lei 18.030/2009",
    orgao: "IGAM",
    periodicidade: "Anual",
    oQueMede: "Municípios com área alagada por reservatório de hidrelétrica.",
    comoMelhorar: [
      "Aplicável somente a municípios com área inundada por barragem de geração de energia.",
      "Havendo reservatório, conferir junto ao IGAM a área alagada considerada no cálculo.",
    ],
    estrutural: true,
  },
  {
    slug: "penitenciarias",
    nome: "Penitenciárias",
    sinonimos: ["penitenciarias", "penitenciaria", "sistema penitenciario"],
    percentual: 0.1,
    baseLegal: "Anexo I, item 14 da Lei 18.030/2009",
    orgao: "SEJUSP / DEPEN-MG",
    periodicidade: "Anual",
    oQueMede: "População carcerária custodiada em unidades prisionais instaladas no município.",
    comoMelhorar: [
      "Aplicável a municípios que sediam unidade prisional.",
      "Conferir junto à SEJUSP a média de detentos informada — divergência reduz o repasse.",
    ],
    estrutural: true,
  },
  {
    slug: "esportes",
    nome: "Esportes",
    sinonimos: ["esportes", "esporte"],
    percentual: 0.1,
    baseLegal: "Anexo I, item 15 da Lei 18.030/2009",
    orgao: "SEDESE / Secretaria de Esportes de MG",
    periodicidade: "Anual — inscrição em edital, com prazo rígido",
    oQueMede:
      "Participação do município nos programas estaduais de esporte (Jogos Escolares, Minas Olímpica e afins).",
    comoMelhorar: [
      "Inscrever o município no edital anual do critério Esportes — a maioria dos zerados simplesmente não se inscreve.",
      "Participar dos Jogos Escolares de Minas Gerais (JEMG) com delegação em todas as etapas possíveis.",
      "Manter conselho e fundo municipal de esportes com atas, plano e execução comprovada.",
      "Entregar a documentação exigida (relatórios, notas de despesa) dentro do prazo do edital.",
    ],
  },
  {
    slug: "turismo",
    nome: "Turismo",
    sinonimos: ["turismo"],
    percentual: 0.1,
    baseLegal: "Anexo I, item 16 da Lei 18.030/2009",
    orgao: "SETUR-MG",
    periodicidade: "Anual — certificação no prazo da SETUR",
    oQueMede:
      "Municípios com política municipal de turismo estruturada e certificados pela SETUR.",
    comoMelhorar: [
      "Renovar anualmente a certificação junto à SETUR — o município perde tudo se perder a data.",
      "Manter conselho municipal de turismo (COMTUR) ativo, fundo criado e plano municipal vigente.",
      "Aderir a circuito turístico regional e comprovar contribuição em dia.",
      "Comprovar execução orçamentária própria na função turismo.",
    ],
  },
  {
    slug: "icms_solidario",
    nome: "ICMS Solidário",
    sinonimos: ["icms solidario"],
    percentual: 4.14,
    baseLegal: "Anexo I, item 17 da Lei 18.030/2009",
    orgao: "FJP",
    periodicidade: "Anual",
    oQueMede:
      "Redistribuição em favor de municípios com menor receita per capita, calculada a partir de população e cota-parte.",
    comoMelhorar: [
      "Cálculo automático da FJP a partir de população e receita: não há inscrição a fazer.",
      "Conferir os dados de população e de receita usados no cálculo, que vêm de outros critérios.",
    ],
    estrutural: true,
  },
  {
    slug: "minimo_per_capita",
    nome: "Mínimo per capita",
    sinonimos: ["minimo per capita"],
    percentual: 0.1,
    baseLegal: "Anexo I, item 18 da Lei 18.030/2009",
    orgao: "FJP",
    periodicidade: "Anual",
    oQueMede:
      "Complemento para municípios cuja receita per capita fica abaixo do piso definido em lei.",
    comoMelhorar: [
      "Cálculo automático da FJP; o município só recebe quando fica abaixo do piso per capita.",
      "Valor zerado indica que a receita per capita do município está acima do piso — não é perda.",
    ],
    estrutural: true,
  },
  {
    slug: "compensacoes_financeiras",
    nome: "Compensações Financeiras Líquidas",
    sinonimos: ["compensacoes financeiras liquidas", "compensacoes financeiras"],
    percentual: null,
    baseLegal: "Ajustes de compensação previstos na Lei 18.030/2009",
    orgao: "FJP",
    periodicidade: "Mensal",
    oQueMede:
      "Acertos positivos ou negativos aplicados ao repasse (correções de índices de exercícios anteriores).",
    comoMelhorar: [
      "Valor negativo indica devolução de repasse recebido a maior; conferir a origem junto à FJP.",
    ],
    estrutural: true,
  },
  {
    slug: "indice_participacao",
    nome: "Índice de Participação",
    sinonimos: ["indice de participacao", "indice participacao", "indice de particip"],
    percentual: null,
    agregado: true,
    baseLegal: "Soma ponderada de todos os critérios da Lei 18.030/2009",
    orgao: "FJP",
    periodicidade: "Mensal",
    oQueMede: "Percentual do município no total do ICMS distribuído aos municípios mineiros.",
    comoMelhorar: ["Resultado da soma dos demais critérios."],
  },
  {
    slug: "total",
    nome: "Total do repasse",
    sinonimos: ["total (mensal)", "total mensal", "total"],
    percentual: null,
    agregado: true,
    baseLegal: "—",
    orgao: "FJP",
    periodicidade: "Mensal",
    oQueMede: "Soma de todos os critérios no mês.",
    comoMelhorar: [],
  },
];

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function normalizarRotulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const PORSINONIMO = new Map<string, Criterio>();
for (const c of CRITERIOS) {
  PORSINONIMO.set(normalizarRotulo(c.nome), c);
  for (const s of c.sinonimos) PORSINONIMO.set(normalizarRotulo(s), c);
}

export const CRITERIO_POR_SLUG = new Map(CRITERIOS.map((c) => [c.slug, c]));

/** Encontra o critério pelo rótulo do extrato da FJP. */
export function acharCriterio(rotulo: string): Criterio | null {
  const chave = normalizarRotulo(rotulo);
  const direto = PORSINONIMO.get(chave);
  if (direto) return direto;
  for (const [sin, c] of PORSINONIMO) {
    if (chave.startsWith(sin) || sin.startsWith(chave)) return c;
  }
  return null;
}

/** Rótulo amigável mesmo para critérios que não estejam no catálogo. */
export function nomeCriterio(slug: string): string {
  return CRITERIO_POR_SLUG.get(slug)?.nome ?? slug;
}

/** Critérios que entram no painel (sem agregados nem subcritérios). */
export const CRITERIOS_PAINEL = CRITERIOS.filter((c) => !c.agregado && !c.paiSlug);
