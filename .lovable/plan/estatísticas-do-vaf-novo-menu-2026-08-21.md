# Estatísticas do VAF (novo menu)

Novo item de menu **Estatísticas** (grupo Análise), rota `/estatisticas`, com gráficos construídos a partir das apurações já gravadas (`cargas` + `contribuintes_apurados`) — sem novas tabelas e sem novos uploads.

## 1. Maiores contribuintes do município

- Seletor de quantidade: Top 5 / 10 / 20 / 50 (e campo livre).
- Seletor de período: ano/exercício e faixa de competências (ou "todas as cargas do ano").
- Gráfico de barras horizontais: empresa (nome ou IE/CNPJ) x VAF contribuído no período, com % de participação no VAF total do município.
- Gráfico de linhas/área complementar: evolução **mensal** de cada empresa do Top N (uma série por empresa, competência no eixo X) — é a visão "empresa e valor contribuído mensalmente".
- Tabela de apoio com ranking, VAF, participação % e variação vs. período anterior; exportação CSV.

## 2. Comparativo entre anos

- À medida que novas apurações anuais entram, o gráfico ganha colunas.
- Barras agrupadas: eixo X = ano, séries = empresas do Top N (do ano mais recente), valor = VAF do ano.
- Alternância de visualização: barras agrupadas / barras empilhadas (composição do VAF do município) / linhas (tendência por empresa).
- Tabela ano x empresa com variação absoluta e %, destacando entradas (empresa nova no ranking) e saídas.

## 3. Gráficos adicionais sugeridos

- **Concentração do VAF**: curva de Pareto/participação acumulada (quantas empresas somam 50%, 80%, 95% do VAF) — mostra o risco de dependência de poucos contribuintes.
- **VAF por CNAE / setor**: barras ou treemap por atividade econômica, com comparação ano a ano (usa a descrição de CNAE já disponível).
- **Sazonalidade mensal**: VAF total do município por mês, sobrepondo anos, para identificar meses fortes e fracos.
- **Composição do valor líquido**: VAF próprio, crédito interno, crédito próprio, débito e acertos por competência (usa `indices_apurados`).
- **Qualidade da declaração**: evolução do número de omissos, zerados, fora do prazo e discrepantes por competência — mede o efeito das ações de fiscalização.
- **Entradas e saídas de contribuintes**: quantas empresas passaram a declarar e quantas deixaram de declarar por competência, com o VAF associado.
- **Impacto do plano de recuperação**: VAF recuperável previsto x concluído por competência (usa `acoes_recuperacao`).

Sugestão de arranjo da tela: aba **Maiores contribuintes**, aba **Comparativo anual**, aba **Setores e qualidade** (Pareto, CNAE, sazonalidade, situações), com KPIs no topo (VAF total do período, nº de declarantes, participação do Top 10, variação vs. ano anterior).

## Detalhes técnicos

- Rota `src/routes/_authenticated/estatisticas.tsx` com abas por search param (`?aba=`), seguindo o padrão de `/analises`, e `head()` próprio.
- Componentes em `src/components/estatisticas/*`; gráficos com Recharts e tokens de cor do design system, como no restante do app.
- Dados: consulta agregada de `contribuintes_apurados` (`inscricao_estadual`, `nome`, `cnpj`, `cnae`, `vaf_atual`, `situacoes`) unida a `cargas` (competência, exercício, tipo de retorno), agrupando por empresa e por competência; agregação feita no cliente com `useQuery` + `useMemo`, com limite de linhas por carga como já é feito no painel.
- Chave de remontagem por `municipioId` para não misturar dados ao trocar de prefeitura, e exportação CSV via `src/lib/csv.ts`.
- `AppLayout` ganha o item **Estatísticas** (ícone de gráfico) no grupo Análise.
- Nenhuma alteração de schema ou de regra de cálculo existente.
