# Padronização da importação dos critérios do ICMS

## Objetivo
- Renomear todas as abas usadas para carga de arquivos como **Importar relatório**.
- Garantir que, ao escolher um relatório encontrado, o ano-base e o tipo exibidos sejam os do próprio relatório.

## Alterações
1. Trocar “Ingestão de dados” e textos relacionados por “Importar relatório” no critério Esportes, mantendo o mesmo nome já usado nos demais critérios.
2. Corrigir a identificação do ano nos links do Observatório do Esporte, evitando confundir o código de espaço da URL (`%20`) com o ano 2020.
3. Ao clicar em **Usar/Importar**, preencher automaticamente os campos **Ano-base** e **Tipo do relatório** com os dados do relatório selecionado antes de gravar.
4. Na importação do Esportes, conferir também o conteúdo do PDF para reconhecer ano-base e versão preliminar/definitiva quando disponíveis; usar os campos manuais apenas se o arquivo não trouxer essa identificação.
5. Aplicar o mesmo preenchimento automático aos históricos de relatórios encontrados dos demais critérios.

## Validação
- Testar um relatório “Preliminar — Ano Base 2025” partindo da tela em “2024 — Definitivo” e confirmar que a carga muda para “2025 — Preliminar”.
- Conferir os nomes das abas e a montagem do aplicativo.
