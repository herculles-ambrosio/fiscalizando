# Situação cadastral na Receita Federal por CNPJ

Hoje o sistema só conhece a situação **estadual** (SEF/MG), vinda do arquivo de ativos. A ideia é somar a isso a situação **federal** (ATIVA, SUSPENSA, INAPTA, BAIXADA, NULA) consultada gratuitamente e usá-la como filtro na emissão de ofícios.

## É possível de graça? Sim

Os dados abertos de CNPJ da Receita Federal (publicados no dados.gov.br) são liberados por lei. Baixar e processar os arquivos brutos daria dezenas de GB, o que não vale a pena aqui. Existem serviços públicos que já fazem esse trabalho e expõem os mesmos dados por CNPJ, sem cadastro e sem custo:

1. **OpenCNPJ** (opencnpj.org) — sem token, sem cadastro, dados dos arquivos oficiais.
2. **Minha Receita** (minhareceita.org) — projeto aberto, mesma base consolidada.
3. **BrasilAPI** (`/api/cnpj/v1/{cnpj}`) — fachada sobre o Minha Receita.

Plano: tentar na ordem acima, com fallback automático quando uma delas falhar ou limitar. Nenhuma chave é necessária. Importante: a base é atualizada mensalmente pela Receita, então a situação vem com a data de referência do dado — vamos exibi-la.

## O que muda no aplicativo

### 1. Botão "Consultar Receita" (manual, como você pediu)

Na tela de **Contribuintes apurados**:

- Botão **Consultar Receita Federal** — consulta em lote os CNPJs da apuração atual (com barra de progresso e resumo: consultados, sem CNPJ, não encontrados).
- No painel de detalhe de cada contribuinte, botão para reconsultar só aquele CNPJ.
- O resultado fica gravado em cache por CNPJ; reconsulta só quando você pedir. CNPJ já consultado não é buscado de novo no lote (com opção "forçar atualização").

### 2. Nova coluna e filtro

- Coluna **Situação RF** no grid, com etiqueta colorida (Ativa em verde, Suspensa/Inapta em amarelo, Baixada/Nula em vermelho, "Não consultado" em cinza).
- Filtro rápido por situação federal, somando-se aos filtros já existentes.
- Tooltip mostrando data da situação, motivo (quando houver) e data da última consulta.
- Exportação CSV inclui as novas colunas.

### 3. Emissão de ofícios: você escolhe as situações

No diálogo de emissão, um bloco **Situação na Receita Federal** com caixas de marcação para ATIVA, SUSPENSA, INAPTA, BAIXADA, NULA e "Não consultado" — todas marcadas por padrão (nada é bloqueado).

- Ao desmarcar, o sistema informa quantos contribuintes ficaram de fora.
- Aviso destacado quando a seleção incluir baixadas/nulas ("ofício pode ser devolvido").
- Aviso quando houver contribuintes sem consulta, com atalho para consultar antes de gerar.
- Sua escolha de situações fica salva por prefeitura para as próximas emissões.

## Detalhes técnicos

- Migração: tabela `situacoes_receita` (`cnpj` como chave, `situacao`, `situacao_data`, `motivo`, `razao_social`, `nome_fantasia`, `uf`, `municipio`, `cnae_principal`, `fonte`, `consultado_em`, `payload jsonb`). Cache global (dado público, não é por município): `GRANT SELECT` a `authenticated`, escrita apenas por `service_role`, RLS habilitada com policy de leitura para autenticados.
- Server function `consultarSituacaoReceita` em `src/lib/receita/cnpj.functions.ts`, protegida por `requireSupabaseAuth`, recebendo lotes de até 50 CNPJs. Ela lê o cache, consulta apenas o que falta, com concorrência limitada e pequeno intervalo entre chamadas, e grava via cliente admin.
- Normalização das variações de nome de campo entre as três fontes em `src/lib/receita/normalizar.ts`, mapeando o código/descrição de situação para o enum interno.
- Falhas de rede/limite retornam por CNPJ (`erro`), sem derrubar o lote; a UI mostra quantos falharam e permite repetir.
- Hook `useSituacoesReceita(municipioId, cargaId)` para leitura reativa; novo componente `SituacaoReceitaBadge`.
- Filtro de emissão aplicado em `OficiosDialog.tsx` sobre a lista já filtrada, sem alterar o conteúdo dos modelos.

## Fora deste escopo

Baixar e hospedar a base completa dos dados abertos, consulta de sócios/quadro societário e agendamento automático de reconsulta mensal.
