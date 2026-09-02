/**
 * Itens pontuáveis de cada critério do ICMS Robin Hood, conforme os quadros
 * da Lei nº 18.030/2009 e seus anexos.
 *
 * Cada item é uma coisa concreta que a prefeitura faz (ou deixa de fazer) e
 * que vira nota no cálculo da FJP. Guardamos aqui a nota do quadro, onde se
 * lança a informação, o prazo e o que precisa ser comprovado — é isso que o
 * Plano de melhoria usa para apontar o que está faltando.
 */

export type ItemPontuavel = {
  /** Código curto (sigla do anexo quando existir). Único dentro do critério. */
  codigo: string;
  titulo: string;
  /** Nota do quadro da lei. null quando o item entra por proporção, não por nota. */
  nota: number | null;
  /** Peso relativo dentro do critério (%), quando a lei reparte em parcelas. */
  parcelaPct?: number;
  /** Onde se lança / quem recebe a informação. */
  ondeLancar: string;
  prazo: string;
  /** Documentos que comprovam o item. */
  documentos: string[];
  /** Explicação em linguagem de gestor. */
  detalhe?: string;
};

export type QuadroCriterio = {
  /** Como a lei mede o critério. */
  tipo: "nota" | "proporcao" | "indicador";
  /** Texto curto sobre a fórmula do anexo. */
  formula: string;
  itens: ItemPontuavel[];
};

const ANUAL_SETUR = "Cadastro anual junto à Setur-MG (Programa de Regionalização do Turismo)";

