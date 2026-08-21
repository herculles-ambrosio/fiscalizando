# Estatísticas: usar o Exercício como eixo temporal

## Respostas

**1. Qual o critério hoje?** As Estatísticas leem sim as Apurações Realizadas (cargas com status "concluída" + os contribuintes apurados de cada carga). Mas o ano usado para agrupar é o **ano da competência** do arquivo (`competencia_ano`), caindo no exercício só quando a competência não existe.

**2. Por que apareceu 2026 e 2024.** Conferindo as cargas concluídas hoje:

| Município | Exercício | Tipo | Competência |
|---|---|---|---|
| Martins Soares | 2025 | Retorno mensal | 12/2026 |
| Alto Caparaó | 2025 | Retorno mensal | 13/2026 |
| Nanuque | 2025 | Retorno mensal | 13/2026 |
| Nanuque | 2024 | Índice definitivo | 2024 |

Ou seja, as cargas mensais têm exercício 2025 mas competência gravada com ano 2026 (ano de entrega/geração do arquivo). Como as Estatísticas agrupam pela competência, essas cargas viram "2026" — daí os anos 2026 e 2024 que você viu. Você está certo: o norte das comparações temporais deve ser o **Exercício**.

## O que muda

- O ano de referência de toda a aba Estatísticas passa a ser o **Exercício da apuração**, não o ano da competência.
- Seletores "Ano de referência" e "Anos comparados" passam a listar exercícios (no caso atual: 2025 e 2024).
- Rótulos de competência nos gráficos mensais passam a exibir o mês com o exercício (ex.: "13/2025" em vez de "13/2026"), mantendo a ordenação mês a mês dentro do exercício.
- Comparativo anual, Maiores contribuintes, Setores e qualidade, Pareto, sazonalidade e os modais de drill-down (contribuinte e setor) passam todos a usar a mesma base de exercício.
- Exportações CSV acompanham a mesma mudança de rótulo/ano.
- Deduplicação de cargas (quando a mesma competência foi reprocessada) passa a ser por exercício + mês, para não misturar meses de exercícios diferentes.

Nada é alterado no banco nem nas apurações já gravadas — a mudança é só de leitura/agrupamento nas Estatísticas.

## Detalhes técnicos

- `src/lib/vaf/estatisticas.ts`: `anoDaCarga()` passa a retornar `c.exercicio` (com fallback para `competencia_ano` apenas se o exercício estiver nulo); `periodoDaCarga()` monta `ordem` e `rotulo` com o mês da competência + o exercício.
- Substituir todas as ocorrências diretas de `c.competencia_ano ?? c.exercicio` por `anoDaCarga(c)` em `MaioresContribuintes.tsx`, `ComparativoAnual.tsx` e `SetoresQualidade.tsx`, para haver uma única fonte de verdade.
- `DetalheContribuinte.tsx` e `DetalheSetor.tsx` já derivam o ano de `periodoDaCarga`/`anoDaCarga`, então herdam a correção.
- Sem migração de banco e sem alteração no fluxo de upload/apuração.
