# Consultar a Receita também nos contribuintes "Provável baixa (só no retorno)"

## O que está acontecendo (confirmado nos dados)

Em Contribuintes apurados, o botão "Consultar Receita" monta a lista de CNPJs a consultar e, quando nenhuma situação (Omisso, Zerado, etc.) está marcada, ele **exclui de propósito** os contribuintes que só aparecem no arquivo de retorno — exatamente os que a tela mostra como "Provável baixa (só no retorno)". Essa exclusão acontece mesmo quando você filtra por essa situação cadastral, então esses contribuintes nunca entram na consulta e ficam para sempre como "Não consultado".

Números atuais: 838 CNPJs distintos com situação cadastral "Provável baixa (só no retorno)", e apenas 219 têm situação da Receita gravada. Nenhum deles está na fila de reconsulta (ou seja, não é falha de rede).

Testei os CNPJs desses contribuintes direto nas bases públicas: a maioria responde normalmente (200). Só um caso raro, com CNPJ inválido vindo do próprio arquivo de retorno (ex.: 00041951140630), não existe nas bases — esse continuará como não encontrado, e é esperado.

## Correção

1. Deixar de excluir os contribuintes "só no retorno" ao montar a lista de consulta quando nenhuma situação estiver marcada. Eles passam a ser consultados junto com os demais.
2. Manter o comportamento por escopo: com seleção manual, consulta só os marcados; com filtros ativos (situação, situação cadastral, CNAE, busca, filtro da Receita), consulta exatamente o que está filtrado.
3. Ignorar CNPJs que não passam na validação de dígitos antes de enviar à consulta, para não gastar tentativas com números inexistentes do retorno; esses aparecem no resumo como "sem CNPJ válido".
4. Sem migração e sem mudança na apuração nem nos ofícios.

## Detalhes técnicos

- `src/components/ContribuintesGrid.tsx`, função `cnpjsDoEscopo()`: remover a linha `q.not("situacoes", "cs", "{SOMENTE_RETORNO}")` do ramo sem filtro de situação.
- Usar `cnpjValido` (já existente em `src/lib/receita/normalizar.ts`) para filtrar a lista antes de `consulta.mutate`, e refletir os descartados na mensagem de resultado.
- Depois do ajuste, um clique em "Consultar Receita" com o filtro de situação cadastral "Provável baixa (só no retorno)" deve preencher as etiquetas dos ~600 CNPJs ainda pendentes (em lotes de 300, como hoje).
