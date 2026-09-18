# Padronizar critérios do ICMS e ampliar a Fiscalização de Cartórios

## 1. Critérios do ICMS em uma única grade

- Remover a lista verde separada dos cinco critérios principais: Educação, Patrimônio Cultural, Meio Ambiente, Esportes e Turismo.
- Exibir os 18 critérios juntos na mesma grade de cartões quadrados, sem repetição.
- Manter os cinco principais destacados em verde para indicar que possuem informações, ranking e detalhamento mais completos.
- Preservar em todos os cartões o nome, peso, resumo, valor recebido e acesso ao detalhamento.
- Acrescentar uma indicação discreta nos cartões verdes, como “Dados detalhados”, para explicar o destaque sem criar uma seção separada.

## 2. Fiscalização com todos os meses

Adicionar “Todos os meses” ao seletor da aba Fiscalização e oferecer duas formas de leitura:

### Visão consolidada

- Uma linha por serventia, somando os valores de todas as competências carregadas.
- Mostrar total de meses considerados, emolumentos, ISS devido, base declarada, ISS declarado, ISS pago e diferença acumulada.
- Os indicadores superiores e o CSV passam a respeitar essa visão consolidada.

### Visão mês a mês

- Uma linha por serventia e competência, permitindo acompanhar a evolução mensal sem perder o detalhe.
- Incluir a competência na tabela e no CSV.
- Disponibilizar uma alternância “Consolidado / Mês a mês” somente quando “Todos os meses” estiver selecionado.

A alíquota municipal atualmente cadastrada continuará sendo usada nos cálculos, mantendo a mesma regra já aplicada pela Fiscalização.

## 3. Reabrir cargas salvas

Os dados de cada carga já são gravados automaticamente no sistema por município, mês e serventia. Portanto, não será necessário guardar uma cópia do arquivo original nem criar nova estrutura de dados.

- Na aba “Meses carregados”, adicionar uma ação “Ver na Fiscalização” em cada carga.
- Ao acioná-la, abrir a aba Fiscalização já posicionada na competência correspondente.
- Após uma nova carga, atualizar a lista de competências e deixar o mês importado disponível imediatamente para consulta futura.
- Manter o histórico de cargas separado dos dados: excluir somente o registro do histórico não apagará os valores importados, como ocorre hoje.

## Detalhes técnicos

- Unificar a renderização dos cartões em `src/routes/_authenticated/icms/criterios.tsx`, usando o conjunto de critérios com fonte própria apenas para aplicar o destaque verde.
- Ampliar a consulta de Fiscalização em `src/hooks/useCartorios.ts` para aceitar uma competência específica ou todas, sempre relacionando emolumentos e declarações pela competência e pela serventia antes de consolidar.
- Evitar limites que cortem silenciosamente cargas extensas; buscar todos os registros necessários em páginas.
- Controlar a aba, a competência e o modo de visualização em `src/routes/_authenticated/cartorios.tsx`.
- Fazer `CargasView` comunicar a competência escolhida à tela principal para reabertura imediata.
- Nenhuma migração de banco é necessária, pois `cartorio_emolumentos`, `cartorio_declaracoes` e `cartorio_cargas` já persistem os dados necessários.

## Validação

- Confirmar que cada critério aparece uma única vez e que apenas os cinco principais ficam verdes.
- Conferir um mês isolado contra o comportamento atual.
- Conferir “Todos os meses” nas visões consolidada e mensal, inclusive somatórios e CSV.
- Importar uma carga, sair da tela e reabri-la pela aba “Meses carregados”.
- Verificar a apresentação em computador e celular e confirmar que o projeto continua sem erros.
