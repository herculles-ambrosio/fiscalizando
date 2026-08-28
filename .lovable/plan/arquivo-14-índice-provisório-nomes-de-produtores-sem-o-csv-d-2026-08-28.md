# Arquivo 14 = Índice provisório + nomes de produtores sem o CSV de créditos

Dois ajustes na sequência do que foi feito na última entrega.

## 1. Remessa 14 passa a ser "Índice provisório"

Hoje só a remessa 13 é reconhecida como retorno de índice (definitivo); qualquer outro número cai em "Retorno mensal", inclusive o arquivo 14.

- Em Nova apuração, ao escolher `P443RT1426.txt` o campo **Tipo de retorno** já vem marcado como **Índice provisório** (o 13 continua como **Índice definitivo**, e 1 a 12 como **Mensal**).
- O rótulo do arquivo passa a mostrar "Arquivo 14 · provisório" e, nas listas (Apurações realizadas, Estatísticas, Evolução), "2026 · Provisório" quando a remessa for 14.
- Continua sendo possível trocar o tipo manualmente; nada é bloqueado.
- Apurações já gravadas como "mensal" com remessa 14 não são alteradas automaticamente — basta reprocessar ou ajustar o tipo se quiser corrigir.

## 2. Índice do VAF: quando o retorno já traz o crédito, pedir só o produtor rural

Nos arquivos de índice (definitivo, remessa 13, e provisório, remessa 14) o crédito próprio já vem no próprio retorno — o CSV `REL_CREDITO_...` deixa de ser necessário. Hoje o cartão do Portal exige o relatório de créditos e recusa o envio isolado do relatório de produtores.

Como fica:

- Quando a apuração vier de um arquivo de índice (não estimada), o cartão muda de mensagem: em vez de "o retorno não trouxe o crédito próprio", ele diz que o crédito veio do próprio arquivo e que o CSV de produtores rurais (`REL_PRODUTOR_RURAL_...`) serve apenas para exibir o **nome do remetente**. O botão passa a se chamar "Carregar nomes de remetentes".
- Nesse caso o envio isolado do relatório de produtores é aceito, sem erro pedindo o relatório de créditos antes.
- Os nomes carregados alimentam a coluna de nome nas tabelas do Detalhamento que hoje só mostram a inscrição estadual (Créditos externos e Crédito próprio), como complemento à busca de nome já existente pelo cadastro do município.
- O aviso chamativo (borda âmbar) e a pergunta automática "deseja dar carga na planilha?" continuam apenas para retornos mensais sem crédito próprio.
- Se, mesmo num arquivo de índice, o usuário selecionar o CSV de créditos, ele continua sendo lido normalmente (conferência), sem alterar o valor apurado do arquivo.

## Detalhes técnicos

- `src/lib/vaf/tipoRetorno.ts`: `sugerirTipoRetorno` devolve `indice_provisorio` para remessa 14; `rotuloRemessa` e `rotuloExercicioRemessa` tratam 14 como provisório.
- `src/routes/_authenticated/nova-apuracao.tsx`: apenas consome a sugestão — sem mudança de regra além do rótulo.
- `src/components/analises/IndiceView.tsx`: novo estado com o `ProdutoresPortal` avulso (mapa IE → nome), passado ao `nomePorIe` como fonte adicional; o cartão recebe uma prop `creditoNoArquivo` derivada de `!apuracao.estimado`.
- `src/components/analises/CreditoProprioPortal.tsx`: prop `creditoNoArquivo` muda textos/botão, permite envio só do relatório de produtores (retorna o mapa via novo callback `onProdutores`) e suprime o alerta âmbar.
- Sem mudança de banco: os CSVs continuam sendo lidos apenas no navegador.
