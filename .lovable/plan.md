# Previsão de repasses do VAF para o próximo exercício

## Objetivo
Estimar quanto o município deve receber de ICMS pelo critério VAF no exercício seguinte (ex.: 2027), usando a média de índices que ele alcançou na apuração atual, comparando com o que está entrando hoje (exercício 2026, índice 0,006691978 no exemplo de Alto Caparaó).

## Nova tela: Apura VAF → Previsão de repasse
Entradas no topo:
- **Exercício de aplicação** (padrão: ano seguinte ao exercício vigente).
- **Índice projetado**: vem pronto da média dos índices da apuração atual (a mesma média usada na Evolução do VAF), com possibilidade de digitar outro valor para simular.
- **Índice aplicado hoje**: lido dos dados da FJP já importados (linha VAF, último mês com informação) ou da resolução carregada, apenas para comparar.
- **Base de receita do critério VAF** — três opções:
  1. *Repetir o ano anterior*: soma dos valores da linha VAF recebidos no exercício atual, já existentes na integração com a FJP; quando o ano ainda não fechou, os meses que faltam são completados pela média dos meses recebidos.
  2. *Acompanhar o ritmo do Estado*: mesma soma do item 1, corrigida por um percentual de crescimento informado (padrão 0%), para simular arrecadação maior ou menor.
  3. *Digitar manualmente*: o usuário informa o total anual da bolada do VAF (ou o valor por ponto de índice).

## Como o cálculo funciona
1. Para cada mês do exercício atual com dado da FJP, calcula-se o valor por ponto de índice: `valor recebido no mês ÷ índice VAF do mês`.
2. A média desses valores por ponto, projetada para 12 meses, forma a base anual do critério VAF.
3. Previsão anual = `índice projetado × valor anual por ponto` (ajustado pela opção de receita escolhida).
4. Distribuição mês a mês: aplica-se a sazonalidade observada no exercício atual (a participação de cada mês no total), de modo que a previsão respeite o comportamento real do repasse.

## O que a tela mostra
- Cartões: previsão anual, recebido/projetado do ano atual, diferença em reais e em %, verde quando maior e vermelho quando menor.
- Tabela mês a mês: recebido no exercício atual × previsto no próximo, com diferença.
- Gráfico de barras comparando os dois anos.
- Linha de premissas explicando de onde saiu cada número (índice, valor por ponto, base de receita).
- Exportação em CSV.

## Observações
- Nada da apuração do VAF muda: a previsão apenas lê os índices apurados e os valores da FJP já gravados.
- Quando não houver dados da FJP do ano corrente, a tela orienta a importar o extrato e libera a digitação manual da receita.

## Detalhes técnicos
- Novo `src/lib/vaf/previsaoRepasse.ts`: funções puras `valorPorPonto(serieVaf)`, `projetarAnual(...)` e `distribuirPorMes(...)` com testes em `previsaoRepasse.test.ts`.
- Dados: `useIcmsDados(exercicio)` (série do critério `vaf` em `icms_indices`, com `indice` e `valor` por mês) + média dos índices apurados (`useIndicesHistorico`/`useIndiceAplicado`).
- Novo componente `src/components/analises/PrevisaoRepasse.tsx` e rota `src/routes/_authenticated/previsao-repasse.tsx` com `head()` próprio, mais item no menu do Apura VAF.
- Sem mudança de banco de dados; tudo é calculado a partir do que já está gravado.
