# Corrigir VAF 100× menor nas Apurações realizadas

## O problema (confirmado no arquivo de retorno)

No arquivo `P443RT1326-5.txt`, a COMPANHIA ENERGETICA SANTA CLARA (IE 4430519620129) traz:

- registro 07 — VAF próprio `56064286`
- registro 02 — valor adicionado anterior `16795136`

A Análise do VAF (Variação por contribuinte) lê esses campos como reais inteiros e mostra
R$ 56.064.286,00 / R$ 16.795.136,00 — que é o valor correto.

Já a apuração de contribuintes usa o leitor genérico de linhas, que aplica **2 casas decimais
implícitas** a todo campo numérico. Por isso "VAF atual" e "VAF anterior" saem exatamente 100×
menores (560.642,86 / 167.951,36). Detalhe que reforça o diagnóstico: o VAF de SIMEI (registro 40),
na mesma apuração, já é lido como reais inteiros — ou seja, hoje a mesma tela mistura dois critérios.

## Correção

1. Ler `valor_vaf` (registro 10) e `valor_adicionado_anterior` (registro 02) como reais inteiros,
   igual ao que a Análise do VAF e o registro 40 já fazem. Nada mais muda na regra de apuração:
   variação %, situações (omisso, zerado, discrepante, fora do prazo) e limiar continuam iguais,
   pois a variação é uma razão entre os dois valores.
2. Corrigir as apurações já gravadas: multiplicar por 100 o `vaf_atual` e o `vaf_anterior` dos
   contribuintes já apurados, para que Contribuintes, Estatísticas, Pareto, ranking, ofícios e
   plano de recuperação passem a exibir os valores certos sem precisar reenviar os arquivos.
3. Conferir depois da correção: o total do exercício nas Estatísticas e o "VAF na remessa anterior"
   em Contribuintes devem bater com a Variação por contribuinte da Evolução.

### Detalhes técnicos

- `src/lib/vaf/parser.ts`: manter o campo `*_num` mas sem dividir por 100 nos campos monetários dos
  arquivos da SEF (os valores vêm em reais inteiros, sem centavos implícitos). Alternativa
  equivalente: em `src/lib/vaf/apurar.ts`, ler os dígitos brutos dos dois campos, como já é feito
  em `registrosSimeiDoRetorno`.
- Migração de dados: `UPDATE public.contribuintes_apurados SET vaf_atual = vaf_atual * 100,
  vaf_anterior = vaf_anterior * 100` (aplicada uma única vez, com marcação para não repetir).
- Teste unitário cobrindo a linha real do registro 07/02 da Santa Clara, fixando 56.064.286,00 e
  16.795.136,00 como esperados.

## Resposta: o que é "Origem do cadastro"

É uma coluna de rastreabilidade, não um valor fiscal. O arquivo de retorno não traz nome e CNPJ em
um lugar único — dependendo do contribuinte eles aparecem no registro 01 (declaração), 10
(histórico do VAF), 11 (crédito externo), 35 ou 40 (SIMEI). A coluna mostra, no formato
`origem do nome/origem do CNPJ`, de qual registro cada dado foi aproveitado:

- `11/11` — nome e CNPJ vieram do registro 11
- `01/10` — nome do registro 01 e CNPJ do registro 10
- `—` no lugar de um dos lados — aquele dado não foi encontrado em nenhum registro (a linha fica
  destacada em âmbar como "cadastro incompleto")

Serve para auditar por que um contribuinte aparece sem nome/CNPJ e para saber a confiabilidade do
pareamento por inscrição estadual. Se preferir, posso renomear para algo como "Registro de origem
(nome/CNPJ)" e adicionar a mesma explicação em tooltip no cabeçalho.
