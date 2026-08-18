# Correção do VAF B — Débito (e Crédito interno) na projeção do índice

## O que foi verificado

Sim, o valor está errado no app. Conferi diretamente no arquivo `P443RT1326.txt` (remessa 13/2026, Nanuque):

- Os registros de débito (tipo 13) e de crédito interno (tipo 12) trazem **cinco colunas de valor**, na mesma ordem do relatório da SEFAZ: Valor AF, Valor NFA, Valor NFE, Valor NFF e **Valor total**.
- Hoje o sistema soma apenas a coluna **NFE**, que é quase sempre zero. Por isso apareceu R$ 1.466.822 no card de Débito.
- Somando a coluna de **total**, o resultado é **R$ 180.542.564**, exatamente o número do relatório "VAF B - Débito" que você anexou.
- O mesmo erro atinge o Crédito interno (registro 12): hoje mostra R$ 509.306; o correto é **R$ 131.511.702**.

Conferência dos totais no arquivo:

```text
Registro 13 (débito):          NFE 1.466.822   |  TOTAL 180.542.564  <- SEFAZ
Registro 12 (crédito interno): NFE   509.306   |  TOTAL 131.511.702
```

## O que será feito

1. Corrigir a leitura dos registros 12 e 13 para usar a coluna de valor total, mantendo também as parcelas AF / NFA / NFE / NFF disponíveis para detalhamento.
2. Recalcular automaticamente o valor líquido e a projeção do índice, que passam a refletir os novos totais de crédito interno e débito.
3. Nas abas de detalhamento por município (Créditos e Débitos), mostrar as colunas AF, NFA, NFE, NFF e Total — igual ao relatório da SEFAZ — para conferência linha a linha.
4. Incluir essas colunas também na exportação CSV.
5. Revalidar contra o PDF anexado: total do débito deve fechar em 180.542.564 e os municípios (Ataléia 43.027.501, Carlos Chagas 24.699.796 etc.) devem bater um a um.

## Observação

Os créditos externos (registros 11/35) têm layout por contribuinte, diferente dos 12/13, e não são afetados por essa correção. Farei uma conferência rápida deles contra o leiaute durante a implementação e aviso se encontrar divergência.

## Detalhes técnicos

- `src/lib/vaf/indice.ts`: em `coletarDetalhamento`, trocar `num(l, 52, 66)` por `num(l, 82, 96)` para os tipos 12 e 13, e passar a acumular as parcelas 22-36 (AF), 37-51 (NFA), 52-66 (NFE), 67-81 (NFF). Estender `LinhaMunicipio` com esses campos.
- `src/routes/_authenticated/indice.tsx`: novas colunas nas tabelas de créditos/débitos por município; os cards de KPI continuam lendo `creditoInterno` / `debito`.
- `csvIndice`: incluir as parcelas nas seções de crédito e débito por município.
