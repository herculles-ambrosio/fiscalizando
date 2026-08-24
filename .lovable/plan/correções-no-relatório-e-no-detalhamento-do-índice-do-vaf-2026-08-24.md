# Correções no relatório e no detalhamento do Índice do VAF

Quatro ajustes na tela **Análises do VAF › Índice do VAF**.

## 1. Impressão trazendo parte da tela que não é relatório

Hoje a impressão inclui a barra de seleção de prefeitura e a barra de abas ("Evolução do VAF / Comparar apurações / Índice do VAF"), gerando também aquele espaço em branco no topo da 1ª página. O relatório deve começar no cabeçalho "ESTADO DE MINAS GERAIS / PREFEITURA MUNICIPAL…" (a setinha vermelha da imagem 2).

- Excluir da impressão a barra de troca de prefeitura e as barras de abas das telas de análise.
- Ajustar o espaçamento do topo para o conteúdo começar logo abaixo da logo do timbrado, sem folga extra.
- A data/URL no topo e no pé da folha vêm do próprio navegador (opção "Cabeçalhos e rodapés" na janela de impressão), não do sistema.

## 2. Histórico de índices sem o detalhamento

Ao clicar em um índice salvo, os cartões voltam, mas as abas de Créditos externos, Entre municípios, VAF por contribuinte, SIMEI e Crédito próprio ficam vazias, porque hoje só os totais são gravados.

- Passar a gravar também o detalhamento junto com o índice, guardado como arquivo JSON no armazenamento privado da prefeitura.
- Ao carregar do histórico, o detalhamento é baixado e as abas aparecem completas, iguais à apuração original.
- Índices salvos antes desta mudança continuam sem detalhamento: nesses casos aparece um aviso curto na área de detalhamento orientando reprocessar e salvar novamente.

## 3. Aba "Entre municípios" sem o nome dos municípios

Só Nanuque aparece porque a tela usa apenas a lista de prefeituras cadastradas. Passará a usar a relação oficial completa dos 853 códigos SEF-MG (já existente no projeto), como já acontece na Evolução do VAF. Código sem correspondência continua exibindo "—".

## 4. Aba "Crédito próprio": Remetente com nome

A planilha do Portal do VAF só traz a inscrição estadual do remetente, sem o nome. A coluna passará a mostrar o nome do contribuinte quando a inscrição existir no arquivo de retorno carregado (ou nos contribuintes já apurados da prefeitura), mantendo a inscrição como texto auxiliar; sem correspondência, segue exibindo a inscrição.

## Detalhes técnicos

- `src/styles.css` + `src/components/AppLayout.tsx` + `src/routes/_authenticated/analises.tsx`: `no-print` na barra de prefeitura e nas `TabsList`; revisão da altura de `.timbrado-espaco-topo`.
- Migração: coluna `detalhamento_path text` em `indices_apurados`. `useIndicesHistorico.ts` grava o JSON do detalhamento no bucket `uploads` (`{municipio_id}/indices/{id}.json`) e `apuracaoDoHistorico` passa a hidratar `creditosExternos`, `creditosPorMunicipio`, `debitosPorMunicipio`, `contribuintesVaf`, `simei` e as notas da planilha de crédito próprio.
- `IndiceView.tsx`: mapa de municípios via `nomeMunicipioSef` (fallback nas prefeituras cadastradas); mapa inscrição estadual → nome montado a partir da apuração/contribuintes para a coluna Remetente.
