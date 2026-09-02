# Metas do ICMS — a escala do índice está certa, os pesos cadastrados é que estão errados

Investiguei a escala dos índices da FJP com os dados reais de Vargem Alegre/2026 (coleta do portal, mês 7). Resultado: **os índices da FJP já vêm em percentual correto** — nenhum está em base "por mil" nem em escala própria. O que está errado são os percentuais do Anexo I cadastrados no sistema.

## O que a conferência mostrou

Prova da escala: o índice de Cota Mínima é 0,1172333, e a Cota Mínima é dividida igualmente entre os 853 municípios (100 ÷ 853 = 0,11723). Bate exatamente. Os índices estão na mesma base do índice de participação (0,01756% para Vargem Alegre).

Com a escala confirmada, dá para inverter a fórmula e descobrir o peso que o Estado realmente aplicou em cada critério:

```text
peso real = valor recebido no critério ÷ (índice do critério × valor de 1 ponto)
```

| Critério | Peso cadastrado hoje | Peso que os dados mostram |
|---|---|---|
| VAF | 75% | 75,1% (confere) |
| Educação | 2% | **10,0%** |
| Cota Mínima | 5,5% | **1,50%** |
| ICMS Solidário | 4,14% | **1,89%** |
| Esportes | 0,1% | **0,50%** |
| Meio Ambiente | 1,1% | 1,09% (confere) |
| Área Geográfica | 1% | 1,00% (confere) |
| Produção de Alimentos | 1% | 1,00% (confere) |

Educação em 10% é coerente com a EC 108/2020, que passou a reservar parcela própria para indicadores de educação — é por isso que Educação responde por 63% do repasse de Vargem Alegre e a meta calculada com 2% ficou em 0,18x do recebido. Os cinco critérios marcados com "conferir" na tela são exatamente os da coluna divergente.

## O que fazer

1. **Corrigir os percentuais do Anexo I** em `src/lib/icms/criterios.ts` para os pesos vigentes, conferindo o texto atual da Lei 18.030/2009 com as alterações posteriores e a EC 108/2020. Onde a lei e o dado divergirem, prevalece o dado do portal (é ele que gera o repasse), com comentário registrando a fonte.
2. **Calibração automática como rede de segurança**: em `src/lib/icms/metas.ts`, calcular o peso implícito de cada critério a partir do próprio extrato carregado e comparar com o peso cadastrado. Quando a diferença passar de 10%, a tela continua mostrando a meta pelo peso da lei, mas o badge "conferir" passa a exibir o peso implícito ("cadastro 2%, dados indicam 10%") em vez de só avisar.
3. **Deixar o card "Valor de 1 ponto de índice" compreensível**: subtítulo explicando que 1 ponto = 1% do índice estadual, com o índice do município ao lado (0,017561%) e a conta de volta (índice × valor do ponto = repasse do exercício). Hoje o número de R$ 95,5 milhões parece um erro ao lado de um repasse de R$ 1,6 milhão.
4. **Mostrar a fórmula na linha**: tooltip em cada linha da tabela de Metas com a conta aberta daquele critério (índice × peso × valor do ponto = meta), do mesmo jeito que descrevi para Educação.
5. Depois de corrigir os pesos, revalidar as telas que consomem a meta: Metas, Comparativo (meta ponderada e falta) e Plano de melhoria (R$ por ponto).

## Detalhes técnicos

- `criterios.ts`: ajuste do campo `percentual` dos critérios divergentes; nenhum outro campo muda.
- `metas.ts`: novo campo por linha `pesoImplicitoPct` (valor recebido ÷ (índice × valorPontoIndice) × 100), calculado só quando há índice e valor; `aderencia`/`foraDeAderencia` continuam como estão.
- `diagnostico.ts`: fórmula da meta permanece `índice × peso × valorPontoIndice` — nada a mudar na matemática.
- `metas.tsx`: textos do card, tooltip por linha e nova coluna/tooltip de peso implícito, mais colunas no CSV.
- Nenhuma migração de banco.
