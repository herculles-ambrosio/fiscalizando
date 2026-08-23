# Estatísticas: exercício 2024 aparecendo vazio no comparativo

## O que está acontecendo

O gráfico "Evolução ano a ano por empresa" não está errado no cálculo: ele está trabalhando com **dados incompletos**. As Estatísticas leem apenas as **primeiras 1.000 linhas** de contribuintes do município, e depois param.

Verificação feita no banco (Nanuque):

- 2025 (retorno mensal, arquivo 13): 3.365 contribuintes apurados
- 2024 (índice definitivo): 3.284 contribuintes apurados
- As Estatísticas carregam hoje: 1.000 linhas no total (519 de 2025 + 481 de 2024)

Isso explica os dois sintomas da imagem: o maior valor do gráfico é ~26 mil (quando o maior contribuinte real de Nanuque passa de 500 mil), e as empresas do Top 10 de 2025 aparecem sem barra em 2024 — as linhas de 2024 dessas empresas simplesmente não foram carregadas.

Conferido no banco: as empresas do Top 10 real de 2025 (FRISA, DMA, SANTA CLARA, etc.) **têm** valores em 2024, então o comparativo passa a exibir as duas colunas assim que os dados completos forem lidos.

## Correção

- Ler os contribuintes em páginas do tamanho que o backend realmente devolve (1.000 por requisição), continuando até acabar, em vez de parar na primeira página.
- Manter o teto de segurança de linhas e a ordenação estável, para não pesar a tela em municípios grandes.
- Nenhuma mudança de regra de cálculo, de banco ou de apuração: os mesmos gráficos passam a somar o conjunto completo.

## Efeito esperado

- KPIs do topo (VAF total, declarantes, participação do Top 10) passam a refletir os valores reais.
- "Evolução ano a ano por empresa" mostra barras em 2024 e 2025.
- Maiores contribuintes, Pareto, setores e qualidade passam a considerar todos os contribuintes.

## Detalhes técnicos

- `src/hooks/useEstatisticas.ts`: `PAGINA` passa de 5000 para 1000 (limite de linhas por resposta do PostgREST) e o laço encerra quando o lote vier menor que a página; o teto absoluto continua protegendo contra cargas gigantes.
