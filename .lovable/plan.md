# Previsão por critério (repasses 2027 com cenário de recuperação)

## O que o usuário vai ver
Nova tela **Previsão por critério** no módulo ICMS (item de menu próprio), para o município ativo:

- **Resumo no topo:** total previsto 2027 somando todos os critérios, total com recuperação e o ganho em R$.
- **Tabela por critério** (VAF, Educação, Patrimônio Cultural, Meio Ambiente, Esportes, Turismo, População, Área e demais):
  - índice atual do município no critério;
  - participação do critério na bolada do Estado (peso da Lei 18.030/2009);
  - repasse estimado 2026 (ano fechado) e previsto 2027;
  - diferença em R$ e % (verde se sobe, vermelho se cai, negrito);
  - **Com recuperação**: para o VAF usa o valor a recuperar da Previsão de repasse (Potencial mapeado, editável); para os demais critérios, campo opcional "índice alvo" editável na linha.
  - linha **Total** ao final.
- **Gráfico de barras** comparando 2026, 2027 e 2027 com recuperação por critério.
- Tooltip em cada valor previsto mostrando a conta (bolada do critério x índice).
- Exportação em **CSV** e **PDF** (papel timbrado), com a memória de cálculo.
- Critério sem índice cadastrado aparece com "sem dados" e não entra no total.

## Como é feita a conta
```text
bolada do critério 2027 = bolada anual do Estado (75% VAF + 25% demais)
                          x peso do critério x fator da base de receita
previsto 2027          = bolada do critério x índice do município / 100
com recuperação (VAF)  = mesma regra da Previsão de repasse (acréscimo de índice)
com recuperação (demais) = bolada do critério x índice alvo / 100
```
A base de receita (repetir o Estado / crescimento pela arrecadação / manual) segue o mesmo seletor da Previsão de repasse.

## Detalhes técnicos
- Rota nova `src/routes/_authenticated/icms/previsao-criterios.tsx` com head() próprio; item no menu em `AppLayout.tsx`.
- `src/lib/icms/previsaoCriterios.ts`: função pura `preverPorCriterio({ boladaEstado, pesos, indices, fator, recuperacao })` + teste.
- Dados: índices por critério de `useIcms` (icms_indices do exercício mais recente), bolada de `useRepassesEstado` (vaf_75 e robin_hood_25), pesos de `src/lib/icms/criterios.ts`, VAF e recuperação reaproveitando `acrescimoIndiceRecuperacao` e `usePotencialRecuperacao`.
- Sem mudança no banco; os índices alvo digitados ficam na preferência do usuário (preferencias_usuario).
- Primeiro passo da implementação: conferir quais critérios têm índice gravado para o município e como a bolada dos 25% é distribuída pelos pesos; ajustar a conta se o dado disponível exigir.
