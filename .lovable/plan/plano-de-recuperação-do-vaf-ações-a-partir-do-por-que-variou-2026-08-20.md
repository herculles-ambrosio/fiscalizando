# Plano de recuperação do VAF (ações a partir do "Por que variou")

Sim, os exemplos que você deu são válidos e já são os dois pilares clássicos de recuperação de VAF: **ofício de retificação** (DAPI/DeSTDA/EFD com erro ou zerada) e **notificação para justificar** discrepância ou omissão. Abaixo eles entram como ações formais, junto de outras práticas usadas em consultoria de VAF.

## O que será construído

Um novo card **"O que fazer para recuperar"**, logo abaixo do "Por que variou", na Evolução do VAF. Ele transforma cada fator de variação em uma **lista priorizada de ações**, com o valor em risco/recuperável de cada uma e o caminho direto para emitir o documento.

### Como as ações são derivadas (regras)

Cada contribuinte do diagnóstico cai em uma trilha de ação:

| Situação detectada no diagnóstico | Ação sugerida | Documento |
|---|---|---|
| Deixou de declarar (saiu da base) | Notificação de omissão — intimar a entregar/retificar a declaração | Modelo OMISSO |
| Declarou com VAF zerado | Ofício de retificação de VAF zerado | Modelo ZERADO |
| Queda relevante de VAF (acima de um limite % e R$) | Notificação para justificar a discrepância | Modelo DISCREPANTE |
| Entrega fora do prazo | Ofício de alerta de perda de prazo / pedido de retificação | Modelo FORA_DO_PRAZO |
| SIMEI/Simples só no retorno (sem cadastro ativo) | Ofício de conferência cadastral (endereço/município do estabelecimento) | Modelo SIMEI |
| Queda de crédito externo / VAF B | Ação de conferência: verificar se o VAF migrou para outro município (erro de endereço na NF-e / IE) | Roteiro interno (sem ofício) |

Além dos ofícios, o card sugere ações não documentais que efetivamente recuperam VAF:

- **Impugnação do índice provisório** — janela legal anual para contestar o índice publicado pela SEFAZ; o card mostra o prazo e o valor em disputa quando a comparação envolve arquivo provisório/definitivo.
- **Conferência de endereço/CNAE no cadastro estadual** — contribuintes que geraram VAF em outro município por cadastro incorreto.
- **Visita fiscal / diligência in loco** para grandes quedas (top 5 impactos) antes do encerramento do exercício.
- **Levantamento de novos estabelecimentos** ainda não inscritos que operam no município.
- **Cruzamento com o ISS/alvará municipal** para achar empresas ativas ausentes do arquivo de retorno.
- **Campanha de conscientização** com os maiores contribuintes antes da entrega da DAPI de dezembro.

Cada ação mostra: prioridade (alta/média/baixa por valor de impacto), quantidade de contribuintes, **valor potencialmente recuperável** somado, prazo sugerido, e o texto do porquê.

### Interação

- Botão **"Emitir ofícios"** por ação: abre o diálogo de ofícios já existente, pré-filtrado pelos contribuintes daquela ação e com o modelo correspondente selecionado. Fica desabilitado com aviso quando a ação não tem documento (ex.: impugnação de índice).
- Botão **"Ver contribuintes"**: expande a lista com nome, IE, VAF base × comparado e impacto.
- O **plano de ação entra no .docx** já existente do "Por que variou" (nova seção "Plano de recuperação") e no CSV.
- Botão **"Copiar plano"** para colar em e-mail/ata.

## Detalhes técnicos

- `src/lib/vaf/recuperacao.ts` (novo): recebe o `DiagnosticoEvolucao` + os `MovimentoDeclarante` e devolve `AcaoRecuperacao[]` (chave, título, motivo, prioridade, valorRecuperavel, contribuintes, `situacaoOficio?`, prazoSugerido). Limiares configuráveis por constante (ex.: queda > 30% e > R$ 50 mil vira discrepância).
- `src/components/analises/PlanoRecuperacao.tsx` (novo): card com lista priorizada, `Collapsible` por ação (mesmo padrão visual do `DiagnosticoVariacao`), badges de prioridade e botões de emissão.
- `src/components/analises/EvolucaoView.tsx`: renderiza o novo card abaixo do diagnóstico, passando município ativo e exercício.
- Emissão: reaproveita o fluxo/diálogo de ofícios atual (modelos por `SituacaoOficio` e registro em `oficios_emitidos`), sem novas tabelas.
- `src/lib/vaf/diagnosticoDocx.ts` e `src/lib/vaf/evolucao.ts` (CSV): nova seção com as ações.
- Teste em `src/lib/vaf/recuperacao.test.ts` cobrindo classificação e soma do valor recuperável.

Sem alterações de banco de dados.
