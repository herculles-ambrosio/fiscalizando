# Previsão de repasse com a recuperação do VAF

## O que o usuário vai ver
Na tela **Previsão de repasse**, um novo quadro **"Cenário com recuperação"**, logo abaixo da previsão atual:

- Campo **Valor a recuperar (R$)**, preenchido automaticamente com o **Potencial mapeado** da Análise do VAF do município (ex.: Lajinha, R$ 40.447.766,00). Pode ser editado, e um botão "Voltar ao potencial mapeado" desfaz a edição.
- Cartões lado a lado:
  - **Índice atual → índice com recuperação**, com a diferença em pontos e em %.
  - **Previsto 2027 sem recuperação → com recuperação**, com o ganho em R$ (verde).
- Uma coluna extra **"Com recuperação"** na tabela mês a mês, que também entra no total anual.
- As linhas do cenário entram na memória de cálculo e nas exportações em CSV e PDF.
- Se o município não tiver apuração própria (sem VAF para somar), o quadro explica que precisa de uma apuração e não mostra a projeção.

## Como é feita a conta
```text
novo valor líquido  = valor líquido da última apuração + valor a recuperar
novo índice apurado = novo valor líquido / arrecadação do Estado × 100
índice projetado    = mesma regra escolhida hoje na tela (média das duas
                      últimas ou só a última), trocando a última apuração
                      pelo novo índice
previsão 2027       = bolada do Estado × índice projetado (mesma base de receita)
```
Exemplo: se o índice médio for a média de duas apurações, somar R$ 40 milhões em uma delas conta pela metade na média, como acontece de fato.

Com a origem "Resolução da SEF" ou "Digitar", o acréscimo é somado ao índice escolhido (acréscimo = valor a recuperar / arrecadação do Estado × 100, dividido por 2 no caso da média).

## Detalhes técnicos
- `src/lib/vaf/recuperacao.ts`: reusar `montarPlanoRecuperacao` + `potencialConsolidado`. Criar hook `usePotencialRecuperacao(municipioId)` que monta o plano com os mesmos dados usados por `PlanoRecuperacao.tsx` (diagnóstico da evolução mais recente + declarantes) e devolve o total.
- `src/lib/vaf/previsaoRepasse.ts`: nova função pura `indiceComRecuperacao({ valorLiquido, vafEstadual, valorRecuperar, indiceAnterior, origem })`, com teste em `previsaoRepasse.test.ts`.
- `src/components/analises/PrevisaoRepasse.tsx`: estado `valorRecuperar` (inicia com o potencial, editável), segunda chamada de `calcularPrevisao` com o índice ajustado, novo quadro, coluna na tabela e linhas no CSV/PDF.
- Não há mudança no banco.
