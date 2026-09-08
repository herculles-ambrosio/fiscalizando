# Critérios do ICMS (substituindo "Metas"), começando por Esportes

## Objetivo
Trocar o menu "Metas" por um menu "Critérios", que reunirá os 18 critérios da Lei 18.030/2009 e mostra, para cada município e ano-base, o que já pontua no Critério Esportes (ICMS Solidário) e o que ainda falta pontuar, a partir dos relatórios em PDF da SEDESE/Observatório do Esporte.

## O que muda na navegação
- O item "Metas" sai do menu do ICMS e a tela é removida.
- A tela "Critérios" vira a porta de entrada dos 18 critérios: uma lista em que cada critério abre sua própria página. Por enquanto só Esportes tem conteúdo próprio; os demais mantêm a visão atual de peso/índice com o rótulo "em desenvolvimento".
- A página do critério Esportes tem três abas: **Detalhamento do município**, **Ranking** e **Ingestão de dados** (esta última só para a consultoria/administração).
- Nada mais do módulo ICMS é alterado (Painel, Comparativo, Plano de melhoria, Cargas seguem como estão).

## O que o relatório traz (confirmado no PDF definitivo ano-base 2024, 717 páginas)

Ranking (uma linha por município habilitado), com as colunas reais:
`RANKING | MUNICÍPIO | ATIVIDADES | JIMI | JEMG | B.A E B.T ESTADUAL | FINAL | PERCENTUAL`.
Exemplo: `24 | RAUL SOARES | 5120 | 0 | 96 | 0 | 5216 | 0,67620%`. O nome do município pode vir quebrado em duas ou três linhas.

Memória de cálculo: um bloco por município e atividade, com um quadro de pontuação que o enunciado original não previa:
```text
Município: ABAETÉ
Atividade Esportiva: Outros Programas e Projetos
Eventos Realizados (Número de Participantes):
2ª Copa Open Karatê de Abaeté (46), Trilhão da ACA (160), ...
Modalidades Oferecidas:
KARATÊ, CICLISMO, ...
Peso Atividade Esportiva | Peso Receita Líquida per Capita | Pontuação Atletas | Pontuação Modalidades | Pontuação
1.5                      | 8                               | 15                | 10                    | 1800
```
A fórmula confere: peso da atividade × peso da RCL per capita × pontuação de atletas × pontuação de modalidades = pontuação do bloco (1,5 × 8 × 15 × 10 = 1800). Isso permite mostrar não só "falta a atividade X", mas também "nesta atividade você pontua 20 de um máximo possível", já que o peso da RCL é o mesmo para todas as atividades do município.

## Tela do critério Esportes

**Detalhamento do município** (município e ano-base selecionáveis)
- Cartões: pontuação de atividades, JIMI, JEMG, Bolsa Atleta/Técnico Estadual, nota final, índice percentual e posição no ranking.
- Lista "Já pontuando": atividade, peso do Anexo V, pontuação obtida, pontuação de atletas e de modalidades, número de eventos, participantes somados e modalidades.
- Lista "Ainda não explorado": atividades do Anexo V ausentes, com o ganho potencial estimado (peso da atividade × peso da RCL do município × faixas de atletas e modalidades) e uma explicação curta do requisito.
- Aviso destacado quando o município não aparece no relatório do ano: só participam do critério os municípios com Conselho Municipal de Esportes em pleno funcionamento (art. 8º, §1º da Lei 18.030/2009).
- Conferência visível: soma das pontuações das atividades comparada com a coluna ATIVIDADES do ranking, sinalizando divergência.

**Ranking**
- Tabela do ano-base com busca, ordenação e exportação CSV.

**Ingestão de dados** (superadmin/consultor)
- Busca automática dos links dos relatórios preliminar e definitivo mais recentes no observatoriodoesporte.mg.gov.br; os candidatos são exibidos para confirmação.
- Alternativas: colar a URL do PDF ou enviar o arquivo direto do computador.
- Escolha de tipo (preliminar/definitivo) e ano-base; reimportar substitui os dados daquele ano e tipo.
- Barra de progresso por página (o relatório tem centenas de páginas) e, ao final, resumo com municípios, atividades e a lista de nomes de atividade que não bateram com o Anexo V.

