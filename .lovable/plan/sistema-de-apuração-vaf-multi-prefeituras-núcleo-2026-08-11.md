# Sistema de Apuração VAF — Multi-Prefeituras (Núcleo)

Primeira versão: login, nova apuração (upload + processamento), dashboard, tabela de contribuintes e histórico de cargas. Planilha XLSX e ofícios DOCX ficam para a etapa 2 (o modelo de ofício "zerados" ainda será enviado).

## O que será construído

**1. Backend (Lovable Cloud)**
- Tabelas `municipios`, `perfis`, `cargas`, `contribuintes_apurados` exatamente como no schema enviado, com RLS por município (função `meu_municipio_id()`) e os índices indicados.
- Bucket privado `uploads` para os `.txt` originais, com política por caminho `{municipio_id}/{carga_id}/...`. O bucket `outputs` entra na etapa 2.
- Acesso somente por convite: nenhuma tela pública de cadastro. Usuários são criados/convidados e o perfil (município + papel) é vinculado por um administrador. Nesta entrega o município Nanuque (código SEF 443) e o primeiro perfil são cadastrados por mim via banco, e a tela de login apenas autentica.

**2. Telas**
- **Login** (e-mail/senha). Sem sessão, tudo redireciona para o login.
- **Dashboard** — cards com os totais da carga mais recente (Omissos, Zerados, Fora do Prazo, Discrepantes, Normais), gráfico de barras por CNAE e botão "Nova apuração".
- **Nova apuração** — dois campos de upload (Ativos e Retorno), exercício opcional (detectado automaticamente), opções avançadas com limiar de discrepância (padrão 30%) e data-limite de entrega (padrão 31/05 do ano seguinte). Progresso em tempo real: pendente → processando → concluída.
- **Contribuintes** — grid com busca (nome/CNPJ/IE), chips de filtro por situação combináveis, colunas IE, CNPJ, Nome, CNAE, VAF atual, VAF anterior, Variação %, Situação (badges coloridos), paginação no servidor.
- **Histórico** — lista de cargas por exercício com os totais, reabrindo qualquer carga.

**3. Regras de apuração** (portadas literalmente do protótipo)
- Universo = contribuintes do arquivo de Ativos com `codigo_situacao_contribuinte = '1'`.
- `entregou_declaracao`: registro 01 com a mesma IE e exercício da carga.
- `vaf_atual`: registro **10** (não o 07), com sinal de `sinal_valor_vaf`; em caso de retificação, vence o de `data_processamento` mais recente.
- `vaf_anterior`: registro 02, campo `valor_adicionado_anterior` com seu sinal.
- OMISSO (não entregou) · ZERADO (entregou e VAF = 0) · FORA DO PRAZO (entrega após a data-limite) · DISCREPANTE (|Δ|/|anterior| ≥ limiar) · NORMAL. Situações acumuláveis.

## Detalhes técnicos

- A stack deste projeto é TanStack Start, que já tem runtime de servidor próprio; portanto **não há Edge Functions do Supabase** — a lógica equivalente vira `createServerFn` autenticadas. As regras e layouts são os mesmos, só muda onde rodam.
- Os layouts de largura fixa da Seção 7 e o `parseLinha` (2 decimais implícitas) ficam em `src/lib/vaf/layouts.ts` e `src/lib/vaf/parser.ts`, compartilhados entre cliente e servidor.
- **Onde roda o parse:** o retorno real tem ~17 mil linhas / 5 MB e o ativo ~3 mil linhas. O parse e a classificação rodam no navegador (decodificação Latin-1 via `TextDecoder('iso-8859-1')`, com detecção de UTF-8), e o resultado é gravado por uma server function em lotes de ~500 linhas. Isso evita os limites de CPU/memória do runtime serverless e dá barra de progresso real. Os `.txt` originais vão para o Storage para auditoria.
- Estado da carga na tabela `cargas` (pendente/processando/concluída/erro), atualizado a cada lote.
- Detecção do exercício pela moda do campo `exercicio` do registro 01.
- Validação ponta a ponta com os arquivos reais de Nanuque (P443AT0026 / P443RT1226) antes de encerrar, conferindo os contadores.

## Fora desta entrega
- Geração de planilha XLSX e de ofícios DOCX/ZIP (etapa 2, após o modelo de "zerados").
- Tela de administração de usuários e seletor multi-município.
