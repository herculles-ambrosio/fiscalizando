# Estatísticas: panorama de todos os municípios

A tela **Estatísticas** deixa de mostrar os gráficos por contribuinte e passa a ser o painel comparativo de todas as prefeituras: para cada município, o índice do ano-base contra o índice atual (provisório por padrão), quem subiu, quem caiu e quais providências estão em andamento.

## Cabeçalho (filtros)

- **Ano-base**: exercício já apurado que serve de referência (ex.: 2024, com apuração definitiva).
- **Comparar com**: exercício e tipo — **Provisório (padrão)**, Definitivo ou uma remessa específica (arquivo 12, 13, 14…). Quando há mais de uma remessa provisória no exercício, vale a mais recente, e é possível escolher outra.
- Filtro de texto por município e ordenação por variação, índice ou nome.
- Consultoria vê todas as prefeituras; usuário de prefeitura vê apenas a sua (regra de acesso já existente).

## Cartões de resumo

- Municípios comparados, quantos subiram, quantos caíram e quantos ainda sem apuração no período escolhido.
- Soma dos índices do ano-base x do período comparado e a variação total.

## Tabela principal (uma linha por município)

| Município | Índice base | Valor base | Índice atual | Valor atual | Variação (pontos e %) | Situação | Providências |

- Situação: **Subiu**, **Caiu**, **Estável** (variação abaixo de 0,5%) ou **Sem apuração**, com cor e ícone.
- A coluna Providências resume, no exercício comparado: ações do plano de recuperação (total, quantas com ofício enviado, quantas concluídas e valor a recuperar), impugnações montadas (situação e protocolo) e ofícios emitidos.
- Clicar na linha abre um painel lateral com o detalhe: composição do índice (VAF próprio, créditos, débito, valor líquido), lista das ações por status e as impugnações com data de protocolo.

## Gráficos

- Barras horizontais de variação por município (verde para alta, vermelho para queda), ordenadas da maior queda à maior alta.
- Barras agrupadas índice base x índice atual para os municípios exibidos.

## Exportação

- CSV com todas as colunas da tabela, respeitando filtros e ordenação.

## Detalhes técnicos

- Rota `src/routes/_authenticated/estatisticas.tsx` reescrita; abas e componentes atuais (`MaioresContribuintes`, `ComparativoAnual`, `SetoresQualidade`, `DetalheContribuinte`, `DetalheSetor`, `selecaoCargas`, `useEstatisticas`, `lib/vaf/estatisticas.ts`) deixam de ser usados por essa rota e são removidos junto com os `head()`/textos correspondentes.
- Novo hook `src/hooks/usePanoramaMunicipios.ts`: uma consulta a `indices_apurados` (todos os municípios visíveis, sem filtro por município ativo) trazendo `municipio_id, exercicio, tipo_indice, competencia_mes, competencia_ano, estimado, indice, valor_liquido, vaf_proprio, credito_*, debito, criado_em`, unida à lista de `municipios` de `useMunicipios()`.
- Providências: consultas agregadas por município e exercício em `acoes_recuperacao` (contagem e soma por `status`), `impugnacoes` (`status`, `protocolo_numero`, `protocolado_em`) e `oficios_emitidos` (contagem). Agregação no cliente com `useMemo`.
- Seleção do índice comparado: dentro do exercício/tipo escolhido, vence a maior `competencia_mes` (empate pelo `criado_em` mais novo); o tipo definitivo ignora `competencia_mes`.
- Variação em pontos percentuais do índice e em % relativa, com `formatarMoeda`/`formatarPercentual` de `src/lib/format.ts`; CSV via `src/lib/csv.ts`; gráficos em Recharts com os tokens de cor já usados no app.
- Filtros guardados em search params (`base`, `alvo`, `tipo`, `remessa`) para o estado ser compartilhável, seguindo o padrão de `/analises`.
- Nenhuma alteração de banco, de RLS ou das regras de cálculo existentes.
