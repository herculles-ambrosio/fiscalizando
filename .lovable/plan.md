# Estatísticas: usar o Exercício como eixo temporal

## Respostas

**1. Qual o critério hoje?** As Estatísticas leem sim as Apurações Realizadas (cargas concluídas + os contribuintes apurados de cada carga). Mas o ano usado para agrupar é o **ano gravado na competência do arquivo** (`competencia_ano`), caindo no exercício só quando esse campo está vazio.

**2. Por que apareceu 2026 e 2024.** Cargas concluídas hoje:

| Município | Exercício | Tipo | Competência gravada |
|---|---|---|---|
| Martins Soares | 2025 | Retorno mensal | 12/2026 |
| Alto Caparaó | 2025 | Retorno mensal | 13/2026 |
| Nanuque | 2025 | Retorno mensal | 13/2026 |
| Nanuque | 2024 | Índice definitivo | 2024 |

Como você apontou, esse "12/2026" e "13/2026" é o **número do arquivo mensal que a SEF envia** (11, 12, 13...) e o ano de geração/entrega do arquivo — não é o mês/ano de competência do VAF. Por isso as cargas de exercício 2025 apareceram como "2026" nas Estatísticas. O norte correto é o **Exercício**, e o número do arquivo serve apenas para ordenar as remessas dentro do exercício.

## O que muda

- O ano de referência de toda a aba Estatísticas passa a ser o **Exercício da apuração**.
- Os seletores "Ano de referência" e "Anos comparados" listam exercícios (hoje: 2025 e 2024).
- Nos gráficos de série, o eixo deixa de dizer "13/2026" e passa a identificar a remessa dentro do exercício: **"Arquivo 13 · 2025"** (índice definitivo aparece como "Definitivo · 2024"), mantendo a ordem crescente do número do arquivo.
- Textos como "Sazonalidade mensal" passam a "Evolução por remessa do exercício", já que o número não é mês de competência.
- Comparativo anual, Maiores contribuintes, Setores e qualidade, Pareto e os modais de drill-down (contribuinte e setor) usam a mesma base de exercício.
- Exportações CSV acompanham os mesmos rótulos e o mesmo ano.

Nada muda no banco nem nas apurações já gravadas — é só a leitura/agrupamento das Estatísticas. As demais telas (Apurações Realizadas, Análises do VAF) continuam exibindo a competência do arquivo como hoje.

## Detalhes técnicos

- `src/lib/vaf/estatisticas.ts`: `anoDaCarga()` retorna `c.exercicio` (fallback para `competencia_ano` só se o exercício for nulo); `periodoDaCarga()` monta `ordem` a partir de `exercicio * 100 + (competencia_mes ?? mes_referencia ?? 0)` e `rotulo` no formato "Arquivo N · exercício".
- Substituir as ocorrências diretas de `c.competencia_ano ?? c.exercicio` por `anoDaCarga(c)` em `MaioresContribuintes.tsx`, `ComparativoAnual.tsx` e `SetoresQualidade.tsx`, deixando uma única fonte de verdade.
- `DetalheContribuinte.tsx` e `DetalheSetor.tsx` derivam de `periodoDaCarga`/`anoDaCarga` e herdam a correção.
- Deduplicação de cargas passa a ser por exercício + número do arquivo.
- Sem migração de banco e sem alteração no fluxo de upload/apuração.
