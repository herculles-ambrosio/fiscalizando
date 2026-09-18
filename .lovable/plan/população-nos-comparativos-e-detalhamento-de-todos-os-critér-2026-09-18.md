# População nos comparativos e detalhamento de todos os critérios

Quatro frentes no módulo ICMS: trazer a população oficial de cada município, destacar a prefeitura ativa nas telas de critério, dar detalhamento a todos os 18 critérios e mostrar em cada um onde exatamente se faz a inscrição no governo.

## 1. População de cada município

Fonte: IBGE — é a mesma base que a Lei 18.030 usa nos critérios de População e População dos 50 mais populosos. Serão guardados dois números por município: o Censo 2022 e a estimativa mais recente publicada (atualizada uma vez por ano pelo IBGE).

- Uma tabela nova guarda código IBGE, nome, ano e população de todos os 853 municípios mineiros, já ligada à relação de municípios que o sistema usa hoje.
- Uma carga automática busca os números direto no IBGE; um botão "Atualizar população (IBGE)" na área da consultoria refaz a busca quando sair a estimativa do ano.
- No **Comparativo → Ranking**, logo depois do nome do município aparece a população (e o ano da fonte no cabeçalho). Entra também no CSV exportado.
- Como o repasse por habitante é a leitura que mais interessa, o Ranking ganha ainda a coluna "R$ por habitante", ordenável, para comparar municípios de portes diferentes.

## 2. Destaque da prefeitura ativa nos critérios

Na tela de detalhamento de um critério:

- Um cartão no topo com a prefeitura ativa: posição, pontuação, índice, população e repasse por habitante naquele critério.
- No Ranking do critério, a linha da prefeitura ativa fica destacada e há um botão "Ir para o meu município", que rola a lista até ela mesmo quando está na posição 600.
- População aparece ao lado do nome também nesse ranking.

## 3. Detalhamento para todos os critérios

Hoje só Esportes, Turismo, Meio Ambiente e Educação têm conteúdo próprio; os demais abrem uma tela quase vazia. Cada critério passa a ter uma ficha completa, mesmo sem relatório importado:

- **O que mede, como é calculado e com que dado** (com a fórmula em linguagem de gestor).
- **De onde vem o número** (órgão, publicação, periodicidade e prazo).
- **Situação do município**: valor atual quando já existe dado importado; quando não existe, a tela diz claramente o que falta importar em vez de ficar em branco.
- **Como melhorar** com ações concretas — e, nos critérios que o município não controla (Cota Mínima, Área, Municípios Mineradores, Penitenciária, Mínimo per capita, ICMS Solidário), um aviso de que não há ação municipal, evitando plano inútil.

Ordem: primeiro os quatro que já têm dados (aprofundando a análise), depois Saúde, Patrimônio Cultural, Recursos Hídricos, Produção de Alimentos, Segurança Alimentar e os estruturais.

## 4. Onde se cadastra cada item

Cada critério ganha um bloco "Onde inscrever" com órgão, o que enviar, prazo e o endereço oficial de cadastro, exibido na aba "Como melhorar" e junto de cada item faltante. Os endereços serão conferidos no ar antes de entrar no sistema (SEE-MG/FJP para Educação, Semad/Feam/IEF para Meio Ambiente, Sedese/Observatório do Esporte para Esportes, Secult para Turismo, Iepha para Patrimônio, Igam para Recursos Hídricos, Seapa/Emater para Produção de Alimentos, SES-MG para Saúde). Cada link mostra a data em que foi conferido, para que ninguém envie documento para uma página desativada.

## Detalhes técnicos

- Migração: `municipios_populacao` (codigo_ibge, codigo_sef, nome, uf, ano, populacao, fonte) com GRANT `select` para `authenticated`, `all` para `service_role`, RLS de leitura autenticada e escrita só para consultoria.
- Carga via `createServerFn` nos agregados do IBGE (6579 estimativas / 4714 Censo 2022), casando nome com `municipiosMg.ts`; hook `usePopulacao()` com cache longo.
- `comparativo.tsx`: colunas População e R$/hab no ranking e no CSV; `criterio.$slug.tsx`: cartão do município ativo, âncora "Ir para o meu município" e população no ranking.
- `src/lib/icms/criterios.ts`: cada critério ganha `comoECalculado`, `ondeCadastrar: { orgao, oQueFazer, link, prazo, conferidoEm }[]` e `oQueImportar`; a tela genérica passa a renderizar essa ficha mesmo sem relatório.

## Ordem de execução

1. Tabela e carga de população + coluna no Comparativo.
2. Destaque da prefeitura ativa nas telas de critério.
3. Bloco "Onde inscrever" nos quatro critérios principais.
4. Fichas completas dos demais critérios.
