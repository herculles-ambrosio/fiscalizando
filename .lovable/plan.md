# Corrigir o filtro "Situação na Receita" em Contribuintes apurados

## O que está acontecendo

O filtro de situação na Receita Federal hoje só olha para **a página atual** do grid (as ~50 linhas carregadas), não para todos os contribuintes da apuração. Os demais filtros (situação do VAF, CNAE, situação cadastral, busca) são aplicados no banco, sobre a lista inteira.

Por isso, em São Pedro dos Ferros (556 contribuintes), ao escolher "Receita: Baixada" com "TODOS" marcado, o sistema procura empresas baixadas apenas entre as linhas da página exibida — e não encontra nenhuma. Quando você digita o CNPJ 45618351000107 na busca, o banco reduz o resultado a essa empresa, ela passa a estar na página, e aí o filtro a encontra.

O mesmo problema afeta o botão "Pendentes na Receita" (só marca pendentes da página atual).

## Como corrigir

Fazer o filtro da Receita valer para toda a apuração, e não apenas para a página:

1. Quando um filtro de Receita estiver ativo (Baixada, Ativa, Não consultado, Pendentes etc.), carregar de uma vez a lista completa de contribuintes que atendem aos demais filtros (situação, CNAE, situação cadastral, busca) — apenas os campos necessários, com o mesmo limite alto já usado em outras telas.
2. Cruzar essa lista com o cache de situações da Receita (o mesmo hook já usado, que consulta em lotes) e ficar só com quem bate com a situação escolhida.
3. Paginar e ordenar o resultado no próprio grid, mantendo o contador total coerente ("X contribuintes") e o rodapé de somas de VAF.
4. Ajustar, para o mesmo conjunto completo:
   - o botão "Pendentes na Receita" (filtra e seleciona todos os pendentes da apuração, não só da página);
   - "Selecionar todos" e o "Consultar Receita" sem seleção, respeitando o filtro de Receita ativo;
   - a exportação CSV, que deve refletir exatamente o que está filtrado.
5. Sem filtro de Receita ativo, manter o comportamento atual (paginação no banco), para não perder desempenho em municípios grandes.

## Detalhes técnicos

- Arquivo principal: `src/components/ContribuintesGrid.tsx`.
- Hoje o filtro roda em `linhasPagina` (client-side sobre a página). Introduzir uma consulta adicional, habilitada apenas quando `receitaFiltro !== "TODOS"`, que busca todos os `contribuintes_apurados` da carga com os mesmos predicados server-side (`contains(situacoes)`, `eq(cnae)`, `eq(situacao_cadastral)`, `or(...)` da busca) e `limit` alto.
- Reaproveitar `useSituacoesReceita` (que já faz lotes de 300 CNPJs) e `useFilaReceita` para classificar as linhas; com filtro ativo, ordenação e paginação passam a ser feitas em memória sobre o conjunto filtrado.
- Manter `COLUNAS_SERVIDOR` e a ordenação atual quando não houver filtro de Receita.