## Dados guardados
- `esportes_atividades_referencia` — as 14 atividades do Anexo V (código, nome oficial, sinônimos, peso, texto do requisito), criadas junto com a tabela.
- `esportes_ranking_municipio` — ano-base, município normalizado, nome original, posição, pontuação de atividades, JIMI, JEMG, BA/BT estadual, nota final, índice percentual, tipo do relatório, data da ingestão.
- `esportes_atividade_municipio` — ano-base, município normalizado, nome da atividade como veio do PDF, código e peso mapeados (podem ficar vazios para revisão), peso da RCL, pontuação de atletas, de modalidades e total, texto dos eventos, quantidade de eventos, total de participantes, texto das modalidades, tipo do relatório, data da ingestão.

Acesso: leitura para qualquer usuário autenticado (dados públicos estaduais, e o comparativo entre municípios depende disso); gravação apenas por superadmin/consultor.

## Detalhes técnicos

**Onde o PDF é lido.** O relatório tem 717 páginas e ~2 MB; extrair isso dentro de uma função de servidor estoura o tempo/CPU do runtime de borda. A leitura acontece no navegador do admin, com `pdfjs-dist` página a página (barra de progresso), e só as linhas já estruturadas são enviadas ao servidor para gravação em lotes. A descoberta do link e o download do PDF passam por uma função de servidor (`src/lib/icms/esportes.functions.ts`), que devolve o arquivo ao navegador evitando bloqueio de origem cruzada.

**Parser da Seção 1.** Percorre as linhas acumulando fragmentos de nome; ao encontrar `^\s*(\d+)\s+(.*?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)%$`, junta o nome da própria linha com os fragmentos pendentes das linhas anteriores. Números em formato brasileiro. Cabeçalhos e rodapés de página (`n / 717`) são descartados.

**Parser da Seção 2.** Divide **apenas** por `^Município:\s*(.+)$` no início da linha; dentro do bloco lê `Atividade Esportiva:`, `Eventos Realizados (Número de Participantes):`, `Modalidades Oferecidas:` e a linha numérica após o cabeçalho `Peso Atividade Esportiva ...`. Menções ao nome de um município dentro de textos de evento (ex.: "1º Festival Esportivo da Escola Municipal Raul Soares", que aparece em Aimorés, e "44ª Olimpíadas de Raul Soares", em Caratinga) nunca abrem bloco.

**Mapeamento das atividades.** Normaliza sem acento/maiúsculas e compara com `nome_oficial` e sinônimos. Os nomes que o PDF usa já foram levantados: Projetos Sócio Educacionais, Esporte para Pessoas com deficiência, Jogos Escolares Municipais, Atividades Futebol Amador, Esporte Terceira Idade, Atividades de Lazer, Qualificação de Agente Esportivo, Xadrez na Escola, Academia na Escola, Outros Programas e Projetos, Instalação/Reforma/Equipamento Esportivo, Bolsa Atleta e Bolsa Técnico - Estadual e Municipal –BABTE. Sem correspondência, o código e o peso ficam vazios e o nome entra na lista de revisão.

**Validação (Vitest, com o PDF definitivo 2024 já disponível).** Raul Soares no ranking com 5120 / 0 / 96 / 0 / 5216 / 0,67620%; nenhum bloco de atividade atribuído a Raul Soares vindo de texto de outro município; soma das pontuações das atividades conferida contra 5120 (divergência é reportada, não bloqueia); nomes de município quebrados em várias linhas (Lagoa da Prata, São João del Rei, Entre Rios de Minas) lidos corretamente.

**Remoções.** `src/routes/_authenticated/icms/metas.tsx` e o item do menu em `src/components/AppLayout.tsx`; `src/lib/icms/metas.ts` só sai se nenhum outro módulo o usar (verificar Comparativo e Plano antes).

## Fora de escopo
Critérios Turismo e Meio Ambiente; agendamento automático da ingestão.
