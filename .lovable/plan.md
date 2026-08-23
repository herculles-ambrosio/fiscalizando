# Estatísticas: alinhar os indicadores à Análise do VAF

## O problema confirmado nos dados

Prefeitura Nanuque, exercício 2025:

- Arquivo 12: R$ 2.256.468,13 (3.365 contribuintes)
- Arquivo 13: R$ 2.256.608,57 (os mesmos 3.365 contribuintes)
- KPI atual "VAF total 2025": R$ 4.513.076,70 = 12 + 13, ou seja o exercício contado em dobro
- "Variação vs. ano anterior" (+62,8%) compara esse valor dobrado com 2024 definitivo (R$ 2.771.464,68)
- "Participação do Top 10" (110,9%) passa de 100% porque o total inclui R$ ‑1,37 mi de contribuintes com VAF negativo, que na Análise do VAF **não compõem o índice**

## O que muda

1. **Uma remessa por exercício.** Quando o exercício não tem índice definitivo, as Estatísticas passam a usar apenas a remessa mais recente do exercício (ex.: arquivo 13 substitui o 12), em vez de somar todas. Com índice definitivo, ele continua vencendo (modo "Apuração definitiva").
2. **VAF negativo não compõe.** Totais, rankings, Pareto, setores e a participação do Top 10 passam a desconsiderar VAF próprio negativo, exatamente como a apuração do índice faz. Assim o Top 10 nunca ultrapassa 100% e o VAF total bate com a Análise do VAF.
3. **Transparência.** O painel "Critério de comparação" passa a informar qual remessa foi usada por exercício (e quais foram substituídas), e um rodapé nos KPIs indica que valores negativos não compõem o total.

## Efeito esperado nos números do print

- VAF total 2025: ~R$ 3,6 mi (arquivo 13, sem negativos), em vez de R$ 4,51 mi
- Variação vs. 2024: recalculada sobre a base 2024 também sem negativos
- Participação do Top 10: valor entre 0 e 100%

## Detalhes técnicos

- `src/lib/vaf/estatisticas.ts`: `cargasDoExercicio` passa a devolver, no modo mensais/sem definitivo, somente a carga de maior remessa (desempate pelo `criado_em` mais recente); helper novo para VAF que compõe (`Math.max(vaf, 0)`) aplicado em `agregarPorContribuinte`, `curvaPareto` e agregações por CNAE/situação.
- `src/routes/_authenticated/estatisticas.tsx`: KPIs (total, variação, Top 10) usando os mesmos helpers.
- `src/components/estatisticas/CriterioBase.tsx`: texto e lista mostrando a remessa vencedora e as substituídas; alertas de lacuna deixam de acusar "remessa faltante" quando ela foi apenas substituída.
- `MaioresContribuintes`, `ComparativoAnual`, `SetoresQualidade`, `DetalheContribuinte`, `DetalheSetor`: herdam a mesma base, sem mudança de layout.
