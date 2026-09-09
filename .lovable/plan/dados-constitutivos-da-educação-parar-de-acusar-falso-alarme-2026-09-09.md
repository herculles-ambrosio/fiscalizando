# Dados Constitutivos da Educação — parar de acusar falso alarme

Hoje a aba compara cada número do município com a média dos demais e marca tudo que
se afasta muito. Em São Pedro dos Ferros isso gerou 35 avisos, quase todos por causa
de uma coisa só: a rede municipal não atende os Anos Finais (6º ao 9º), então todos os
números de 9º ano ficam zerados por não existir aluno, não por erro.

## O que muda na tela

A lista única vira três blocos:

1. **Indicadores que merecem atenção** (laranja) — o que sobra depois de tirar o que não
   se aplica e o que é resultado bom.
2. **Resultados positivos** (verde) — taxas em que quanto menor melhor e o município está
   abaixo da média (abandono, distorção, escolas sem acessibilidade, vulnerabilidade), e
   números em que quanto maior melhor e o município está bem acima da média.
3. **Não aplicável a este município** (cinza, fechado por padrão) — indicadores das etapas
   que a rede municipal não atende, com a frase: "Rede municipal não atende Anos Finais —
   indicadores desta etapa não se aplicam a este município (a rede estadual atende)".

A frase de resumo passa a contar só o bloco 1. No exemplo, em vez de "35 números muito
distantes da média", deve restar apenas o punhado que realmente é de etapa atendida e
com resultado ruim.

A busca e o CSV continuam funcionando; o CSV ganha uma coluna com a classificação
(atenção / positivo / não aplicável).

## Como a etapa é decidida

- Anos Finais: olha `Atendimento — matriculados_9ano_municipal`. Zero ou ausente → toda a
  etapa (colunas com `_9ano` ou `_anosfinais`) vai para o bloco "não aplicável".
- Anos Iniciais: olha `Atendimento — matriculados_5ano_municipal`. Zero ou ausente →
  colunas com `_2ano`, `_5ano` ou `_anosiniciais` vão para "não aplicável".

Nada é inferido por "tudo zerado": só o campo de matrícula decide.

## Direção desejada

Nova tabela de metadados dos indicadores (`educacao_metadados_indicador`) com a coluna do
indicador e a direção: `maior_melhor` (padrão) ou `menor_melhor`. Semeada com
`menor_melhor` para: `taxa_abandono_5ano`, `taxa_abandono_9ano`, `taxa_distorcao_5ano`,
`taxa_distorcao_9ano`, `escolas_sem_acessibilidade`,
`indice_vulnerabilidade_anosiniciais`, `indice_vulnerabilidade_anosfinais`.

Índices consolidados (`IDEi`, `IREi`, `AEi`, `iGEi` e variantes por etapa) ficam sempre
como `maior_melhor` — valor baixo neles é sempre atenção.

Leitura pública (todo usuário autenticado lê; edição só pela administração), com as
concessões de acesso no mesmo padrão das outras tabelas do módulo.

## Detalhes técnicos

- Migração: `educacao_metadados_indicador` (`indicador` texto chave, `direcao_desejada`
  texto com verificação `maior_melhor|menor_melhor`, `etapa` texto opcional, `descricao`,
  timestamps + gatilho `set_atualizado_em`), GRANT para `authenticated`/`service_role`,
  RLS com leitura para autenticado, e INSERTs de semente dos sete indicadores
  `menor_melhor`.
- Novo módulo `src/lib/icms/educacao/indicadores.ts`: normaliza `coluna_origem`
  (`"Rendimento — taxa_abandono_9ano"` → aba + indicador), deduz a etapa pelo sufixo,
  identifica índices consolidados e expõe `classificar()` devolvendo
  `atencao | positivo | nao_aplicavel` a partir de valor, média, direção e etapas
  atendidas. Testes com vitest para os casos do enunciado.
- `src/hooks/useEducacao.ts`: `useDadosConstitutivos` passa a devolver também
  `etapasNaoMunicipalizadas` (`{ anosIniciais: boolean; anosFinais: boolean }`), calculado
  uma vez a partir das linhas de matrícula do município e memorizado na chave da query
  (município, exercício, versão). Novo `useMetadadosIndicadores()` com cache longo.
- `src/components/icms/DadosConstitutivosEducacao.tsx`: reescrito em três seções
  (`Collapsible` do shadcn para a terceira), badges por classificação usando tokens do
  design system, resumo recalculado e CSV com a coluna de classificação.
- `src/hooks/useEducacao.ts` → `useOutliersEducacao` (painel de prazos) continua como
  está nesta etapa; o ajuste equivalente no painel geral fica para um passo seguinte.
