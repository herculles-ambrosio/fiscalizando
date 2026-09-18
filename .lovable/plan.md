# Patrimônio Cultural: importar a pontuação oficial do IEPHA

O PDF enviado ("Pontuação Definitiva – Exercício 2027", 33 páginas) é exatamente a tabela oficial do IEPHA, com uma linha por município e as notas de cada quadro. Dá para importar, sim — mas o formato é peculiar (colunas muito estreitas, cabeçalho escrito na vertical e muitas células vazias), então o leitor genérico de tabelas que usamos nos outros critérios não dá conta. Vou criar um leitor específico para esse relatório.

## O que o PDF traz por município

- Política Cultural (máx. 4,00)
- Investimentos e Despesas – Quadro I-B (máx. 3,00)
- Inventário – Quadro II-A (máx. 2,00)
- Educação e Difusão – Quadro III-C (máx. 2,00)
- Faixas de tombamento: Núcleo Histórico (5/8/12/16), Conjuntos e Paisagens (2/3/4/5), bens imóveis, bens móveis e bens registrados, por faixas de quantidade e de área
- Somatório da proteção municipal, pontuação da proteção federal/estadual e a **Pontuação Total** de cada município

## O que vou fazer

1. **Leitor próprio do relatório do IEPHA**: identifica a linha-legenda de colunas (A…AA) que o próprio PDF imprime, fixa a posição de cada coluna e lê as demais páginas pela mesma régua, associando cada valor à coluna certa mesmo quando a célula está vazia. Nome do município e Pontuação Total saem das pontas da linha.
2. **Conferência automática**: soma dos componentes comparada com a Pontuação Total impressa; divergências aparecem no resumo da importação, e o total do PDF é sempre o que vale.
3. **Ligação com a tabela de itens** já cadastrada (política, fundo, inventário, educação patrimonial, NH, CP, bens imóveis/móveis, registro imaterial, processos), para o detalhamento item a item funcionar como nos outros critérios.
4. **Ingestão**: ao enviar o arquivo ou colar o conteúdo em Critérios > Patrimônio Cultural, o sistema reconhece o cabeçalho do IEPHA e usa esse leitor; o exercício (2027) e o tipo (definitiva/preliminar) são lidos do próprio título e sugeridos na tela.
5. **Detalhamento do critério**: com os números reais, a tela passa a mostrar ranking com posição e população, o que o município já pontua e o que falta em cada quadro, quanto vale cada ponto, comparação com os vizinhos e "onde inscrever" (IEPHA).
6. **Importar este PDF agora**, para você já ver o exercício 2027 completo na tela.

## Detalhes técnicos

- Novo `src/lib/icms/criterios/patrimonio.ts`: `extrairPatrimonioCultural(paginas)` com leitura posicional (régua de colunas A–AA), devolvendo `{ ranking, itens, cabecalho, naoMapeados, divergencias }` no mesmo formato de `extrairTabelaCriterio`.
- `src/components/icms/IngestaoCriterio.tsx`: para `pipeline.slug === "patrimonio_cultural"`, tenta o leitor específico antes do genérico (mesmo padrão já usado em Turismo e Ecológico).
- Mapeamento coluna → `criterio_itens_referencia` (códigos `pc_*` já cadastrados); faixas de tombamento gravadas como item com a quantidade e a pontuação correspondente.
- Gravação nas tabelas existentes `criterio_ranking_municipio` e `criterio_item_municipio` (ano-base 2027, fonte definitivo) — nada de esquema novo.
- Testes do leitor com algumas linhas reais do PDF (Abre Campo, Buenópolis, Braúnas, Brumadinho) cobrindo linha cheia, linha zerada e faixas múltiplas.
