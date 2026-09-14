# Por que Guanhães aparece sem apuração

Guanhães já está cadastrada como "Não é cliente" com origem dos índices "Resolução SEF", e a tela de Estatísticas já sabe usar esses índices. O que falta é o dado: a tabela dos índices da resolução está vazia — a importação da Resolução SEF nº 6.069/2026 ainda não foi executada. Sem nenhuma linha importada, a tela mostra "Sem apuração" e "faltam os índices de 2024 e 2025".

## O que fazer

1. Abrir Consultoria > Índices da Resolução e importar a Resolução SEF nº 6.069/2026 (pelo endereço da página ou colando o conteúdo do Anexo Único).
2. Conferir no resumo da importação quantos municípios foram reconhecidos e se Guanhães está entre eles.
3. Voltar a Estatísticas com ano-base 2024 e comparação 2025 (provisório): Guanhães passa a exibir os índices com a origem "Resolução SEF".

## Ajustes previstos durante a verificação

- Se algum município da resolução não casar pelo nome (acentos, "d'Oeste", etc.), a tela de importação lista os não reconhecidos; nesse caso incluo um casamento adicional pelo código do município antes de gravar.
- Se as Estatísticas continuarem sem mostrar os índices mesmo com os dados gravados, verifico a correspondência entre o exercício escolhido no filtro e os anos da resolução (2024/2025) e corrijo a seleção.

## Detalhes técnicos

- `indices_resolucao` está com 0 linhas; `municipios` para Guanhães: `cliente=false`, `fonte_indice='resolucao'`.
- `estatisticas.tsx` já consome `useIndicesResolucao()` e repassa `resolucao` para `montarPanorama`, que só aplica o fallback quando `cliente === false && fonte_indice === 'resolucao'`.
- Nenhuma mudança de schema é necessária.
