# Competência: trocar "mês" por "remessa" (nº do arquivo)

## O que a análise dos arquivos mostrou

Confirmado no layout oficial (retorno20210517.pdf) e no arquivo de teste P443RT1226.txt:

- O layout do arquivo de retorno **não possui nenhum campo de mês de competência**. Os únicos campos temporais são:
  - Registro 01: **Exercício** (4 dígitos, pos. 19-22), datas de entrega/processamento, e "Mês Início/Mês Fim" — que são meses de início e fim de **atividade do contribuinte**, não competência.
  - Registro 99 (totalizador): datas de início/fim de processamento.
- No arquivo P443RT1226.txt, **todos os 2.160 registros tipo 01 têm Exercício = 2025**, embora o nome diga "1226".
- Ou seja: em `P443RT1226`, o "12" é o **número da remessa/entrega** que a SEF envia à prefeitura (1 a 13, sendo 13 o fechamento) e o "26" é o **ano de geração/entrega do arquivo** (2026) — nada disso é competência mensal. O ano de referência real é o **Exercício = 2025**.

Conclusão: sua suspeita está correta. O que hoje é tratado como "Competência — mês / ano" é, na verdade, "Remessa nº / ano de entrega do arquivo", e o eixo temporal correto é o **Exercício**.

## O que muda

1. **Tela Nova apuração**
   - "Remessa/mês de referência" passa a **"Remessa (nº do arquivo)"**.
   - "Competência — mês" passa a **"Remessa do arquivo"** (1 a 13, com 13 = fechamento; sem opção "mês"), e a lista deixa de mostrar nomes de meses (jan, fev...).
   - "Competência — ano" passa a **"Ano de entrega do arquivo"**, com a nota de que o ano de referência da apuração é o Exercício detectado nos arquivos.
   - Mensagens de validação e o diálogo de duplicidade passam a falar em "remessa X de AAAA (exercício AAAA)" em vez de "competência mm/aaaa".

2. **Telas de análise (Apurações Realizadas, Análise do VAF, Comparação, Índice, Estatísticas, Histórico de índices)**
   - A coluna/rótulo "Competência" passa a **"Exercício · Remessa"**, exibido como `2025 · Arquivo 12` (e `2025 · Definitivo` para a remessa 13/índice definitivo).
   - Ordenação e comparações passam a usar Exercício + nº da remessa (as Estatísticas já usam esse critério; as demais telas passam a ficar iguais).
   - Nenhum número apurado muda — é só rotulagem e ordenação coerente.

3. **Banco**: sem migração. As colunas `competencia_mes` / `competencia_ano` continuam existindo e guardando os mesmos valores (nº da remessa e ano de entrega); só mudam o significado exibido e os rótulos.

## Detalhes técnicos

- `src/lib/vaf/tipoRetorno.ts`: `rotuloMes` vira `rotuloRemessa` (sem nomes de meses); `formatarCompetencia` é substituído por `rotuloExercicioRemessa(exercicio, remessa, tipo)` devolvendo "2025 · Arquivo 12" / "2025 · Definitivo"; `competenciaOrdenavel` passa a ordenar por `exercicio * 100 + remessa`; textos de `validarCompetencia` reescritos em termos de remessa/ano de entrega (as regras de bloqueio de município e ano incompatível continuam iguais).
- `src/routes/_authenticated/nova-apuracao.tsx`: rótulos, select de remessa (1-13) e textos de alerta/duplicidade.
- `src/routes/_authenticated/historico.tsx`, `src/routes/_authenticated/contribuintes.tsx`, `src/components/analises/ComparacaoView.tsx`, `src/components/analises/IndiceView.tsx`, `src/components/HistoricoIndices.tsx`: trocam `formatarCompetencia(...)` pelo novo rótulo, usando `exercicio` da carga (ou do índice) como ano.
- Estatísticas (`estatisticas.ts`, `CriterioBase.tsx`, `lacunas.ts`) já usam exercício + remessa; só alinho o texto ao novo padrão de rótulo.
