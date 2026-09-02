# Plano de melhoria do ICMS — por pontuação, como manda a lei

Hoje o Plano de melhoria é uma lista genérica: pega os critérios zerados ou em queda e sugere frases soltas. Isso não mostra ao gestor **onde ele perde ponto** nem **onde se lança o dado**. A Lei 18.030/2009 (e seus anexos) traz, para vários critérios, quadros de atividades com nota — como o quadro de Esportes que você mandou (PSE 0,5; EPD 1,0; JEM 1,0; JEMG 1,0; Xadrez na Escola 0,5; Qualificação de Agente Esportivo 1,0; Atividades de Lazer 0,5…). O plano passa a ser construído em cima desses quadros.

## A ideia em uma frase

Transformar cada critério num **checklist pontuável**: o município marca o que já faz, o sistema soma a nota obtida, mostra a nota máxima possível, calcula quanto vale em R$ cada ponto e gera as ações do que falta — dizendo **em qual sistema/órgão se cadastra, com que documento e até quando**.

## Como fica a tela

Plano de melhoria passa a ter três partes:

1. **Onde estou perdendo** — cartões dos critérios com pontuação abaixo do possível, ordenados pelo R$ estimado em jogo (usa o valor do ponto de índice do próprio município, que o módulo já calcula).
2. **Checklist do critério** — abre o critério e aparece o quadro da lei, item a item:

```text
ESPORTES — Anexo VI, Lei 18.030/2009        Nota: 2,0 de 7,5
[x] Jogos Escolares Municipais (JEM)                 1,0
[x] Projetos Sócio-Educacionais (PSE)                0,5
[ ] Minas Olímpica Jogos Escolares (JEMG)            1,0   ~R$ 18.400/ano
[ ] Esporte para Pessoa com Deficiência (EPD)        1,0   ~R$ 18.400/ano
[ ] Xadrez na Escola (XE)                            0,5   ~R$  9.200/ano
[ ] Qualificação de Agente Esportivo (QAE)           1,0   ~R$ 18.400/ano
Onde se lança: SEEJ — Minas Esportiva / cadastro anual do município
Prazo: conforme resolução anual da SEEJ (inscrição das atividades)
Comprovação: ata/relatório da atividade + lista de participantes
```

3. **Ações geradas** — cada item não marcado vira uma ação do plano (o mesmo plano que já existe: status, órgão, responsável, prazo, observação, impacto em R$), só que agora com o item da lei e o local de lançamento atrelados.

## Conteúdo por critério (base de regras)

Para cada critério entra, além do que já existe, um bloco com **itens pontuáveis**, **onde se lança** e **prazo**:

- **Esportes** — quadro do Anexo VI (as siglas PSE, EPD, JEM, JEMG, XE, QAE, AL…); lançamento no cadastro anual da SEEJ.
- **Patrimônio cultural** — quadro do Anexo II (bens tombados, inventário, conselho e fundo municipais, plano de proteção, educação patrimonial), com as pontuações por faixa de unidades; envio anual ao IEPHA-MG.
- **Meio ambiente** — três frentes que o extrato já separa: saneamento (aterro/ETE licenciados — FEAM), unidades de conservação (Anexo IV, fator por categoria de manejo — IEF/Cadastro de UC) e mata seca.
- **Turismo** — os três requisitos do art. 8º: política municipal, conselho e fundo em funcionamento, adesão à política estadual; cadastro na SETUR-MG.
- **Produção de alimentos** — cadastro de produtores/agricultura familiar via EMATER/SEAPA.
- **Recursos hídricos** — cadastro/participação junto ao IGAM.
- **Educação** — não é checklist: é resultado (Anexo III — IQE = IRAP 0,5 + IRE 0,2 + IAE 0,15 + IGE 0,15). Aqui o plano mostra a composição e ações sobre taxa de participação nas avaliações, matrícula e equidade, com o dado da SEE.
- **Sede de penitenciária, mineradores, área, população, cota mínima, mínimo per capita, ICMS solidário** — marcados como estruturais: o sistema diz explicitamente "não há ação municipal", em vez de sugerir ação inútil.

Onde a lei dá pontuação exata, o checklist usa a nota da lei. Onde não dá (critério calculado por índice), o item vira uma verificação de conformidade (sim/não/parcial) sem nota.

## Como o sistema identifica as falhas

Cruzando o que já foi carregado com o checklist:

- Critério com índice zerado e não estrutural → todos os itens entram como "provável não cadastro"; é a maior oportunidade em R$.
- Critério com índice caindo mês a mês → sinaliza perda de pontuação/vencimento de comprovação.
- Critério com índice abaixo da média dos municípios do seu Comparativo → mostra a diferença em pontos e em R$.
- O que o sistema **não** consegue saber sozinho (se o município realmente inscreveu a atividade) fica como pergunta ao gestor no checklist — a resposta fica gravada e serve de linha de base para o ano seguinte.

## Saídas

- **Relatório por critério** e **relatório consolidado** em PDF/DOCX no timbrado H-Tech Minas: nota atual x nota possível, R$ em jogo, itens faltantes, órgão, prazo e responsável.
- **Resumo executivo de uma página** para levar ao prefeito: "o município deixa de receber ~R$ X/ano; com estas N providências recupera ~R$ Y".
- Exportação CSV do checklist.

## Detalhes técnicos

- `src/lib/icms/criterios.ts` ganha, por critério, `itensPontuaveis: { codigo, sigla, descricao, nota, ondeLancar, prazo, comprovacao }[]`, `notaMaxima` e `tipoAvaliacao: "checklist" | "indicador" | "estrutural"`. O conteúdo vem do texto da Lei 18.030 e anexos (o PDF anexado é a própria lei consolidada — uso ele como fonte).
- Nova tabela `icms_checklist` (municipio_id, exercicio, criterio, item_codigo, situacao `feito|nao_feito|nao_se_aplica|em_andamento`, nota_obtida, observacao, atualizado_por/em) com GRANT para `authenticated`/`service_role` e RLS por município/consultoria, no mesmo padrão das demais tabelas do módulo.
- `icms_acoes` ganha `item_codigo` (opcional) para ligar a ação ao item da lei; ações antigas continuam válidas.
- Novo `src/lib/icms/pontuacao.ts`: consolida checklist + índices do extrato → nota obtida, nota máxima, lacunas e R$ por ponto (reaproveita `valorPorPontoIndice` do `diagnostico.ts`).
- `src/routes/_authenticated/icms/plano.tsx` reescrita em três seções (oportunidades, checklist por critério, plano em execução), reutilizando `SeletorExercicio`, `Timbrado` e `reportTimbrado`.
- `src/lib/icms/metas.ts` continua como está; o plano passa a citar a meta do critério ao lado da nota.

## Ordem de execução

1. Base de regras (itens pontuáveis dos critérios com quadro na lei) + tabela do checklist.
2. Cálculo de pontuação e tela do checklist com R$ por item.
3. Geração de ações a partir dos itens faltantes (ligadas ao plano atual).
4. Relatórios PDF/DOCX e resumo para o prefeito.
