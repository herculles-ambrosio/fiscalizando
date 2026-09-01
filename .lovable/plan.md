# Módulo ICMS Robin Hood — os 18 critérios

Hoje o Apura VAF trata só do VAF (75% da parcela distribuída). O novo módulo cobre os outros 17 critérios da Lei 18.030/2009, com carga mensal dos extratos da FJP, comparação entre municípios e um plano de melhoria por critério.

## Como se entra no módulo

No topo da barra lateral entra um seletor de produto: **Apura VAF** / **ICMS Robin Hood**. Ao trocar, o menu lateral inteiro muda para os itens do módulo de ICMS; a prefeitura ativa e o usuário logado continuam os mesmos. Nada do VAF aparece dentro do ICMS e vice-versa.

Menu do módulo ICMS:

- **Painel do ICMS** — índice de participação do mês, valor total repassado no ano, os 18 critérios em cards com índice, valor, variação e sinalização de "critério zerado / oportunidade".
- **Cargas** — importar os extratos mês a mês.
- **Critérios** — abrir um critério e ver a série mensal, a base legal e o diagnóstico.
- **Comparativo** — o município ao lado de outros, no formato que você já usa com os prefeitos.
- **Plano de melhoria** — ações por critério, com status e responsável, no mesmo padrão do plano de recuperação do VAF.

## Importação dos extratos

Três tipos de arquivo do portal Robin Hood, todos "xls" que na verdade são HTML — o sistema detecta o tipo pelo conteúdo, não pelo nome:

1. **Índice anual** (`*_indice_anual-*.xls`) — critério x mês, com o índice de participação na última linha.
2. **Transferência anual** (`*_transferencia_anual-*.xls`) — critério x mês em R$, com total anual. Note que aqui "Meio Ambiente" vem quebrado em Mata Seca / Saneamento / Conservação, enquanto no índice vem consolidado: o módulo mantém os dois níveis e concilia.
3. **Comparativo entre municípios** (`extrato-comparativo-*.xls`) — vários municípios x mês, por critério.

Cada carga registra exercício, critério, mês, índice, valor e a origem (arquivo ou coleta automática). Reimportar o mesmo período substitui, com aviso — igual ao fluxo de remessas do VAF.

## Coleta automática na FJP

Além do upload, um botão "Buscar na FJP" tenta trazer os índices direto do portal. O que a pesquisa mostrou:

- Portal atual (2024 em diante): `robin-hood.fjp.mg.gov.br` — aplicação nova, ainda instável e sem API pública documentada.
- Portal histórico (2002–2024): `robin-hood-historico.fjp.mg.gov.br` — publica planilhas por ano/critério e uma tabela com **todos os municípios e todos os critérios do mês** (`/index.php/indices/mesatual`), que é exatamente o "arquivo único" que você queria.

A coleta usa esses endereços e cai para o upload manual quando o portal não responde. O sistema sempre mostra a data e a fonte de cada número, e nunca sobrescreve um dado importado por você sem avisar.

## Diagnóstico e plano por critério

Para cada critério o módulo guarda a regra da Lei 18.030 (o que mede, quem apura, qual órgão informa, com que periodicidade e prazo) e cruza com o desempenho do município:

- **Critério zerado** (no seu extrato: Esportes, Recursos Hídricos, Mínimo per capita, Municípios Mineradores, População 50+) — separa o que é estrutural (o município nunca vai pontuar) do que é omissão de cadastro/prazo, que é dinheiro deixado na mesa.
- **Critério em queda** — compara com os meses anteriores e com a média dos municípios do comparativo.
- **Ações sugeridas** — o que fazer, para qual órgão (SEE, FEAM/SEMAD, IEPHA, SEDESE, SETUR, SEAPA, etc.), até quando, e o impacto estimado em R$ usando o valor do ponto de índice do próprio município.

Tudo exportável em PDF e DOCX com o timbrado H-Tech Minas, no mesmo padrão dos relatórios do VAF, mais uma apresentação enxuta para levar ao prefeito.

## Sobre os anexos

O PDF anexado é o Decreto de distribuição do VAF; a **Lei 18.030 em si não veio no anexo**. O texto consolidado será obtido da fonte oficial (Assembleia de MG) para alimentar a base de regras por critério — se preferir, me envie o PDF da lei que uso a sua versão.

## Detalhes técnicos

- Tabelas novas: `icms_cargas`, `icms_criterios` (catálogo dos 18, com base legal e órgão responsável), `icms_indices` (municipio, exercício, mês, critério, índice, valor, fonte), `icms_comparativo` (municipio externo, mês, valor) e `icms_acoes` (plano). RLS por `private.pode_ver_municipio`, com GRANT para `authenticated`/`service_role`; o catálogo de critérios é leitura para todos.
- Parser dos extratos em `src/lib/icms/extrato.ts` (HTML-table parsing, números pt-BR), com testes sobre os três arquivos de exemplo.
- Coleta da FJP via `createServerFn` (`src/lib/icms/fjp.functions.ts`), nunca do navegador; guarda o HTML bruto para auditoria.
- Rotas em `src/routes/_authenticated/icms/*`, com layout próprio; `AppLayout` ganha o seletor de produto e monta o menu conforme o produto ativo.
- Reaproveita `Timbrado`, `reportTimbrado`, `chartExport` e o padrão de CSV/PDF/DOCX já existentes.

## Ordem de execução

1. Banco (tabelas, RLS, catálogo dos 18 critérios) + seletor de produto e esqueleto das rotas.
2. Importação dos três extratos + Painel do ICMS.
3. Comparativo entre municípios.
4. Diagnóstico por critério, plano de ações e exportações timbradas.
5. Coleta automática na FJP.
