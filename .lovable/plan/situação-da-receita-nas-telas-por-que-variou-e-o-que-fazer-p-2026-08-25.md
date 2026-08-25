# Situação da Receita nas telas "Por que variou" e "O que fazer para recuperar"

## Sobre a gravação no banco

Já está gravando: a consulta manual em Contribuintes Apurados salva cada CNPJ na tabela de cache `situacoes_receita` (269 CNPJs gravados, último em 25/08/2026 17:11). O cache é global por CNPJ, então tudo que já foi consultado pode ser reaproveitado em qualquer outra tela sem consultar de novo.

## O que muda

### 1. "Por que variou" (Diagnóstico da variação)

Hoje as listas de contribuintes de cada fator (saíram, entraram, caíram, subiram) e os Top quedas/altas mostram só nome e inscrição estadual — não têm CNPJ, porque vêm do arquivo do retorno.

- Cruzar a inscrição estadual com o cadastro já apurado da prefeitura para descobrir o CNPJ de cada contribuinte.
- Ao lado de cada nome, etiqueta colorida com a situação na Receita (Ativa, Suspensa, Inapta, Baixada, Nula, Não encontrada, Não consultado), com tooltip de data/motivo e data da consulta.
- Botão **Consultar Receita** no topo do painel, consultando de uma vez todos os CNPJs que aparecem no diagnóstico e que ainda não estão no cache (com contagem de consultados / em cache / sem CNPJ / falhas).
- A situação entra também no texto copiado, no DOCX e no PDF do diagnóstico.

### 2. "O que fazer para recuperar" (Plano de recuperação)

As ações já trazem CNPJ de cada contribuinte, então basta ler o cache:

- Etiqueta da situação da Receita em cada contribuinte listado nas ações e no painel de detalhe.
- Botão **Consultar Receita** no topo do plano, cobrindo todos os CNPJs das ações exibidas.
- Filtro rápido para ocultar contribuintes baixados/nulos das ações (só visual, sem alterar as ações gravadas), com aviso de quantos foram ocultados.
- Situação incluída nas exportações do plano (cópia, DOCX, PDF e CSV).

Nada é bloqueado: a situação é informativa e a escolha de quem receberá ofício continua sua.

## Detalhes técnicos

- Novo hook `useCadastroContribuintes(municipioId)` (ou extensão de `useNomesContribuintes`) devolvendo por IE normalizada `{ nome, cnpj }` a partir de `contribuintes_apurados`; usado pelo diagnóstico para obter CNPJ a partir da IE.
- Reuso de `useSituacoesReceita` (leitura do cache) e `useConsultarReceita` (server function `consultarSituacoesReceita`, lotes com fallback OpenCNPJ → Minha Receita → BrasilAPI) e do componente `SituacaoReceitaBadge`. Nenhuma migração nova.
- `src/lib/vaf/diagnostico.ts`: `ItemDetalhe` e `MovimentoDeclarante` passam a carregar `cnpj` opcional (preenchido na camada de UI/adaptação, mantendo a função pura e os testes atuais válidos).
- `DiagnosticoVariacao.tsx` e `PlanoRecuperacao.tsx` recebem o mapa de situações e repassam para as linhas; `diagnosticoDocx.ts`, `planoDocx.ts` e `relatorioPdf.ts` ganham a coluna/sufixo de situação.
- Consulta em lote respeita o limite atual por chamada, com barra de progresso e resumo, e invalida o cache de leitura ao terminar.
