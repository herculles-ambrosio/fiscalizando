# Empresas: filtro por data de encerramento e tela de importação mais limpa

## 1. Deixar de fora empresas encerradas há muito tempo
No passo "2. Arquivos de Estabelecimentos" da tela "Importar base completa da Receita", entra um novo campo: **"Trazer baixadas/inativas somente a partir de"** (uma data).
- As empresas **ativas** continuam vindo sempre, sem exceção.
- As **baixadas, inaptas, suspensas ou nulas** só vêm se a data da situação for igual ou posterior à data escolhida. Exemplo: com 01/01/2022, uma empresa baixada em 2015 fica de fora.
- Com o campo em branco, vem tudo, como funciona hoje.
- Ao final, a mensagem mostra quantas empresas foram ignoradas por esse filtro.

## 2. Tirar o bloco destacado em vermelho
Sai da tela o aviso "Primeiro clique em 'Abrir pasta do mês'…" e também os botões de cada arquivo (Municipios.zip, Estabelecimentos0.zip a Estabelecimentos9.zip).
Continuam na tela a escolha do mês e o botão **"Abrir pasta do mês"**, para baixar os arquivos direto no site da Receita.

## Detalhes técnicos
- `filtrarEstabelecimentos` recebe um parâmetro opcional `encerradasDesde` (data ISO). Ele descarta as linhas com situação diferente de ATIVA quando `situacao_data` é anterior a essa data ou está vazia, e devolve também a quantidade descartada.
- Em `EmpresasView.tsx` (diálogo da base da Receita): novo campo de data acima da escolha dos arquivos, remoção do aviso e da lista de botões de download, e a quantidade ignorada incluída no toast.
