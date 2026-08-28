# Nome do produtor ao lado do Remetente no Crédito próprio

Hoje a aba "Crédito próprio" mostra apenas a inscrição estadual do remetente (coluna `identificacaoRemetente` do relatório de créditos). O relatório de produtores rurais do Portal do VAF traz `ie` + `nomeProdutor`, no mesmo formato de 13 dígitos — dá para cruzar exatamente.

## Limitação importante

O navegador não consegue ler sozinho "os outros arquivos da mesma pasta": por segurança, só chegam ao aplicativo os arquivos que você escolhe na janela de seleção. Então o comportamento será:

- O botão de carga passa a aceitar **vários arquivos de uma vez**. Na mesma janela, dentro da mesma pasta, você seleciona o `REL_CREDITO_...csv` e o `REL_PRODUTOR_RURAL_...csv` juntos (Ctrl+clique ou Ctrl+A).
- O sistema identifica cada um pelo conteúdo (cabeçalho), não pelo nome — funciona para qualquer município, não só Nanuque.
- Também é possível enviar só o de créditos agora e o de produtores depois: o segundo envio complementa os nomes sem refazer o cálculo.

## O que muda na tela

1. Nova coluna **"Nome do remetente"** logo depois de "Remetente", preenchida pelo cruzamento da IE. Sem correspondência, aparece "—".
2. A busca da aba passa a procurar também pelo nome do produtor.
3. A exportação CSV da aba inclui a nova coluna.
4. No cartão de carga: além de "Crédito próprio carregado…", uma linha de status do relatório de produtores, por exemplo "Nomes de remetentes: 1.242 produtores carregados — 87% das notas identificadas". Quando não houver o arquivo de produtores, um aviso discreto explica que basta selecionar os dois CSVs juntos.
5. Se o arquivo de produtores for de outro município ou de outro ano base, o aviso aponta a divergência mas ainda usa os nomes (o cruzamento é por IE).

## Detalhes técnicos

- `src/lib/vaf/creditoPortal.ts`: nova função `lerProdutoresPortal(buffer, nome)` devolvendo `Map<ieNormalizada, nomeProdutor>` (normaliza removendo `="` e zeros à esquerda, mantendo a mesma limpeza de `limparCampo`), mais `detectarTipoPlanilha(cabecalho)` para distinguir créditos × produtores. A regra de cálculo do crédito não muda.
- `ResumoCreditoPortal` ganha `produtores?: { arquivoNome, total, anoBase }` e `NotaCredito.remetenteNome` passa a ser preenchido pelo mapa quando a coluna nativa não existir; função `aplicarNomesProdutores(resumo, mapa)` para o caso de envio em dois momentos.
- `src/components/analises/CreditoProprioPortal.tsx`: `<input multiple>`, classificação dos arquivos escolhidos, mensagens de status/erro por arquivo.
- `src/components/analises/IndiceView.tsx`: coluna "Nome do remetente" na tabela da aba Crédito próprio, inclusão na busca e no `montarCsv` da exportação.
- Sem mudança de schema: as planilhas continuam sendo lidas só no navegador.
