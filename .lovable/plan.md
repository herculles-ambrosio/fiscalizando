# Critério Esportes no módulo ICMS (substituindo "Metas")

## Objetivo
Trocar o menu "Metas" por um menu "Esportes", que mostra, para cada município e ano-base, o que já pontua no Critério Esportes (ICMS Solidário, Lei 18.030/2009) e o que ainda falta pontuar, a partir dos relatórios em PDF da SEDESE/Observatório do Esporte.

## O que muda na navegação
- O item "Metas" sai do menu do ICMS e a tela é removida.
- Entra "Esportes", com três abas: **Detalhamento do município**, **Ranking** e **Ingestão de dados** (esta última só para a consultoria/administração).
- Nada mais do módulo ICMS é alterado (Painel, Comparativo, Critérios, Plano de melhoria, Cargas seguem como estão).

## Tela "Esportes"

**Detalhamento do município** (município e ano-base selecionáveis)
- Cartões de resumo: nota das demais atividades, nota JIMI, nota final, índice percentual e posição no ranking daquele ano.
- Lista "Já pontuando": cada atividade com nome, peso do Anexo V, número de eventos, participantes somados, modalidades oferecidas e selo verde.
- Lista "Ainda não explorado": as atividades do Anexo V que não apareceram, com o peso como ganho potencial, selo cinza e uma explicação curta do requisito de cada uma.
- Se o município não aparecer no relatório do ano escolhido: aviso destacado de que só participam do critério os municípios com Conselho Municipal de Esportes em pleno funcionamento (art. 8º, §1º da Lei 18.030/2009).
- Conferência visível: soma das notas das atividades × peso comparada com a "nota demais atividades" do ranking, sinalizando divergência quando houver.

**Ranking**
- Tabela do ano-base com busca por município, ordenação e exportação CSV.

**Ingestão de dados**
- Botão "Atualizar dados de Esportes": o sistema procura no site do Observatório do Esporte os links do relatório preliminar e do definitivo mais recentes e mostra o que encontrou antes de importar.
- Campo alternativo para colar a URL do PDF manualmente, caso a busca automática não encontre (site mudou de layout).
- Escolha do tipo (preliminar/definitivo) e do ano-base; a reimportação substitui os dados daquele ano e tipo.
- Ao final: resumo com quantos municípios e atividades foram lidos e uma lista das atividades cujo nome não bateu com o Anexo V, para revisão manual.

## Dados guardados
Três tabelas novas no banco:
- `esportes_atividades_referencia` — as 14 atividades do Anexo V (código, nome oficial, peso, texto do requisito), carregadas junto com a criação da tabela.
- `esportes_ranking_municipio` — ano-base, município normalizado, nome original, notas, índice percentual, posição, tipo do relatório e data da ingestão.
- `esportes_atividade_municipio` — ano-base, município normalizado, nome da atividade como veio do PDF, código e peso mapeados (podem ficar vazios para revisão), texto dos eventos, quantidade de eventos, total de participantes, texto das modalidades, tipo do relatório e data da ingestão.

Acesso: leitura liberada para qualquer usuário autenticado (são dados públicos estaduais e o comparativo entre municípios depende disso); gravação apenas pelo processo de ingestão executado por superadmin/consultor.

## Detalhes técnicos

**Ingestão** — função de servidor `src/lib/icms/esportes.functions.ts` + `esportes.server.ts`:
1. Descoberta: baixa a página de publicações do observatoriodoesporte.mg.gov.br, extrai os `href` de `.pdf` cujo texto/nome do arquivo contenha "preliminar"/"definitivo" e o ano-base; devolve os candidatos ao usuário em vez de escolher sozinho. Fallback: URL colada manualmente.
2. Extração de texto: `unpdf` (JS puro, compatível com o runtime de borda; `pdf-parse`/`pdfjs-dist` de Node não servem aqui).
3. Parser da Seção 1: linhas `^\s*(\d+)\s+([A-ZÀ-Ú' ./-]+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*%`, com números em formato brasileiro.
4. Parser da Seção 2: divide o texto **apenas** pelo marcador em início de linha `^Município:\s*(.+)$`; dentro de cada bloco lê `Atividade Esportiva:`, `Eventos Realizados (Número de Participantes):` e `Modalidades Oferecidas:` até o próximo marcador. Nomes de município citados dentro de textos de eventos nunca abrem bloco (âncora de início de linha + marcador literal), atendendo ao caso "Festival ... Escola Municipal Raul Soares" em Aimorés.
5. Eventos: `qtd_eventos` = ocorrências de `nome (número)`; participantes = soma dos números entre parênteses.
6. Mapeamento: normaliza (sem acento, maiúsculo, espaços colapsados) e compara com `nome_oficial`; sem correspondência exata, tenta sinônimos cadastrados e, falhando, grava código/peso nulos e reporta na lista de revisão.
7. Gravação em lotes, com remoção prévia das linhas do mesmo (ano_base, fonte_relatorio).

**Validação** — teste com Vitest sobre o relatório definitivo ano-base 2024: Raul Soares no ranking com nota final 5216 e índice 0,67620%; nenhuma atividade de Raul Soares vinda de bloco de outro município; soma das notas das atividades conferida contra 5120 (divergência apenas reportada, não bloqueia).

**Remoções** — `src/routes/_authenticated/icms/metas.tsx`, o item do menu em `src/components/AppLayout.tsx` e `src/lib/icms/metas.ts` caso nenhum outro módulo o use (verificar Comparativo e Plano antes de apagar; se usarem, o arquivo fica e só a tela sai).

## Fora de escopo
Critérios Turismo e Meio Ambiente; agendamento automático da ingestão.
