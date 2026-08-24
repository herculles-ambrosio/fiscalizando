# Revalidação automática do detalhamento dos índices salvos

Hoje 6 índices estão no histórico e nenhum deles tem detalhamento gravado (a gravação passou a existir agora). O plano faz o sistema reconstruir esse detalhamento sozinho, a partir do arquivo de retorno que já está guardado na apuração correspondente, e deixa claro na listagem quais índices já estão prontos.

## O que muda

### 1. Revalidação automática ao abrir um índice antigo

Ao clicar numa linha do histórico sem detalhamento, o sistema:

1. procura o arquivo de retorno guardado — primeiro pela apuração vinculada ao índice, e, quando não houver vínculo, pela apuração do mesmo município/exercício com o mesmo tipo de retorno (mensal ou índice definitivo);
2. baixa e reprocessa esse arquivo, remontando créditos externos, entre municípios, contribuintes e SIMEI;
3. grava o detalhamento no armazenamento e vincula ao registro, para que a próxima abertura seja instantânea;
4. exibe o detalhamento na tela normalmente, sem aviso.

Também haverá um botão "Revalidar detalhamento" no cartão de detalhamento e na listagem, para forçar a operação.

Situação dos registros atuais:
- 2 índices provisórios (Nanuque e Conselheiro Pena, remessa 13/2025): arquivo guardado, revalidam automaticamente.
- 2 índices definitivos de 2024 (Nanuque e o município 003): existe apuração definitiva com o arquivo guardado, revalidam automaticamente.
- 2 índices definitivos de 2024 (municípios 810 e 184): o arquivo de índices definitivos nunca foi carregado como apuração, então não há como reconstruir — esses continuarão pedindo o recarregamento manual do arquivo.

Observação: a aba "Crédito próprio" que vem da planilha do Portal do VAF não é reconstruível (o CSV não é guardado). Nos índices provisórios que usaram planilha, o aviso dirá que só essa aba precisa da planilha novamente.

### 2. Aviso com orientação exata

Quando a revalidação automática não for possível, o aviso passa a trazer o passo a passo com os nomes reais dos arquivos do registro, por exemplo:

```text
Detalhamento não disponível
Este índice foi salvo antes da gravação do detalhamento e o arquivo de origem
não está guardado no sistema.

Para regravar:
1. Selecione o arquivo de retorno "P810RTINDICESDEFINITIVOS25.txt" no campo acima.
2. Se houver, envie a planilha do Portal do VAF "REL_CREDITO_...csv".
3. Confirme exercício 2024 / remessa e clique em "Salvar no histórico" —
   o registro será substituído, mantendo o mesmo índice.
```

### 3. Status na listagem de históricos

Na tabela de históricos, cada linha ganha uma coluna "Detalhamento" com:

- **Pronto** (verde) — detalhamento gravado;
- **Reconstruível** (âmbar) — sem detalhamento, mas o arquivo está guardado; com botão para revalidar ali mesmo;
- **Faltando** (cinza/vermelho) — precisa recarregar o arquivo manualmente.

Um botão "Revalidar pendentes" no topo do cartão processa em lote todos os reconstruíveis do município, com contagem de sucesso/falha ao final.

## Detalhes técnicos

- `src/lib/vaf/revalidarIndice.ts` (novo): dado um `IndiceSalvo`, localiza a carga de origem (`carga_id`, senão `municipio_id` + `exercicio` + `tipo_retorno` derivado de `tipo_indice`/`competencia_mes`), baixa `arquivo_retorno_path` do bucket `uploads`, decodifica com `decodificarArquivo`, roda `apurarIndice` e devolve o `DetalhamentoIndice`; grava em `<municipio_id>/indices/<id>.json` e atualiza `detalhamento_path`. Reaproveita o padrão de `reprocessar.ts`.
- `src/hooks/useIndicesHistorico.ts`: novo `useRevalidarDetalhamento` (mutation individual e em lote) invalidando `["indices-salvos", municipioId]`; nova query leve `useCargasComRetorno(municipioId)` para saber quais registros são reconstruíveis (lista de cargas com `arquivo_retorno_path`).
- `src/components/analises/IndiceView.tsx`: em `carregarDoHistorico`, se `detalhamento_path` estiver vazio, tenta a revalidação antes de mostrar o aviso; aviso reescrito com os nomes de arquivo do registro e botão "Tentar revalidar"; mantém o spinner atual.
- `src/components/HistoricoIndices.tsx`: coluna de status + botão por linha e ação em lote no cabeçalho do cartão (com `no-print` para não sair na impressão).
- Sem alteração de schema: `detalhamento_path` e as políticas do bucket já existem.
