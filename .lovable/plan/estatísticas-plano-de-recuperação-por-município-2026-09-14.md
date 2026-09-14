# Estatísticas: plano de recuperação por município

Hoje a tela de Estatísticas mostra apenas números resumidos na coluna "Providências" (quantas ações, quantos ofícios, quantas impugnações). A mudança traz o plano de recuperação completo de cada prefeitura: os contribuintes envolvidos, os ofícios emitidos e as impugnações, com nome, valor e situação.

## O que muda na tela

Ao clicar na linha de um município, o painel lateral passa a ter três seções em abas, sempre no exercício comparado:

**Plano de recuperação (contribuintes)**
- Uma linha por contribuinte: inscrição estadual, CNPJ, nome, ação (motivo), valor a recuperar e situação (Prevista, Ofício enviado, Resposta recebida, Concluída, Sem efeito).
- Totais no topo: contribuintes no plano, valor total a recuperar, quanto já teve ofício enviado e quanto foi concluído.
- Filtro rápido por situação e busca por nome/IE.

**Ofícios emitidos**
- Data, contribuinte, modelo/situação do ofício, quem emitiu e status do download.

**Impugnações**
- Nome, exercício/ano-base, situação (rascunho, pronta, protocolada, deferida, indeferida), número do protocolo SEI e data, quantidade de contribuintes e VAF contestado.

Em cada seção, quando não há registro, aparece um aviso curto e um atalho para a tela correspondente (Análises do VAF, Ofícios, Impugnações) já com a prefeitura da linha selecionada.

A coluna "Providências" da tabela principal ganha um botão "Ver plano" que abre direto na aba do plano, e a exportação CSV ganha uma segunda opção: "Exportar plano detalhado", com uma linha por contribuinte de todos os municípios visíveis.

## Detalhes técnicos

- `src/hooks/usePanoramaMunicipios.ts`: novo hook `useDetalhePanorama(municipioId, exercicio)`, habilitado só quando o painel abre, com três consultas — `acoes_recuperacao` (todas as colunas, filtrando `municipio_id` e `exercicio`), `oficios_emitidos` (reaproveitando `useEmissoes` com `municipioId` explícito ou consulta própria, ordenada por `criado_em`) e `impugnacoes` (linha completa, incluindo `itens` para contar contribuintes e somar o VAF contestado).
- `useAcoesPanorama` passa a trazer também `inscricao_estadual`, `nome_contribuinte`, `cnpj`, `acao_titulo` para permitir o CSV detalhado sem consulta extra; o agregado em `src/lib/vaf/panorama.ts` continua igual, com um campo novo `acoesDetalhe` na `Providencias`.
- Novo componente `src/components/estatisticas/PlanoMunicipio.tsx` com as três abas (`Tabs` do shadcn) e as tabelas, usando `ROTULO_STATUS_ACAO`/`CORES_STATUS_ACAO` de `useAcoesRecuperacao`, `rotuloStatus` de `useImpugnacoes` e `StatusEmissaoBadge` para os ofícios.
- `src/routes/_authenticated/estatisticas.tsx`: o `Sheet` passa a renderizar `Composicao` + `PlanoMunicipio`; largura para `sm:max-w-3xl`. Atalhos usam `trocarMunicipio` + `navigate`, como já faz `irApurar`.
- CSV detalhado via `montarCsv`/`baixarCsv`, uma linha por ação com município, IE, CNPJ, nome, ação, valor e situação.
- Nenhuma mudança de banco, RLS ou regra de cálculo.
