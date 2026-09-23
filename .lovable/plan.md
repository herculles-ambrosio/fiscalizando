# Previsão de repasse para prefeituras que não são clientes

Hoje a Previsão de repasse só funciona para quem tem apuração própria carregada: ela usa os índices apurados no sistema e os valores mensais já recebidos. Das 41 prefeituras cadastradas, 20 não são clientes e apenas 5 têm dados mensais — nessas telas os cartões ficam vazios.

É possível montar a previsão para todas elas usando apenas as fontes oficiais que já estão no sistema:

- As resoluções da SEF (5.947, apurado 2024 → aplicado 2026, e 6.069, apurado 2025 → aplicado 2027) já trazem a média de índice dos 853 municípios de Minas.
- A tabela de transferências da FJP já traz o valor mensal do Estado repassado pelo VAF (jan–ago/2026 gravados).

Com esses dois números o repasse de cada mês é calculado: índice do município × valor do Estado no mês.

## O que muda na tela

1. Quando a prefeitura não tiver apuração própria, a tela passa a se abastecer sozinha:
   - Índice aplicado hoje = média da resolução aplicada no exercício atual (2026 → Resolução 5.947).
   - Índice projetado = média da resolução aplicada no exercício seguinte (2027 → Resolução 6.069), quando já cadastrada.
   - Valores mensais "recebidos" = índice aplicado × valor mensal do Estado (FJP), marcados na tela como estimativa oficial, não como valor efetivamente creditado.
2. Um aviso curto no topo informa de onde vieram os números ("Resolução 5.947/2025 e transferências da FJP"), com o número da resolução e o mês mais recente da FJP.
3. Continua sendo possível escolher a origem do índice (média, última apuração ou digitado) e a base de receita; para quem não é cliente, a lista de origens passa a incluir as resoluções.
4. A memória de cálculo, o CSV e o PDF ganham as linhas da origem dos dados (resolução usada, exercício da FJP, meses disponíveis).
5. Quando a prefeitura tem apuração própria, nada muda: os dados próprios continuam tendo prioridade, e as resoluções entram só como complemento se faltar mês.

## Detalhes técnicos

- Novo hook `useIndicesResolucaoMunicipio(municipioId)` (ou reuso de `useIndiceAplicado` para dois exercícios) devolvendo a média por exercício de aplicação a partir de `indices_resolucao`.
- `PrevisaoRepasse.tsx`: ao montar a série, se `useIcmsDados` não trouxer meses com valor, gerar a série a partir de `useRepassesEstado(exercicio).vaf75 × indiceAplicadoResolucao / 100`, sinalizando `origemDados: "resolucao_fjp"`.
- Exercício padrão: quando não há `icms_exercicios`, usar o exercício mais recente com bolada cadastrada em `repasses_estado` (hoje 2026), em vez do ano corrente.
- `calcularPrevisao` já aceita `boladaEstado`; nenhuma mudança na fórmula, apenas na origem da série e do índice.
- Todas as 853 linhas de cada resolução são casadas por código SEF; as 41 prefeituras cadastradas estão vinculadas, então a busca por `municipio_id` cobre todas.
