# Ver valores do ESTBAN por instituição e mês

## Objetivo
Hoje o ESTBAN importado só aparece resumido no gráfico da Conferência. Criar uma forma de ver, antes de comparar com o declarado, os valores que cada instituição informou ao Banco Central, mês a mês.

## O que será feito

### 1. Nova aba "Valores ESTBAN" (dentro de Instituições) ou seção expansível
- Tabela por instituição: cada linha é um mês, com as colunas:
  - Competência (mês/ano)
  - Verbete 710 — Contas de resultado (bruto, acumulado no semestre)
  - Verbete 711 — Contas credoras (bruto e **valor mensal desacumulado**, que é o usado na conferência)
  - Verbete 712 — Contas devedoras
- Seletor de ano e de instituição (ou "todas").
- Indicação visual de quais meses foram importados e quais faltam.

### 2. Explicação dos números
- Texto curto no topo explicando que o 711/712 vêm acumulados dentro do semestre e que o sistema mostra o valor mensal já desacumulado.
- Tooltip em cada coluna explicando o que o verbete representa (710 inclui juros e outros rendimentos — não é base direta de ISS).

### 3. Exportação
- Botão para baixar em CSV os valores exibidos (com filtros aplicados).

## Detalhes técnicos
- Reutiliza `useEstban()` e a função de desacumulação já existente em `src/lib/bancos/conferencia.ts` (mesma regra usada na conferência, para os números baterem).
- Nenhuma tabela nova no banco — só leitura de `bancos_estban`.
- Arquivos: nova view em `src/components/bancos/` e ajuste em `InstituicoesView.tsx` (ou nova rota/aba, conforme encaixe melhor na tela).

## Fora de escopo
- Comparação com o declarado da prefeitura (já existe na Conferência).
- Alteração na importação do ESTBAN.