export const QUADROS: Record<string, QuadroCriterio> = {
  esportes: {
    tipo: "nota",
    formula: "IE = Σ(N × P × NM × NA) ÷ ΣMB — Anexo V. N = nota da atividade, P = peso da receita corrente líquida per capita, NM = modalidades, NA = atletas.",
    itens: [
      { codigo: "PSE", titulo: "Projetos Sócio-Educacionais", nota: 0.5, ondeLancar: "Cadastro anual da Sedese/Subsecretaria de Esportes (sistema do ICMS Esportivo)", prazo: "Conforme edital anual da Sedese (em geral 1º semestre)", documentos: ["Projeto e cronograma", "Lista de participantes", "Relatório fotográfico"] },
      { codigo: "EPD", titulo: "Esporte para Pessoas com Deficiência", nota: 1.0, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Projeto", "Relação de atletas com laudo", "Relatório de atividades"] },
      { codigo: "JEM", titulo: "Jogos Escolares Municipais", nota: 1.0, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Regulamento dos jogos", "Súmulas", "Relação de escolas e atletas"] },
      { codigo: "JEMG", titulo: "Minas Olímpica — Jogos Escolares de Minas Gerais", nota: 1.0, ondeLancar: "Inscrição no JEMG (Sedese)", prazo: "Inscrição na etapa microrregional", documentos: ["Ficha de inscrição", "Comprovante de participação"] },
      { codigo: "JIMI", titulo: "Minas Olímpica — Jogos do Interior de Minas Gerais", nota: 0.5, ondeLancar: "Inscrição no JIMI (Sedese)", prazo: "Calendário do JIMI", documentos: ["Ficha de inscrição", "Relação de atletas"] },
      { codigo: "AFA", titulo: "Atividades de Futebol Amador", nota: 0.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Regulamento do campeonato", "Súmulas", "Relação de times"] },
      { codigo: "ETI", titulo: "Esporte para a Terceira Idade", nota: 1.0, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Projeto", "Lista de frequência", "Relatório"] },
      { codigo: "AL", titulo: "Atividades de Lazer", nota: 0.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Programação", "Registro fotográfico"] },
      { codigo: "QAE", titulo: "Qualificação de Agente Esportivo", nota: 1.0, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Certificados de capacitação", "Lista de participantes"] },
      { codigo: "XE", titulo: "Xadrez na Escola", nota: 0.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Projeto pedagógico", "Relação de escolas"] },
      { codigo: "AE", titulo: "Academia na Escola", nota: 0.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Projeto", "Relação de unidades"] },
      { codigo: "PP", titulo: "Outros Programas / Projetos esportivos", nota: 1.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Projeto", "Relatório de execução"], detalhe: "É o item de maior nota do quadro e o mais esquecido — qualquer programa esportivo próprio bem documentado pontua aqui." },
      { codigo: "IREE", titulo: "Instalação, reforma ou equipamento esportivo", nota: 0.5, ondeLancar: "Cadastro anual da Sedese", prazo: "Edital anual", documentos: ["Nota fiscal / empenho", "Fotos antes e depois", "Termo de recebimento"] },
      { codigo: "BA", titulo: "Bolsa Atleta e Bolsa-Técnico (municipal e estadual)", nota: 1.0, ondeLancar: "Lei municipal de bolsa + cadastro na Sedese", prazo: "Edital anual", documentos: ["Lei municipal", "Relação de bolsistas", "Comprovantes de pagamento"] },
    ],
  },

  turismo: {
    tipo: "nota",
    formula: "IIT = Σ(NT × IRC) ÷ ΣMB — Anexo VI. NT = notas da organização turística, IRC = faixa de receita corrente líquida per capita (1 a 10).",
    itens: [
      { codigo: "CIRC", titulo: "Participar de circuito turístico reconhecido pela Setur", nota: 4.0, ondeLancar: ANUAL_SETUR, prazo: "Certidão anual do circuito junto à Setur", documentos: ["Certidão do circuito", "Ata de filiação", "Comprovante de contribuição"], detalhe: "Maior nota do quadro. Sem circuito reconhecido o município perde mais da metade do índice." },
      { codigo: "POL", titulo: "Política municipal de turismo elaborada e em implementação", nota: 2.5, ondeLancar: "Comprovação à Setur", prazo: "Anual", documentos: ["Lei/plano municipal de turismo", "Relatório de execução"] },
      { codigo: "COMTUR", titulo: "Conselho Municipal de Turismo (Comtur) constituído e em funcionamento", nota: 1.0, ondeLancar: "Comprovação à Setur", prazo: "Anual", documentos: ["Lei de criação", "Atas das reuniões do ano", "Portaria de nomeação"] },
      { codigo: "FUMTUR", titulo: "Fundo Municipal de Turismo (Fumtur) constituído e em funcionamento", nota: 1.0, ondeLancar: "Comprovação à Setur", prazo: "Anual", documentos: ["Lei de criação do fundo", "Extrato de movimentação", "Prestação de contas"] },
      { codigo: "PCULT", titulo: "Ter participação no critério patrimônio cultural", nota: 0.75, ondeLancar: "Automático (IEPHA)", prazo: "—", documentos: ["Pontuação no ICMS Patrimônio Cultural"] },
      { codigo: "PAMB", titulo: "Ter participação no critério meio ambiente", nota: 0.75, ondeLancar: "Automático (Feam/Semad)", prazo: "—", documentos: ["Pontuação no ICMS Ecológico"] },
    ],
  },

  patrimonio_cultural: {
    tipo: "nota",
    formula: "PPC = somatório das notas do município ÷ somatório das notas de todos os municípios — Anexo II. As notas de tombamento dependem do acervo; as de gestão dependem só de ato municipal.",
    itens: [
      { codigo: "EP", titulo: "Educação patrimonial municipal (projetos e atividades)", nota: 2, ondeLancar: "Dossiê anual ao IEPHA-MG (SIPAC)", prazo: "Entrega anual do dossiê (calendário IEPHA, em geral março)", documentos: ["Projeto de educação patrimonial", "Registro das atividades", "Lista de participantes"] },
      { codigo: "INV", titulo: "Inventário de proteção do patrimônio cultural elaborado pelo município", nota: 2, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Plano de inventário", "Fichas de inventário", "Relatório de desenvolvimento"] },
      { codigo: "FU", titulo: "Fundo Municipal de Preservação do Patrimônio Cultural criado e com gestão dos recursos", nota: 3, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Lei de criação do fundo", "Movimentação financeira", "Prestação de contas"] },
      { codigo: "PCL", titulo: "Planejamento e política municipal de proteção do patrimônio cultural", nota: 4, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Lei de política cultural", "Plano de ação", "Atas do Conselho do Patrimônio"], detalhe: "Item de gestão com a maior nota — independe de ter bem tombado." },
      { codigo: "NH", titulo: "Núcleo histórico urbano tombado (estadual/federal ou municipal)", nota: 16, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Decreto/lei de tombamento", "Dossiê de tombamento", "Perímetro e nº de domicílios"], detalhe: "Nota de 3 a 16 conforme o nível do tombamento e o número de domicílios no perímetro." },
      { codigo: "CP", titulo: "Conjuntos urbanos ou paisagísticos tombados", nota: 5, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Ato de tombamento", "Planta com área em hectares", "Relação de unidades"], detalhe: "Nota de 1 a 5 conforme a área ou o número de unidades." },
      { codigo: "BI", titulo: "Bens imóveis tombados isoladamente", nota: 8, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Atos de tombamento", "Fichas dos bens", "Acervo de bens móveis vinculados"], detalhe: "Nota de 1 a 8 conforme a quantidade de imóveis tombados." },
      { codigo: "BM", titulo: "Bens móveis tombados isoladamente", nota: 3, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Atos de tombamento", "Inventário do acervo"], detalhe: "Nota de 1 a 3 conforme a quantidade." },
      { codigo: "RI", titulo: "Registro de bens imateriais", nota: 4, ondeLancar: "Dossiê anual ao IEPHA-MG", prazo: "Entrega anual do dossiê", documentos: ["Dossiê de registro", "Termo de registro", "Plano de salvaguarda"], detalhe: "Nota de 2 a 4 conforme o número de bens registrados." },
    ],
  },

  meio_ambiente: {
    tipo: "proporcao",
    formula: "Art. 4º: 45,45% saneamento (lixo/esgoto licenciados), 45,45% Índice de Conservação (Anexo IV) e 9,1% mata seca. Publicação trimestral da Semad.",
    itens: [
      { codigo: "SAN-LIXO", titulo: "Sistema de tratamento ou disposição final de lixo licenciado atendendo ≥ 70% da população urbana", nota: null, parcelaPct: 45.45, ondeLancar: "Cadastro no ICMS Ecológico — Feam/Semad", prazo: "Trimestral (último dia do trimestre civil)", documentos: ["Licença de operação", "Relatório de operação", "População atendida"] },
      { codigo: "SAN-ESG", titulo: "Estação de tratamento de esgoto licenciada atendendo ≥ 50% da população urbana", nota: null, parcelaPct: 45.45, ondeLancar: "Cadastro no ICMS Ecológico — Feam/Semad", prazo: "Trimestral", documentos: ["Licença de operação da ETE", "Relatório de monitoramento", "População atendida"] },
      { codigo: "SAN-FQ", titulo: "Fator de qualidade do saneamento (0,1 a 1,0)", nota: null, ondeLancar: "Avaliação anual da Feam", prazo: "Anual", documentos: ["Desempenho operacional", "Gestão multimunicipal / consórcio", "Coleta seletiva com associação de catadores", "Energia gerada pelo sistema"], detalhe: "Multiplica o valor do saneamento. Coleta seletiva formalizada e consórcio elevam o fator." },
      { codigo: "UC", titulo: "Unidades de conservação municipais criadas e cadastradas (Anexo IV)", nota: null, parcelaPct: 45.45, ondeLancar: "Cadastro e renovação anual junto ao IEF/Semad", prazo: "Renovação anual da autorização", documentos: ["Lei/decreto de criação", "Memorial descritivo e área", "Plano de manejo", "Conselho gestor"], detalhe: "Parques naturais municipais e RPPNs têm fator de conservação 1,0 — é o maior retorno por hectare." },
      { codigo: "UC-FQ", titulo: "Fator de qualidade das unidades de conservação (0,1 a 1,0)", nota: null, ondeLancar: "Avaliação do Copam/IEF", prazo: "Anual", documentos: ["Plano de manejo", "Estrutura de gestão e pessoal", "Regularização fundiária", "Investimento municipal"] },
      { codigo: "MSECA", titulo: "Área de ocorrência de mata seca informada ao IEF", nota: null, parcelaPct: 9.1, ondeLancar: "Levantamento do IEF", prazo: "Anual", documentos: ["Mapeamento da área de mata seca"] },
    ],
  },

  producao_alimentos: {
    tipo: "proporcao",
    formula: "Art. 3º: 35% área cultivada, 30% nº de pequenos produtores, 30% produtores atendidos por programa/estrutura de apoio e 5% CMDRS + PMDRS. Dados da Emater, apurados em maio e novembro.",
    itens: [
      { codigo: "AREA", titulo: "Área cultivada informada (média dos dois últimos anos)", nota: null, parcelaPct: 35, ondeLancar: "Levantamento da Emater-MG (escritório local)", prazo: "Maio e novembro de cada ano", documentos: ["Levantamento de área por cultura", "Cadastro de propriedades"] },
      { codigo: "PEQ", titulo: "Cadastro dos pequenos produtores agropecuários do município", nota: null, parcelaPct: 30, ondeLancar: "Emater-MG", prazo: "Maio e novembro", documentos: ["Relação de pequenos produtores", "DAP/CAF", "Comprovação dos requisitos do §1º do art. 3º"] },
      { codigo: "ATEND", titulo: "Programa ou órgão municipal de apoio à produção e comercialização, com produtores atendidos", nota: null, parcelaPct: 30, ondeLancar: "Emater-MG", prazo: "Maio e novembro", documentos: ["Lei/decreto do programa", "Relação de produtores atendidos", "Relatórios de assistência técnica", "Convênio com a Emater"] },
      { codigo: "CMDRS", titulo: "CMDRS constituído e PMDRS em execução", nota: null, parcelaPct: 5, ondeLancar: "Emater-MG", prazo: "Maio e novembro", documentos: ["Lei de criação do CMDRS", "Atas das reuniões", "PMDRS aprovado", "Relatório de execução do plano"], detalhe: "Item puramente administrativo — depende só de conselho ativo e plano aprovado." },
    ],
  },

  educacao: {
    tipo: "indicador",
    formula: "Art. 2º: índice composto por desempenho e equidade na aprendizagem, atendimento e nível socioeconômico dos alunos. Apurado pela FJP com dados da SEE-MG, publicado até 31 de agosto.",
    itens: [
      { codigo: "AVAL", titulo: "Participação integral nas avaliações externas (Saeb/Simave)", nota: null, ondeLancar: "SEE-MG / Inep", prazo: "Calendário das avaliações", documentos: ["Taxa de participação por escola", "Relatório de aplicação"], detalhe: "Baixa participação derruba o indicador de desempenho sem que a rede tenha piorado." },
      { codigo: "CENSO", titulo: "Censo Escolar informado corretamente (matrículas e etapas)", nota: null, ondeLancar: "Educacenso/Inep", prazo: "Maio (data de referência) e ajustes até o fim do ano", documentos: ["Relatório do Censo Escolar", "Conferência de matrículas por etapa"], detalhe: "Matrícula não declarada é atendimento que não conta no índice." },
      { codigo: "EQUI", titulo: "Redução da desigualdade de aprendizagem entre alunos", nota: null, ondeLancar: "SEE-MG", prazo: "Anual", documentos: ["Plano de recomposição de aprendizagem", "Resultados por nível de proficiência"] },
      { codigo: "NSE", titulo: "Questionário socioeconômico aplicado aos participantes", nota: null, ondeLancar: "SEE-MG / Inep", prazo: "Junto às avaliações", documentos: ["Taxa de resposta do questionário"], detalhe: "O nível socioeconômico entra no cálculo; sem resposta o município perde o ajuste que o favorece." },
    ],
  },

  saude_per_capita: {
    tipo: "proporcao",
    formula: "Critério saúde: depende de programas municipais habilitados e informados à SES-MG.",
    itens: [
      { codigo: "SIA", titulo: "Produção informada nos sistemas do SUS (SIA/SIH/e-SUS) em dia", nota: null, ondeLancar: "SES-MG / DataSUS", prazo: "Mensal", documentos: ["Relatórios de produção", "Protocolos de envio"] },
      { codigo: "PACTO", titulo: "Programação pactuada e habilitações do município atualizadas", nota: null, ondeLancar: "SES-MG (CIB)", prazo: "Anual", documentos: ["Resoluções de habilitação", "Plano Municipal de Saúde"] },
    ],
  },

  psf: {
    tipo: "proporcao",
    formula: "Parcela distribuída conforme a cobertura populacional das equipes de Saúde da Família habilitadas.",
    itens: [
      { codigo: "ESF", titulo: "Equipes de Saúde da Família habilitadas e com credenciamento vigente", nota: null, ondeLancar: "CNES / Ministério da Saúde e SES-MG", prazo: "Atualização mensal do CNES", documentos: ["Relatório CNES das equipes", "Portarias de habilitação"], detalhe: "Equipe incompleta ou fora do CNES não conta cobertura." },
      { codigo: "COB", titulo: "Ampliação da cobertura populacional da atenção primária", nota: null, ondeLancar: "SES-MG", prazo: "Anual", documentos: ["Cálculo de cobertura", "Plano de expansão de equipes"] },
    ],
  },

  receita_propria: {
    tipo: "proporcao",
    formula: "Relação entre a receita própria arrecadada pelo município e sua receita corrente, apurada pelo TCE-MG.",
    itens: [
      { codigo: "SICOM", titulo: "Prestação de contas ao Sicom/TCE-MG entregue e sem inconsistência", nota: null, ondeLancar: "Sicom — TCE-MG", prazo: "Mensal e anual, conforme calendário do TCE", documentos: ["Recibos de remessa", "Relatório de inconsistências zerado"], detalhe: "Remessa com erro subestima a receita própria informada e derruba o índice." },
      { codigo: "IPTU", titulo: "Planta genérica de valores e cadastro imobiliário atualizados", nota: null, ondeLancar: "Legislação municipal", prazo: "Antes do lançamento anual do IPTU", documentos: ["Lei da PGV", "Cadastro imobiliário atualizado", "Recadastramento"] },
      { codigo: "ISS", titulo: "Fiscalização de ISS e cobrança da dívida ativa", nota: null, ondeLancar: "Administração tributária municipal", prazo: "Contínuo", documentos: ["Autos de infração", "Execuções fiscais", "Relatório de recuperação de dívida ativa"] },
    ],
  },

  recursos_hidricos: {
    tipo: "proporcao",
    formula: "Parcela aos municípios com área alagada por reservatório de hidrelétrica, na proporção da área alagada.",
    itens: [
      { codigo: "AREA-AL", titulo: "Área alagada por reservatório reconhecida e informada", nota: null, ondeLancar: "IGAM / Semad", prazo: "Anual", documentos: ["Memorial descritivo da área alagada", "Cadastro do reservatório"], detalhe: "Só pontua município com reservatório — verifique se é caso estrutural antes de abrir ação." },
    ],
  },
};

export function quadroDoCriterio(slug: string): QuadroCriterio | null {
  return QUADROS[slug] ?? null;
}

export function itemDoCriterio(slug: string, codigo: string): ItemPontuavel | null {
  return QUADROS[slug]?.itens.find((i) => i.codigo === codigo) ?? null;
}

/** Soma das notas possíveis do quadro (só faz sentido em critérios do tipo "nota"). */
export function notaMaxima(slug: string): number | null {
  const q = QUADROS[slug];
  if (!q || q.tipo !== "nota") return null;
  return q.itens.reduce((a, i) => a + (i.nota ?? 0), 0);
}
