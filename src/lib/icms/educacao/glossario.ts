/**
 * Explicação em linguagem simples de cada dado constitutivo da Educação
 * (planilha SEE/FJP). Serve para o tooltip da tela "Dados constitutivos".
 */

const SEM_ACENTO = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function normalizarIndicador(indicador: string): string {
  return SEM_ACENTO(indicador)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ETAPA: Record<string, string> = {
  "2": "2º ano do ensino fundamental",
  "5": "5º ano (fim dos Anos Iniciais)",
  "9": "9º ano (fim dos Anos Finais)",
};

/** Descrições por indicador, já sem o sufixo de ano. */
const DESCRICOES: Record<string, string> = {
  // ---- Atendimento -------------------------------------------------------
  aei: "Índice de Atendimento Escolar: mede o quanto a rede municipal atende as crianças e jovens em idade escolar. Compõe o índice final da Educação.",
  iatendimento:
    "Nota de atendimento escolar: proporção de estudantes atendidos pela rede municipal em relação ao total da rede pública do município.",
  ieja: "Nota da Educação de Jovens e Adultos: participação do município na oferta de EJA dentro da rede pública local.",
  imatriculas:
    "Nota de matrículas: peso das matrículas da rede municipal no conjunto das matrículas públicas do município.",
  itempo_integral:
    "Nota de tempo integral: proporção de matrículas municipais em jornada ampliada (educação infantil e ensino fundamental).",
  matriculados_5ano_municipal:
    "Número de alunos matriculados no 5º ano na rede municipal. É esse número que mostra se o município atende os Anos Iniciais.",
  matriculados_5ano_publico:
    "Número de alunos matriculados no 5º ano em toda a rede pública do município (municipal + estadual).",
  matriculados_9ano_municipal:
    "Número de alunos matriculados no 9º ano na rede municipal. Se for zero, o município não atende os Anos Finais e os indicadores dessa etapa não se aplicam.",
  matriculados_9ano_publico:
    "Número de alunos matriculados no 9º ano em toda a rede pública do município (municipal + estadual).",
  matriculados_eja_municipal:
    "Alunos da Educação de Jovens e Adultos matriculados na rede municipal.",
  matriculados_eja_publico:
    "Alunos da Educação de Jovens e Adultos matriculados em toda a rede pública do município.",
  matriculas_municipais_integral_ei_ef:
    "Matrículas municipais em tempo integral na educação infantil e no ensino fundamental.",
  matriculas_municipais_totais_ei_ef:
    "Total de matrículas municipais na educação infantil e no ensino fundamental.",
  percentual_integral_total_ei_ef:
    "Percentual das matrículas municipais que estão em tempo integral.",
  percentual_municipalizacao_eja:
    "Percentual da EJA do município que é ofertada pela rede municipal.",

  // ---- Desempenho --------------------------------------------------------
  idei: "Índice de Desempenho Educacional: resultado das avaliações de aprendizagem da rede municipal. Quanto maior, melhor — é um dos pilares da nota de Educação.",
  idee_i: "Desempenho educacional esperado x observado na etapa.",
  ideei:
    "Desempenho esperado para a etapa, calculado a partir do perfil socioeconômico dos alunos. Serve de referência para saber se a rede foi além ou ficou abaixo do previsto.",
  deei: "Diferença entre o desempenho observado e o desempenho esperado da etapa. Positivo significa que a rede rendeu acima do previsto para o seu perfil de alunos.",
  desempenho:
    "Resultado de aprendizagem medido pelas avaliações estaduais (SIMAVE) na etapa.",
  desempenho_esperado:
    "Resultado que se esperava da rede na etapa, considerando o nível socioeconômico dos alunos.",
  estimativa_coeficiente_angular:
    "Parâmetro estatístico do cálculo do desempenho esperado (inclinação da reta que relaciona nível socioeconômico e proficiência). É de uso interno da metodologia.",
  estimativa_coeficiente_linear:
    "Parâmetro estatístico do cálculo do desempenho esperado (ponto de partida da reta). É de uso interno da metodologia.",
  estudantes_recomendado_avancado:
    "Percentual de alunos que atingiram os níveis Recomendado ou Avançado nas avaliações da etapa.",
  indice_vulnerabilidade_anosfinais:
    "Índice de vulnerabilidade social dos alunos dos Anos Finais (6º ao 9º ano). Quanto maior, mais desafiador é o contexto — o número entra para ajustar a comparação entre municípios.",
  indice_vulnerabilidade_anosiniciais:
    "Índice de vulnerabilidade social dos alunos dos Anos Iniciais (1º ao 5º ano). Quanto maior, mais desafiador é o contexto atendido pela rede.",
  nse: "Nível socioeconômico médio dos alunos da rede. É usado para calcular o desempenho esperado, e não para punir ou premiar o município.",
  proficiencia_media_port_mat:
    "Média das notas de Língua Portuguesa e Matemática dos alunos da etapa nas avaliações estaduais.",
  taxa_participacao_simave:
    "Percentual de alunos da etapa que efetivamente fizeram a avaliação SIMAVE. Participação baixa compromete o resultado do município.",

  // ---- Rendimento --------------------------------------------------------
  irei: "Índice de Rendimento Escolar: junta aprovação, abandono e distorção idade-série. Quanto maior, melhor.",
  rendimento: "Nota de rendimento escolar da etapa (aprovação e permanência dos alunos).",
  taxa_aprovacao: "Percentual de alunos aprovados na etapa. Quanto maior, melhor.",
  taxa_abandono:
    "Percentual de alunos que abandonaram a escola na etapa. Quanto MENOR, melhor — ficar abaixo da média estadual é resultado positivo.",
  taxa_distorcao:
    "Percentual de alunos com pelo menos dois anos de atraso em relação à idade certa da série. Quanto MENOR, melhor.",
  proporcao_deficiencia_anosfinais:
    "Proporção de alunos com deficiência nos Anos Finais. Entra como ajuste de contexto na comparação entre redes.",
  proporcao_deficiencia_anosiniciais:
    "Proporção de alunos com deficiência nos Anos Iniciais. Entra como ajuste de contexto na comparação entre redes.",
  fator_porte_rede:
    "Fator que corrige o resultado pelo tamanho da rede municipal, evitando que redes muito pequenas oscilem demais.",

  // ---- Gestão ------------------------------------------------------------
  igei: "Índice de Gestão Educacional: reúne formação dos professores, gestão democrática e infraestrutura das escolas.",
  ige_afdi:
    "Parte do índice de gestão referente à adequação da formação dos docentes que atuam na rede.",
  ige_gdi:
    "Parte do índice de gestão referente à gestão democrática: diretores escolhidos com participação da comunidade escolar.",
  ige_iei:
    "Parte do índice de gestão referente à infraestrutura das escolas (água potável, esgoto, internet e acessibilidade).",
  escolas_agua_potavel: "Quantidade de escolas municipais com água potável.",
  escolas_esgotamento_sanitario:
    "Quantidade de escolas municipais ligadas a esgotamento sanitário adequado.",
  escolas_internet_ensino:
    "Quantidade de escolas municipais com internet usada em atividades de ensino.",
  escolas_com_acessibilidade:
    "Quantidade de escolas municipais com acessibilidade para pessoas com deficiência.",
  escolas_sem_acessibilidade:
    "Quantidade de escolas municipais SEM acessibilidade. Quanto menor, melhor — cada escola adequada melhora o índice de gestão.",
  proporcao_escolas_agua_potavel: "Percentual das escolas municipais com água potável.",
  proporcao_escolas_esgotamento_sanitario:
    "Percentual das escolas municipais com esgotamento sanitário adequado.",
  proporcao_escolas_internet_ensino:
    "Percentual das escolas municipais com internet para uso pedagógico.",
  proporcao_escolas_acessibilidade:
    "Percentual das escolas municipais com acessibilidade.",
  proporcao_docentes_formacao_adequada_ef:
    "Percentual de professores do ensino fundamental com formação adequada à disciplina que lecionam.",
  percentual_selecionam_gestao_democratica_totais:
    "Percentual de diretores escolhidos por processo de gestão democrática (eleição/seleção com participação da comunidade).",
  vinculos_diretores_gestao_democratica:
    "Número de diretores da rede municipal escolhidos por gestão democrática.",
  vinculos_diretores_totais: "Número total de diretores da rede municipal.",
};

/** Explicação do indicador para o tooltip, já com a etapa quando houver. */
export function descricaoIndicador(indicador: string): string | null {
  const chave = normalizarIndicador(indicador);
  const m = chave.match(/^(.*?)_?(2|5|9)_?ano$/);
  const base = m ? m[1]! : chave;
  const etapa = m ? ETAPA[m[2]!] : null;
  const texto = DESCRICOES[base] ?? DESCRICOES[chave] ?? null;
  if (!texto) return null;
  return etapa ? `${texto} Etapa medida: ${etapa}.` : texto;
}
