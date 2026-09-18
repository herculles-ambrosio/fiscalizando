/**
 * Onde o município inscreve/cadastra cada critério do ICMS e como o número é
 * calculado. Conteúdo conferido nas fontes oficiais (SEDESE/Subesp, Secult,
 * SEMAD/FEAM/IEF, IEPHA, SEE/INEP, FJP, IBGE) em setembro de 2026.
 */

export type LocalCadastro = {
  /** Órgão que recebe a informação. */
  orgao: string;
  /** Onde exatamente se lança (sistema, e-mail, protocolo). */
  onde: string;
  /** Endereço oficial. */
  url?: string;
  /** O que precisa ser enviado. */
  oQueEnviar?: string;
  /** Prazo típico (a resolução do ano confirma a data). */
  prazo?: string;
};

export type FichaCriterio = {
  /** Como o número do critério é apurado. */
  comoECalculado?: string;
  /** De onde vem o dado que a FJP usa. */
  deOndeVem?: string;
  /** Onde o município se cadastra / envia a comprovação. */
  ondeCadastrar?: LocalCadastro[];
};

/** Data em que os endereços abaixo foram conferidos. */
export const CONFERIDO_EM = "setembro de 2026";

export const FICHAS: Record<string, FichaCriterio> = {
  vaf: {
    comoECalculado:
      "Média dos dois últimos VAFs apurados do município dividida pela soma dos VAFs de todos os municípios mineiros. O VAF é saídas menos entradas das empresas inscritas no município.",
    deOndeVem: "DAMEF/VAF e escrituração fiscal entregues pelos contribuintes à SEF/MG.",
    ondeCadastrar: [
      {
        orgao: "SEF/MG",
        onde: "Portal do VAF (SIARE) — impugnação do índice provisório",
        url: "https://www.fazenda.mg.gov.br/empresas/vaf/",
        oQueEnviar: "Impugnação com planilha dos contribuintes e documentos de prova.",
        prazo: "30 dias após a publicação do índice provisório (Resolução SEF anual).",
      },
    ],
  },
  populacao: {
    comoECalculado: "População do município dividida pela população total de Minas Gerais.",
    deOndeVem: "Estimativa anual e Censo do IBGE.",
    ondeCadastrar: [
      {
        orgao: "IBGE",
        onde: "Contestação da estimativa populacional",
        url: "https://cidades.ibge.gov.br/",
        oQueEnviar: "Ofício com estudo demográfico local fundamentado.",
        prazo: "Janela de contestação divulgada junto com a estimativa (normalmente em julho).",
      },
    ],
  },
  educacao: {
    comoECalculado:
      "Índice de Qualidade da Educação (Anexo III): resultado de aprendizagem, taxa de participação nas avaliações, atendimento e equidade, ponderados.",
    deOndeVem: "Censo Escolar (INEP) e avaliações do SIMAVE/SEE-MG.",
    ondeCadastrar: [
      {
        orgao: "INEP",
        onde: "Censo Escolar — sistema Educacenso",
        url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar",
        oQueEnviar: "Matrículas, turmas, docentes e infraestrutura da rede municipal.",
        prazo: "Coleta entre maio e julho; retificação até o prazo do INEP.",
      },
      {
        orgao: "SEE-MG",
        onde: "Avaliações do SIMAVE e dados de atendimento da rede",
        url: "https://www.educacao.mg.gov.br/",
        oQueEnviar: "Participação das escolas nas avaliações e dados solicitados em resolução.",
        prazo: "Conforme resolução anual da SEE.",
      },
    ],
  },
  esportes: {
    comoECalculado:
      "Soma das notas das atividades esportivas realizadas no ano-base (Anexo VI), condicionada a Conselho Municipal de Esportes em funcionamento.",
    deOndeVem: "Sistema de Informação ICMS Esportivo da Subsecretaria de Esportes (SEDESE).",
    ondeCadastrar: [
      {
        orgao: "SEDESE — Subsecretaria de Esportes",
        onde: "Sistema de Informação ICMS Esportivo (cadastro do Gestor Esportivo Municipal e das atividades)",
        url: "https://icms.esportes.mg.gov.br/",
        oQueEnviar:
          "Ofício do prefeito indicando o gestor esportivo, lei e atas do Conselho Municipal de Esportes, relatórios, listas de participantes e comprovação de cada atividade.",
        prazo:
          "Prazos da resolução anual do ICMS Esportivo (Resolução SEDESE nº 66/2021 e alterações).",
      },
    ],
  },
  turismo: {
    comoECalculado:
      "Índice de investimento em turismo do município sobre a soma dos índices de todos os municípios habilitados.",
    deOndeVem: "Sistema ICMS Turismo da Secult-MG.",
    ondeCadastrar: [
      {
        orgao: "Secult-MG",
        onde: "Sistema ICMS Turismo (habilitação anual)",
        url: "https://www.icmsturismo.mg.gov.br/default/habilitar",
        oQueEnviar:
          "Ofício do prefeito, certidão do circuito turístico, lei e plano da Política Municipal de Turismo, lei e atas do COMTUR, lei do FUMTUR e comprovação de execução.",
        prazo: "Habilitação anual, nos prazos do Decreto 48.108/2020 e da resolução vigente.",
      },
    ],
  },
  meio_ambiente: {
    comoECalculado:
      "Índice de Meio Ambiente = Conservação (45,45%) + Saneamento (45,45%) + Mata Seca (9,1%).",
    deOndeVem: "IEF (conservação e mata seca) e SEMAD/FEAM (saneamento).",
    ondeCadastrar: [
      {
        orgao: "SEMAD / FEAM",
        onde: "Cadastro do ICMS Ecológico — subcritério saneamento",
        url: "https://meioambiente.mg.gov.br/icms-ecologico-criterios",
        oQueEnviar:
          "Licença e comprovação de operação do aterro/UTC e das ETEs que atendam ao menos 50% da população urbana.",
        prazo: "Janelas semestrais de atualização do cadastro.",
      },
      {
        orgao: "IEF — Diretoria de Áreas Protegidas",
        onde: "Cadastro de Unidades de Conservação municipais",
        url: "https://meioambiente.mg.gov.br/icms-ecologico-criterios",
        oQueEnviar:
          "Documentação da UC conforme o Manual de Cadastramento (ato de criação, plano de manejo, gestão) e avaliação do Fator de Qualidade.",
        prazo: "Cadastro e reavaliação anuais.",
      },
    ],
  },
  meio_ambiente_saneamento: {
    comoECalculado:
      "Sistemas habilitados (aterro, UTC, ETE), tipo do empreendimento e percentual da população atendida.",
    deOndeVem: "SEMAD/FEAM — Gerência de Monitoramento de Efluentes.",
    ondeCadastrar: [
      {
        orgao: "FEAM — GEDEF",
        onde: "Envio da documentação comprobatória por e-mail (gedef@meioambiente.mg.gov.br)",
        url: "https://transparencia.meioambiente.mg.gov.br/views/introducao_icms_ecologico.php",
        oQueEnviar:
          "Ofício do município declarando atendimento mínimo de 50% da população urbana, ART e documentos da ETE/aterro licenciados.",
        prazo: "Atualização semestral.",
      },
    ],
  },
  meio_ambiente_conservacao: {
    comoECalculado:
      "Área da unidade de conservação, área do município, Fator de Conservação e Fator de Qualidade (0,1 a 1).",
    deOndeVem: "IEF — cadastro estadual de UCs.",
    ondeCadastrar: [
      {
        orgao: "IEF — Diretoria de Áreas Protegidas",
        onde: "Cadastramento de UC municipal (Resoluções SEMAD 318/2005 e 1245/2010)",
        url: "https://meioambiente.mg.gov.br/icms-ecologico-criterios",
        oQueEnviar:
          "Checklist do Manual de Procedimentos, ato de criação, plano de manejo e relatório de gestão.",
        prazo: "Avaliação anual do Fator de Qualidade.",
      },
    ],
  },
  patrimonio_cultural: {
    comoECalculado:
      "Pontuação da documentação entregue (tombamentos, inventário, conselho, fundo, educação patrimonial), conforme DN CONEP 01/2021.",
    deOndeVem: "IEPHA-MG.",
    ondeCadastrar: [
      {
        orgao: "IEPHA-MG",
        onde: "Programa ICMS Patrimônio Cultural — envio anual do dossiê",
        url: "https://www.mg.gov.br/iepha/pagina/programa-icms-patrimonio-cultural",
        oQueEnviar:
          "Quadros e documentos em PDF conforme a portaria do exercício (inventário, atas do conselho, execução do fundo, ações de educação patrimonial).",
        prazo: "Prazo anual fixado em portaria do IEPHA (para o exercício 2027: 31/01/2026).",
      },
    ],
  },
  producao_alimentos: {
    comoECalculado:
      "Área cultivada e atendimento a pequenos produtores rurais frente ao conjunto dos municípios.",
    deOndeVem: "SEAPA / EMATER-MG.",
    ondeCadastrar: [
      {
        orgao: "EMATER-MG / SEAPA",
        onde: "Escritório local da EMATER — cadastro de produtores e relatórios do programa municipal",
        url: "https://www.mg.gov.br/agricultura",
        oQueEnviar:
          "Cadastro dos produtores atendidos, lei do programa municipal de apoio à agricultura familiar e comprovação de despesa.",
        prazo: "Envio anual conforme orientação da SEAPA.",
      },
    ],
  },
  saude_per_capita: {
    comoECalculado: "Gasto municipal em saúde por habitante e cumprimento das metas pactuadas.",
    deOndeVem: "SIOPS (Ministério da Saúde) e SES/MG.",
    ondeCadastrar: [
      {
        orgao: "Ministério da Saúde",
        onde: "SIOPS — declaração bimestral da despesa em saúde",
        url: "https://siops.datasus.gov.br/",
        oQueEnviar: "Receitas e despesas em ações e serviços públicos de saúde.",
        prazo: "Bimestral, com fechamento anual.",
      },
    ],
  },
  psf: {
    comoECalculado: "Cobertura populacional das equipes de Saúde da Família habilitadas.",
    deOndeVem: "CNES / Ministério da Saúde.",
    ondeCadastrar: [
      {
        orgao: "Ministério da Saúde",
        onde: "CNES — cadastro das equipes e profissionais",
        url: "https://cnes.datasus.gov.br/",
        oQueEnviar: "Equipes de ESF completas, com profissionais vinculados e carga horária.",
        prazo: "Atualização mensal.",
      },
    ],
  },
  receita_propria: {
    comoECalculado:
      "Arrecadação própria do município (IPTU, ISS, taxas) em relação à sua receita corrente total.",
    deOndeVem: "Prestação de contas ao TCE-MG (SICOM) e FJP.",
    ondeCadastrar: [
      {
        orgao: "TCE-MG",
        onde: "SICOM — remessas contábeis mensais e anuais",
        url: "https://portalsicom1.tce.mg.gov.br/",
        oQueEnviar: "Balancetes com a receita própria escriturada corretamente.",
        prazo: "Prazos mensais do SICOM.",
      },
    ],
  },
  recursos_hidricos: {
    comoECalculado: "Área do município alagada por reservatório de hidrelétrica.",
    deOndeVem: "IGAM.",
    ondeCadastrar: [
      {
        orgao: "IGAM",
        onde: "Conferência da área alagada considerada",
        url: "http://www.igam.mg.gov.br/",
        oQueEnviar: "Pedido de revisão com mapa e memorial da área inundada.",
      },
    ],
  },
  municipios_mineradores: {
    comoECalculado: "Compensação a partir da CFEM recolhida no município.",
    deOndeVem: "ANM.",
    ondeCadastrar: [
      {
        orgao: "ANM",
        onde: "Consulta e revisão da distribuição da CFEM",
        url: "https://sistemas.anm.gov.br/arrecadacao/extra/relatorios/distribuicao_cfem_muni.aspx",
        oQueEnviar: "Pedido de correção quando a arrecadação estiver atribuída a outro município.",
      },
    ],
  },
  penitenciarias: {
    comoECalculado: "População carcerária média custodiada em unidades no município.",
    deOndeVem: "SEJUSP/MG.",
    ondeCadastrar: [
      {
        orgao: "SEJUSP/MG",
        onde: "Conferência da média de detentos informada à FJP",
        url: "https://www.mg.gov.br/justica",
        oQueEnviar: "Pedido de conferência quando o número divergir da unidade instalada.",
      },
    ],
  },
  area_geografica: {
    comoECalculado: "Área do município dividida pela área total do Estado.",
    deOndeVem: "IBGE / FJP.",
    ondeCadastrar: [
      {
        orgao: "IBGE",
        onde: "Pedido de retificação de área/limite territorial",
        url: "https://cidades.ibge.gov.br/",
      },
    ],
  },
  cota_minima: {
    comoECalculado: "Parcela igual dividida entre todos os municípios mineiros.",
    deOndeVem: "FJP.",
  },
  populacao_50: {
    comoECalculado: "Parcela reservada aos 50 municípios mais populosos do Estado.",
    deOndeVem: "IBGE / FJP.",
  },
  icms_solidario: {
    comoECalculado: "Redistribuição em função de população e cota-parte per capita.",
    deOndeVem: "FJP.",
  },
  minimo_per_capita: {
    comoECalculado: "Complemento pago quando a receita per capita fica abaixo do piso legal.",
    deOndeVem: "FJP.",
  },
  meio_ambiente_mata_seca: {
    comoECalculado: "Presença e proporção da fitofisionomia Mata Seca no território (9,1% do IMA).",
    deOndeVem: "IEF — mapeamento da cobertura vegetal.",
  },
  compensacoes_financeiras: {
    comoECalculado: "Acertos de exercícios anteriores aplicados ao repasse mensal.",
    deOndeVem: "FJP.",
  },
};

export function fichaDe(slug: string): FichaCriterio | null {
  return FICHAS[slug] ?? null;
}
