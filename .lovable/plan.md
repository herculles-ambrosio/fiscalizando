# Carga da planilha do Portal do VAF para o Crédito Próprio

## O que foi verificado

Conferi a planilha anexada (`REL_CREDITO_NANUQUE...csv`, 11.413 linhas, ano base 2025):

- Filtrando `vlrNotaEntraVafb = ENTRA`:
  - `tipoCredito = Crédito Interno` soma **R$ 131.511.722,50** — praticamente idêntico ao crédito interno que o sistema já extrai do arquivo de retorno (R$ 131.511.702), o que confirma que o critério de filtro está correto.
  - `tipoCredito = Crédito próprio` soma **R$ 277.702.765,92** (9.402 notas), e 100% dessas notas têm `creditoProprioPara = 443` (Nanuque).
- Hoje, na projeção a partir do retorno mensal (`estimarIndiceProvisorio`), o campo **Crédito próprio é fixado em 0** — exatamente a lacuna que você descreveu. No arquivo definitivo (registro 16/17) ele vem preenchido (campos AF e SIARE).

## O que será feito

1. **Detecção automática**: quando a Análise do VAF estiver em modo projeção e o crédito próprio vier zerado, o painel do Índice mostra um aviso: "O arquivo de retorno não trouxe o Crédito próprio (AF/SIARE). Envie o relatório de créditos do Portal do VAF para completar a projeção."

2. **Carga da planilha**: botão para enviar o arquivo `.csv` baixado do Portal do VAF (o mesmo formato do anexo, separador `;`, acentuação Latin-1 ou UTF-8). O sistema lê e valida:
   - colunas obrigatórias presentes;
   - ano base da planilha compatível com o do retorno (aviso se divergir);
   - município: só entram notas cujo `creditoProprioPara` seja o código SEF da prefeitura ativa (443 = Nanuque). Notas de outro município são contadas à parte e mostradas como "ignoradas", com o motivo.

3. **Cálculo**: crédito próprio = soma de `valorProduto` das linhas com `vlrNotaEntraVafb = ENTRA` e `tipoCredito = Crédito próprio` do município ativo. As linhas `NÃO ENTRA` (R$ 25,2 mi nesta planilha) ficam de fora da base, mas aparecem no resumo para conferência. O frete (`vlrFrete` / `creditoFretePara__`) não entra na soma — fica exibido separadamente, já que a coluna de valor do relatório da SEFAZ é o valor de produtos.

4. **Reflexo na projeção**: o valor entra no card "Crédito próprio" (marcado com a origem "planilha do Portal do VAF") e recompõe automaticamente o **Valor líquido** e o **Índice projetado**, junto com os KPIs e a conferência do líquido.

5. **Conferência cruzada do Crédito interno**: a mesma planilha traz o Crédito Interno. O sistema compara o total da planilha com o valor lido do arquivo de retorno e mostra a diferença (aqui: R$ 20,50, ou seja, batendo). Serve só de validação — o valor usado continua sendo o do arquivo de retorno.

6. **Detalhamento e exportação**: nova aba "Crédito próprio (planilha)" com o resumo por tipo de nota (NFA/NFE) e por remetente, lista das notas (com limite de exibição), e exportação CSV do que estiver visível — no mesmo padrão das outras abas.

7. **Gravação no histórico**: ao salvar a projeção no histórico de índices, o crédito próprio vindo da planilha é gravado no campo já existente `credito_proprio`, com o nome do arquivo de origem registrado.

## Observações

- A planilha é usada apenas na projeção. Em arquivo definitivo (registro 17), o crédito próprio oficial da SEF continua prevalecendo; se você carregar a planilha nesse caso, o sistema mostra a comparação em vez de substituir.
- A planilha não fica armazenada no banco: é lida no navegador e apenas o total apurado é salvo junto com a projeção.

## Detalhes técnicos

- Novo módulo `src/lib/vaf/creditoPortal.ts`: parser de CSV com separador `;`, `decodificarArquivo` (Latin-1/UTF-8) reaproveitado de `parser.ts`, descarte da linha de rodapé ("Total de Produtos"), normalização de números pt-BR, e retorno `{ creditoProprio, creditoInterno, naoEntra, frete, porTipoNota, notas[], ignoradas[], anoBase }`.
- `src/lib/vaf/indice.ts`: `estimarIndiceProvisorio` ganha a opção `creditoProprioExterno` em `OpcoesEstimativa`, usada no campo `creditoProprio` e no `valorLiquido`; novo campo `origemCreditoProprio: "arquivo" | "planilha"` em `ApuracaoIndice`; `csvIndice` passa a exportar a origem.
- `src/components/analises/IndiceView.tsx`: input de arquivo + estado da planilha (limpo na troca de prefeitura, como as demais), aviso condicional, aba de detalhamento e export via `montarCsv`/`baixarCsv`.
- Sem mudanças de schema: `indices_apurados.credito_proprio` já existe.
