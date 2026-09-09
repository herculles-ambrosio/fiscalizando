# Buscar as serventias direto do portal do TJMG (sem exportar planilha)

Testei agora e **funciona**: o sistema consegue consultar o painel do TJMG sozinho, escolher o mês/ano e a comarca e trazer a tabela pronta, sem login e sem você baixar nada.

## O que já foi comprovado no teste

- Consegui abrir o painel de forma automática e ler a tabela "Lista de serventias".
- Ao escolher o mês **1/2026**, o painel devolveu **2.650 serventias** com as colunas exatas que você vê na tela: Nome da Serventia, Código CNS, Comarca, Status, Emolumentos (DAP), Recompe (DAP), TFJ (DAP), Despesa e Quantidade.
- Exemplo real trazido: "1º Tabelionato de Notas de Abaeté — CNS 00.054-7 — Abaeté — Provida — Emolumentos R$ 57.849,14 — TFJ R$ 24.839,00".
- Os meses disponíveis vão de 7/2024 até 2/2026 (25 competências), e a lista é lida do próprio painel.

## Como vai funcionar para você

1. Na aba de emolumentos do módulo Fiscaliza Cartório, um botão **"Buscar no portal do TJMG"**.
2. Você escolhe o **mês/ano** (a lista vem do próprio portal) e, se quiser, a **comarca**; por padrão o sistema já sugere a comarca do município ativo.
3. O sistema baixa a tabela, mostra quantas serventias vieram e a soma dos emolumentos, e você confirma a carga.
4. A carga entra pelo mesmo caminho de hoje: conferência da prefeitura ativa, cálculo do ISS, histórico em "Meses carregados" (origem "Portal TJMG").
5. Se o portal estiver fora do ar ou mudar, aparece um aviso claro e o envio manual da planilha continua disponível.

## Detalhes técnicos

- Nova rota de servidor `src/routes/api/tjmg-serventias.ts` (precisa ser rota, não server function, por causa do WebSocket de saída). Fluxo:
  1. `GET https://qlik.tjmg.jus.br/single/?appid=<APP>` para obter cookies `X-Qlik-Session` + `BIGipServerpool_qlik`.
  2. `GET /qps/csrftoken?xrfkey=<16 chars>` com header `X-Qlik-Xrfkey`, lê o header de resposta `qlik-csrf-token`.
  3. WebSocket `wss://qlik.tjmg.jus.br/app/<APP>?qlik-csrf-token=<token>` com esses cookies e `Origin: https://qlik.tjmg.jus.br`.
  4. `OpenDoc` → **atenção: o objeto usa o estado alternativo `Transparencia`**. Toda seleção precisa ser feita nesse estado, senão a tabela retorna `qCalcCondMsg: "Selecione o Mês/Ano"` e 0 linhas.
  5. `CreateSessionObject` com `qListObjectDef.qStateName = "Transparencia"` para os campos `Mês/Ano` e `Nome da Comarca`; seleção via `SelectListObjectValues` com `qElemNumber`.
  6. `GetObject("bGqNC")` → `GetLayout` → `GetHyperCubeData` paginado em blocos de ~1.000 linhas (limite de 10.000 células por chamada) até `qSize.qcy`.
- Identificadores (guardar em `cartorio_config`, editáveis, com esses valores como padrão):
  - app: `a3afcb99-eb94-458d-bb08-2e5a4b1cb34e`
  - sheet: `ea00fc99-af6b-48a7-8dc4-1c4985ece0ec`
  - objeto tabela: `bGqNC`
  - estado: `Transparencia`
- Normalização: converter a matriz em `LinhaEmolumento[]` reaproveitando `src/lib/cartorios/parser.ts` (valores "R$ 57.849,14" → centavos; `Comarca` alimenta o campo `municipio` usado por `conferirMunicipio`).
- `src/lib/cartorios/portal.functions.ts` passa a expor `listarCompetenciasTjmg` e `baixarServentiasTjmg` chamando a rota interna; o fallback de upload manual permanece.
- UI em `src/routes/_authenticated/cartorios.tsx`: seletor de mês/comarca, progresso de download e prévia antes de gravar.
