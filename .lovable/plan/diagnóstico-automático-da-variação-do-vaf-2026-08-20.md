# Diagnóstico automático da variação do VAF

Na aba **Evolução do VAF**, incluir um painel de análise pronta que explica, em texto claro, por que o valor líquido comparado/estimado ficou acima ou abaixo do valor base — apontando os fatores responsáveis e o quanto cada um pesou.

## O que aparece na tela

Um card **"Por que variou"**, logo abaixo dos KPIs, com:

1. **Frase-resumo** — ex.: "O valor líquido caiu R$ 12,4 mi (−18,3%). O fator dominante é a saída de 37 declarantes, que respondem por R$ 9,1 mi (73% da queda)."
2. **Ranking de fatores** — barras horizontais com o impacto em R$ e o % da variação total, ordenadas por peso, cada uma com sinal (aumentou/reduziu):
   - Declarantes que deixaram de declarar
   - Novos declarantes
   - Contribuintes que permaneceram e reduziram o VAF
   - Contribuintes que permaneceram e aumentaram o VAF
   - Crédito externo (registros 11/35)
   - Crédito interno / crédito próprio (AF/SIARE)
   - Débito (registro 13)
   - Acertos de crédito e débito
3. **Top 5 contribuintes por impacto** em cada sentido (quedas e altas), com IE, nome e diferença — já existe o dado em `compararDeclarantes`.
4. **Alertas de comparabilidade**, quando aplicável:
   - arquivos de naturezas diferentes (definitivo com índice fechado × mensal estimado) — a diferença pode ser de método, não de arrecadação;
   - competências parciais (arquivo mensal com menos meses acumulados);
   - fator de calibragem ≠ 1 ou VAF estadual de referência usado na estimativa;
   - declarantes com cadastro incompleto que podem distorcer o pareamento por IE.
5. **Conclusão em uma linha** classificando o cenário: queda estrutural (perda de declarantes), queda conjuntural (mesmos declarantes faturando menos), efeito de crédito/débito, ou apenas diferença metodológica entre arquivos.

Botão "Copiar análise" para levar o texto ao relatório/ofício, e a análise entra também no CSV exportado.

## Detalhes técnicos

- Novo módulo `src/lib/vaf/diagnostico.ts` com função pura `diagnosticarEvolucao(base, atual)` que recebe as duas `ArquivoEvolucao` e devolve `{ resumo, fatores[], topQuedas[], topAltas[], alertas[], conclusao }`. Sem chamadas de rede, sem alterar as regras de apuração existentes.
- Decomposição por declarante usa `compararDeclarantes` (soma das diferenças de `saíram`, `entraram`, e dos `permaneceram` separados por sinal). Decomposição por componente usa os campos de `ApuracaoIndice` já calculados (`vafProprio`, `creditoExterno`, `creditoInterno`, `creditoProprio`, `debito`, `acertoCredito`, `acertoDebito`), com o sinal correto de cada um na fórmula do valor líquido.
- Os dois eixos (por declarante e por componente) são apresentados como visões complementares e cada bloco fecha com o total da variação, para o número sempre bater com o card "Valor líquido - comparado/estimado".
- Renderização em novo componente `src/components/analises/DiagnosticoVariacao.tsx`, consumido por `EvolucaoView.tsx`; segue os tokens de cor e o padrão `RotuloKpi` com tooltip já usados na tela.
- Testes unitários da função de diagnóstico com casos sintéticos (só saídas, só quedas, só crédito externo) garantindo que a soma dos fatores iguala a diferença total.
