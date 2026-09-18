# Anos de referência na Evolução do VAF

## Objetivo
Permitir que o usuário defina separadamente o ano de aplicação do arquivo base e do arquivo comparado, evitando confundir o ano presente no nome da remessa com o ano em que o índice será aplicado.

## Alterações na tela
- Incluir em cada bloco de arquivo um seletor **Ano de aplicação**:
  - arquivo base: escolha independente;
  - arquivo atual: escolha independente.
- Ao carregar um arquivo, sugerir inicialmente o ano de aplicação a partir do ano identificado na remessa, mas permitir alterar livremente.
- Manter o nome, a remessa e o tipo real do arquivo visíveis como informações do documento; o ano escolhido será identificado claramente como **Aplicação**.
- Usar os anos escolhidos nos cartões de resultados, por exemplo:
  - **Valor líquido — base 2026**;
  - **Valor líquido — comparado/estimado 2027**;
  - **Índice de participação — base 2026**;
  - **Índice de participação — comparado/estimado 2027**;
  - **Média dos índices 2026/2027**.
- Repetir essa referência nas explicações dos cartões e nos títulos das colunas comparativas, para que toda a tela siga a mesma leitura.

## Evoluções gravadas
- Salvar os dois anos escolhidos junto com a evolução, aproveitando os dados já armazenados para os arquivos, sem criar uma nova tabela.
- Ao carregar uma evolução salva, restaurar automaticamente os anos de aplicação usados naquela análise.
- Para evoluções antigas que ainda não possuem essa informação, sugerir os anos a partir das remessas e permitir a correção manual.

## Exportações
- Levar os anos escolhidos para o CSV comparativo e para os relatórios/diagnósticos gerados nessa tela, mantendo os valores e fórmulas atuais.
- Diferenciar nos textos o **ano do arquivo/movimento** e o **ano de aplicação**, sem substituir ou adulterar os metadados originais.

## Segurança dos cálculos
- A alteração será somente de referência e apresentação.
- Valores líquidos, índices, média, diferenças, percentuais, declarantes e plano de recuperação continuarão calculados exatamente com os mesmos dados dos arquivos.

## Validação
- Testar o exemplo informado: movimento 2024 com aplicação 2026 versus movimento 2025 com aplicação 2027.
- Gravar a evolução, sair e carregá-la novamente, confirmando a restauração de 2026/2027.
- Conferir cartões, explicações, tabelas e CSV para garantir referências consistentes.
- Verificar a tela em computador e celular e confirmar que o projeto permanece sem erros.
