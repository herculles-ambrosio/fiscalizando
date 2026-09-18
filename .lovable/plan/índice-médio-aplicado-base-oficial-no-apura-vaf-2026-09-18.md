# Índice médio aplicado (base oficial) no Apura VAF

## Objetivo
Mostrar, em todas as telas que trazem índice, qual é o **índice médio publicado pelo Estado e aplicado no exercício** — hoje o da Resolução nº 5.947, de 8 de setembro de 2025 (apuração 2023/2024, média aplicada em 2026) — para comparar o índice atual com o que está valendo de fato.

## 1. Carga da Resolução 5.947/2025
- A tela de importação de resoluções já existente (Consultoria → Índices da Resolução SEF) lê esse anexo corretamente: conferi a página oficial e as colunas são Cód. Mun., Município, VAF Individual 2023, Índice 2023, VAF Individual 2024, Índice 2024 e Média dos Índices.
- Fazer a carga dos 853 municípios dessa resolução, com exercício de aplicação **2026**, ao lado da 6.069/2026 (aplicação 2027) já gravada. As duas convivem sem se sobrepor.
- Na tela de importação, passar a listar as resoluções já carregadas (número, exercício de aplicação, anos de apuração e quantidade de municípios), para saber o que existe e recarregar quando sair a definitiva.

## 2. Informação nova nas telas de índice
Criar um bloco padrão "Índice médio aplicado — base oficial" reutilizado nas telas, mostrando:
- número e data da resolução;
- anos de apuração usados (ex.: 2023 e 2024) e ano de aplicação (ex.: 2026);
- índice de cada ano, a média aplicada e o VAF individual publicado;
- comparação com o índice apurado na tela: diferença em pontos e em %, com indicação de acima/abaixo.

Telas que recebem a informação:
- Análises → Índice do VAF (cartões de resultado);
- Análises → Evolução do VAF (junto dos cartões de índice e da média dos índices);
- Histórico de índices (coluna/linha de referência oficial por exercício);
- Estatísticas / Panorama dos municípios (comparação com o índice aplicado do exercício);
- ICMS → visão geral (cartão "Índice de participação").

Regra de escolha: para o exercício em tela, usa-se a resolução cujo exercício de aplicação seja o mesmo; se houver mais de uma (provisória e definitiva), prevalece a mais recente. Sem resolução carregada, o bloco aparece discreto com o aviso de que a tabela oficial daquele ano ainda não foi importada e um atalho para a tela de importação.

## 3. Segurança dos cálculos
Nada da apuração própria muda. Os índices da resolução são apenas referência de comparação, guardados separadamente dos índices apurados pelo município.

## Detalhes técnicos
- Dados em `indices_resolucao` (já com `resolucao`, `exercicio_aplicacao`, `ano_a/ano_b`, `indice_a/indice_b`, `media_indices`, `vaf_a/vaf_b`); sem mudança de schema.
- Novo hook `useIndiceAplicado(municipioId, exercicioAplicacao)` em `src/hooks/` consultando `indices_resolucao` por município e exercício de aplicação, com o mesmo tratamento de erro de permissão já usado em `usePanoramaMunicipios`.
- Novo componente `src/components/vaf/IndiceAplicado.tsx` com o bloco/cartão padrão; consumido por `IndiceView`, `EvolucaoView`, `HistoricoIndices`, `estatisticas.tsx` e `icms/index.tsx`.
- Carga feita pelo parser existente `parseAnexoResolucao` + upsert em `indices_resolucao` (`onConflict: resolucao,codigo_mun`).

## Validação
- Conferir Abadia dos Dourados: índices 0,036093 (2023) e 0,037686 (2024), média 0,0368893.
- Conferir um município cliente comparando o índice apurado com a média aplicada de 2026.
- Typecheck, lint e build limpos; telas verificadas em computador e celular.
