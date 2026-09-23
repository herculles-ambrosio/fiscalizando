# Previsão de repasse — base pela arrecadação do Estado

## Contexto
Hoje a base de receita de 2027 tem três opções: repetir o ano, aplicar um crescimento digitado manualmente, ou digitar a receita. Vamos adicionar uma quarta opção que calcula o crescimento sozinha, a partir da arrecadação do Estado nos dois anos que geraram os índices usados na projeção.

## O que muda para o usuário

### Nova opção na base de receita
Em **Apura VAF → Previsão de repasse**, no seletor "Base de receita de 2027", nova opção **"Crescimento pela arrecadação do Estado"**.

Ao escolhê-la, um quadro aparece com:
- Arrecadação do Estado no ano da apuração anterior (ex.: R$ 925.287.575.000,00)
- Arrecadação do Estado no ano da apuração atual (ex.: R$ 1.004.153.256.799,00)
- Crescimento calculado: **+8,52%** (com exemplo de Alto Caparaó: 1.004.153.256.799 ÷ 925.287.575.000 − 1)
- Os dois valores vêm automaticamente das apurações salvas (campo `vaf_estadual` dos dois índices que formam a projeção) e podem ser **editados manualmente** quando o usuário tiver um número oficial mais atualizado — o percentual recalcula na hora.

### Cálculo
- Bolada/receita 2027 = total de 2026 × (arrecadação atual ÷ arrecadação anterior)
- Funciona tanto com a bolada do Estado cadastrada quanto com o extrato do município (cálculo reverso), igual às outras opções.
- O quadro "Como chegamos nesse valor" passa a mostrar também as duas arrecadações e o crescimento aplicado.

### Salvamento da simulação
A escolha da base e os valores digitados são gravados junto à simulação, como já acontece hoje.

## Detalhes técnicos
- `src/lib/vaf/previsaoRepasse.ts`: novo tipo de base `arrecadacao_estado` com `fatorArrecadacao` (arrecadacaoAtual / arrecadacaoAnterior); validação de divisão por zero e valores ausentes (cai para "repetir o ano" com aviso); testes em `previsaoRepasse.test.ts`.
- `src/components/analises/PrevisaoRepasse.tsx`: nova opção no seletor, quadro com os dois campos editáveis (formato moeda pt-BR), cálculo do % em tempo real, leitura de `vaf_estadual` das duas apurações via `useIndicesSalvos` já existente.
- Sem migração de banco — usa `indices_apurados.vaf_estadual` existente.

## Verificação
- Testes unitários do cálculo; typecheck; build.
- Conferência visual no navegador da tela de previsão com a nova opção.
