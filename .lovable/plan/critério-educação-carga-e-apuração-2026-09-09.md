# Critério Educação — carga e apuração

O critério Educação vale 10% do repasse (o maior peso depois do VAF). Diferente de Esportes, Turismo e Meio Ambiente, que vêm em PDF, a Educação é publicada pela Fundação João Pinheiro em **planilha Excel**, duas vezes por ano. O módulo segue exatamente o mesmo padrão dos outros critérios: mesma tela de Critérios, mesmo cartão verde "Importado", mesma tela de análise por município, mesmo comparativo.

## O que muda para quem usa

**Na tela Critérios**, "Educação" passa a ter botão "Abrir Educação" quando houver planilha importada, igual aos outros três.

**Na tela do critério** (abas no mesmo padrão já existente):

- **Ranking** — todos os municípios com o Índice de Qualidade da Educação e o índice de participação, posição e comparação.
- **O que pontua hoje** — os quatro componentes do município (Desempenho Escolar 50%, Rendimento Escolar 20%, Atendimento Educacional 15%, Gestão Escolar 15%), cada um com a nota do município, a média do Estado e a projeção do que pode somar se chegar ao patamar típico.
- **Como melhorar** — o que fazer em cada componente, com o ganho estimado.
- **Dados constitutivos** — os números brutos que a Fundação usou (proficiência, aprovação, abandono, atendimento, censo), lado a lado com a média estadual, destacando o que está fora da curva e pode ser erro de lançamento.
- **Prazo de recurso** — aba nova, específica da Educação (ver abaixo).
- **Conferência com a FJP** — o mesmo cruzamento com o repasse já usado nos outros critérios.

**Alerta de prazo (novidade).** Quando a planilha mais recente for a provisória e o prazo de recurso ainda estiver correndo, a tela abre com um aviso destacado: "Janela de recurso aberta até {data} — faltam N dias", com a lista dos dados do município fora da média estadual e o e-mail oficial para contestação. Passado o prazo, o aviso vira "prazo encerrado; próxima janela em agosto de {ano+1}". As datas ficam editáveis pela consultoria, pois cada ano a Fundação publica um calendário próprio.

## Importação

A mesma tela de importação dos outros critérios, com três caminhos: procurar a planilha no portal da FJP, colar o endereço do arquivo, ou enviar o arquivo do computador. Acrescenta a leitura de Excel (hoje só lê PDF e texto colado).

Ao abrir a planilha o sistema:

1. lê primeiro a aba de dicionário de dados, para casar os nomes de coluna daquele ano (eles mudam de publicação para publicação);
2. grava os índices calculados por município (os quatro componentes, o índice de qualidade e o índice de participação);
3. grava os dados constitutivos linha a linha, guardando o nome da coluna como veio;
4. na versão definitiva, grava também o resultado dos recursos administrativos;
5. guarda a nota técnica como texto para consulta;
6. registra no relatório de importação o que não foi reconhecido e os municípios presentes numa aba e ausentes na outra (indício de exclusão do critério no ano).

Provisório e definitivo convivem: o definitivo não apaga o provisório, e a tela mostra qual versão está sendo exibida.

## Conferências automáticas

- Soma dos índices de participação de todos os municípios deve fechar em 100.
- O valor calculado para o município (índice × 10% × valor de 1 ponto) é comparado com o "Recebido" que o sistema já mostra, no mesmo padrão dos outros critérios.
- Municípios sem correspondência entre as abas entram no relatório de divergências da importação.

## Detalhes técnicos

- Catálogo: `src/lib/icms/criterios.ts` já tem o slug `educacao` com peso 10%; entra um pipeline em `pipelines.ts` (fonte `robin-hood.fjp.mg.gov.br`, descoberta pela página de notícias, formato `planilha`).
- Descoberta e download: `criterios.functions.ts` ganha reconhecimento de links `.xlsx`/`.xls` e da página de notícias da FJP (o nome do arquivo muda a cada publicação, então nada é fixado no código).
- Leitura da planilha: nova dependência `xlsx` (SheetJS), usada no navegador; parser dedicado em `src/lib/icms/criterios/educacao.ts` com casamento de colunas via dicionário de dados e normalização de município por `municipiosMg.ts`.
- Persistência: reaproveita `criterio_ranking_municipio` (índice de qualidade + índice de participação) e `criterio_item_municipio` (os quatro componentes como itens `edu_irap`, `edu_ire`, `edu_iae`, `edu_ige`), mantendo Comparativo, projeção e conferência FJP funcionando sem alteração.
- Migração nova, no padrão de RLS e GRANT já usado: `educacao_dados_constitutivos` (exercício, município, coluna de origem, valor, versão), `educacao_recursos` (município, item contestado, resultado), `educacao_calendario` (datas de publicação, limite de recurso e definitivo, com nota técnica) e seed de `criterio_itens_referencia` para os quatro componentes com pesos 0,50/0,20/0,15/0,15 — pesos por exercício, editáveis, referenciando a resolução conjunta SEE/FJP do ano.
- Componentes novos: `src/components/icms/PrazoRecursoEducacao.tsx` e `src/components/icms/DadosConstitutivosEducacao.tsx`, ligados em `criterio.$slug.tsx` como abas exclusivas do slug `educacao`.

## Ordem de execução

1. Migração (tabelas de Educação, itens de referência, calendário) e pipeline no catálogo.
2. Leitura de Excel na importação + parser da Educação, validado com a planilha real da FJP.
3. Ranking, "o que pontua", projeção e "como melhorar" na tela do critério.
4. Aba de dados constitutivos com média estadual e destaque de outliers.
5. Aba de prazo de recurso com o alerta de janela aberta.
6. Conferência com o repasse da FJP.
