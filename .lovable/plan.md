# Cadastro de resoluções e média do índice base vinda da resolução

## 1. Cadastro de resoluções (nova tela)

Uma tela própria em Consultoria → Resoluções SEF, onde você cadastra cada resolução informando:

- número da resolução (ex.: 5.947 / 6.069) e data;
- endereço da página oficial (ex.: rr5947_2025.html, rr6069_2026.html);
- **ano de apuração** (o ano-base da média, ex.: 2024) e **ano de aplicação** (ex.: 2026);
- observação livre.

Ao salvar, o sistema lê a página, mostra o que encontrou (anos das colunas, quantos municípios, índices de cada ano e a média publicada) e grava os 853 municípios.

A tela lista as resoluções já cadastradas com: número, ano de apuração, ano de aplicação, anos das colunas do anexo, quantidade de municípios e data da carga. Cada linha permite **reler/atualizar** (quando sair a definitiva) e **excluir** a carga.

Cadastro inicial já previsto:

| Resolução | Apuração | Aplicação | Anexo |
|---|---|---|---|
| 5.947/2025 | 2024 | 2026 | índices 2023 e 2024, média publicada |
| 6.069/2026 | 2025 | 2027 | índices 2024 e 2025, média publicada |

## 2. Escolha da resolução na Evolução do VAF

No cartão **Arquivo base** (ao lado de Ano de Apuração / Ano de Aplicação) entra um campo **Resolução de referência**, listando as resoluções cadastradas (mostrando "5.947 — apuração 2024, aplicação 2026").

Efeitos da escolha:

- o cartão **Média dos índices** do lado base passa a mostrar a **média publicada na resolução** para o seu município (já é média de dois anos, não se calcula nada);
- o rótulo passa a refletir os anos reais da resolução, ex.: "Média dos índices 2024–2026";
- o detalhe do cartão mostra os dois índices que compõem a média e o VAF individual publicado, com a origem (resolução e link).

Se você não escolher resolução, o comportamento atual continua.

## 3. Comparação base × atual

- **Média base**: vem pronta da resolução escolhida.
- **Média atual**: continua como hoje — soma dos índices dos dois anos comparados dividida por 2.
- O cartão de comparação mostra a diferença entre as duas médias, em pontos de índice e em %, indicando se subiu ou caiu.

O bloco genérico "Índice médio aplicado — base oficial" que foi acrescentado na última rodada sai da Evolução, já que essa informação passa a estar no próprio cartão de média. Nas demais telas (Índice do VAF, Histórico, Estatísticas, painel do ICMS) ele permanece como está.

Nada da apuração própria muda: os índices da resolução são apenas referência.

## Detalhes técnicos

- Nova tabela `resolucoes_sef` (número, data, url, ano_apuracao, ano_aplicacao, observação, contadores) referenciada pelas linhas de `indices_resolucao` — sem quebra do que já está gravado; `indices_resolucao` ganha coluna opcional `resolucao_id` com backfill pelo número.
- Rota nova `/_authenticated/consultoria/resolucoes` (cadastro + lista + ações), reaproveitando `buscarResolucao` e `parseAnexoResolucao`; a rota atual `consultoria/resolucao` passa a redirecionar para ela.
- Hook `useResolucoesSef()` (lista/CRUD) e ajuste de `useIndiceAplicado` para aceitar busca por `resolucao_id`.
- `EvolucaoView`: novo estado `resolucaoBaseId`, persistido junto da evolução salva (em `evolucoes_salvas`), usado no cartão de média base e na comparação; `CaixaArquivo` ganha o seletor.
- Gravação em lotes com upsert `onConflict: resolucao,codigo_mun`, como hoje.

## Validação

- Cadastrar as duas resoluções e conferir Abadia dos Dourados (5.947: 0,036093 e 0,037686, média 0,0368893).
- Numa evolução real, escolher a 5.947 no arquivo base e conferir que a média base bate com a publicada e a diferença para a média atual está correta.
- Persistir, recarregar a evolução salva e ver a resolução mantida; typecheck, lint e build limpos.
