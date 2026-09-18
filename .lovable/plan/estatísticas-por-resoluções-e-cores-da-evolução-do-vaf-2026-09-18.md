# Estatísticas por resoluções e cores da Evolução do VAF

## Objetivo
Substituir as duas comparações atuais de Estatísticas por uma única visão no padrão visual anterior: duas resoluções selecionáveis, uma de cada lado, e todas as prefeituras cadastradas exibidas automaticamente. Na Evolução do VAF, destacar os resultados comparados em verde ou vermelho conforme superem ou fiquem abaixo da base.

## Estatísticas
- Remover da tela a comparação separada “Comparação por resolução e evoluções” e os controles antigos de ano, provisório/definitivo e remessa.
- Manter uma única tabela no padrão visual da imagem, com dois seletores no topo: **Resolução base** e **Resolução comparada**.
- Usar, para cada prefeitura cadastrada e visível ao usuário, a **média oficial publicada** em cada resolução.
- Exibir por linha: prefeitura, média da resolução base, média da resolução comparada, diferença em pontos, variação percentual e situação **Subiu**, **Caiu** ou **Estável**.
- Manter busca, filtro por situação, ordenação, resumo, gráfico, exportação CSV e acesso ao detalhamento/plano municipal, adaptando os rótulos às resoluções escolhidas.
- Mostrar “—” quando uma prefeitura não tiver valor em uma das resoluções, sem ocultá-la nem quebrar a tela.
- Selecionar inicialmente as duas resoluções mais recentes em ordem de aplicação, quando disponíveis.

## Comparações gravadas
- Preservar a opção de nomear e gravar a comparação, congelando as duas resoluções escolhidas e os resultados daquele momento.
- Adaptar os registros existentes para aceitar **resolução base** e **resolução comparada**, mantendo compatibilidade de leitura com comparações já gravadas.
- Permitir carregar, exportar e excluir comparações gravadas.

## Evolução do VAF
- No card **Valor líquido — comparado/estimado**, aplicar destaque verde quando o valor for maior que o card base, vermelho quando for menor e neutro quando for igual ou não houver comparação.
- No card **Média dos índices [anos]**, aplicar a mesma regra em relação à média oficial exibida no card base da resolução selecionada.
- Usar as cores sem alterar valores, fórmulas ou dados salvos.

## Detalhes técnicos
- Reaproveitar a consulta de resoluções e seus índices oficiais, montando dois mapas por prefeitura para alimentar o panorama completo.
- Simplificar os tipos e hooks da comparação, removendo da nova tela a seleção manual de evoluções.
- Ajustar a tabela de comparações gravadas com uma nova referência para a resolução comparada e atualizar as permissões necessárias na mesma migração.
- Preservar o tratamento de falta de permissão para que a tela continue funcional com dados vazios.
- Validar a tela em desktop, os estados sem dados e as cores positiva, negativa e neutra; conferir também compilação e testes aplicáveis.
