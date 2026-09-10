# Impugnação do índice provisório do VAF

Novo lugar único no Apura VAF para montar a impugnação do índice provisório a partir dos contribuintes que você marcar, com o texto pronto e a planilha dos contribuintes anexa.

## Como vai funcionar

1. Nas telas de **Contribuintes** e **Análises do VAF**, ao lado do botão de gerar ofícios entra o botão **Montar impugnação**, que leva os contribuintes marcados para a nova tela.
2. Na nova tela **Impugnação** você confere e ajusta:
   - dados da prefeitura, exercício/ano-base e índice provisório publicado;
   - motivo de cada contribuinte (não declarou, declarou zerado, queda expressiva, valor divergente), preenchido automaticamente pelo que o sistema já apurou e editável;
   - valor do VAF que se pretende recompor por contribuinte.
3. Um resumo mostra quantos contribuintes entram, o VAF total contestado e o efeito estimado no índice.
4. Botões de saída:
   - **Baixar impugnação (DOCX)** — petição completa: identificação do município e do signatário, fundamentação, tabela resumo, pedido e fecho, no mesmo timbrado dos demais relatórios;
   - **Baixar planilha (XLSX)** — uma linha por contribuinte (IE, CNPJ, nome, situação na Receita, motivo, VAF declarado, VAF apurado, diferença, observação), pronta para anexar;
   - **Baixar tudo (ZIP)** — documento + planilha.
5. As impugnações montadas ficam salvas por prefeitura, para reabrir, editar e reemitir.

## Base legal

O texto cita a Lei Complementar 63/1990 e a Lei 18.030/2009, e a resolução que fixou os índices provisórios do exercício, com o número e a data como campo editável na tela — assim você usa a Resolução nº 6.069/2026 ou outra, sem depender de atualização do sistema. A pesquisa confirmou o rito de impugnação da SEF/MG (prazo contado da publicação, exigência de razões claras por hipótese e protocolo pelo SEI em "SEF – Recurso VAF"); um lembrete com o prazo e o caminho do SEI aparece na tela. A numeração 6.069/2026 não foi localizada nas páginas públicas consultadas — por isso o campo fica editável e o número que você informar é o que sai no documento.

## Detalhes técnicos

- Nova rota `src/routes/_authenticated/impugnacao.tsx` + item de menu; estado inicial recebido por `search params` (ids dos contribuintes + carga).
- Nova tabela `impugnacoes` (municipio_id, exercicio, resolucao, itens jsonb, texto, status) com RLS por município e GRANTs, mais hook `useImpugnacoes`.
- Motivos derivados de `situacoes` de `contribuintes_apurados` e do plano de recuperação (`src/lib/vaf/recuperacao.ts`), reaproveitando a deduplicação por IE/CNPJ.
- `src/lib/vaf/impugnacaoDocx.ts` com `docx` (padrão de `planoDocx.ts` e `Timbrado`), planilha via `xlsx` (já instalado), ZIP via o mesmo utilitário de `src/lib/oficios/pacote.ts`.
- Botão nas telas existentes: `ContribuintesGrid.tsx` (junto do `OficiosDialog`) e na aba correspondente de Análises.
