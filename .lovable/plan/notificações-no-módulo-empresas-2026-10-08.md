# Notificações no módulo Empresas

Novo menu **"Notificações"** abaixo de "Comparar com cadastro da prefeitura", com duas abas, no mesmo padrão do menu Ofícios do Apura VAF.

## Aba "Emitir"
- Lista as empresas da comparação com a observação **"Ativa na Receita e sem cadastro na prefeitura"** (primeiro tipo; outros podem ser adicionados depois).
- Busca, seleção individual ou "selecionar todas", paginação 10/15/20/25.
- Botões: gerar notificação de uma empresa (Word) ou de todas as selecionadas (pacote .zip), com o mesmo cabeçalho (brasão, nome da prefeitura, Estado de Minas Gerais), rodapé e assinatura do cadastro da prefeitura.
- Histórico das notificações emitidas (empresa, modelo, data, quem emitiu).

## Aba "Modelos"
- Igual à de Ofícios: editar título, corpo, cabeçalho, rodapé e margens; criar novos modelos; ativar/desativar; pré-visualizar.
- Modelo padrão já criado: "Notificação de inscrição no cadastro municipal" (texto pedindo que a empresa regularize sua inscrição no cadastro econômico da prefeitura, com prazo). O texto será um rascunho para você ajustar.
- Variáveis disponíveis: `{{contribuinte}}`, `{{cnpj}}`, `{{endereco}}`, `{{atividade}}`, `{{situacao}}`, `{{data_inicio}}`, `{{prefeitura}}`, `{{municipio}}`, `{{cidade_data}}`, `{{data_extenso}}`.

## Detalhes técnicos
- Tabelas novas `empresas_modelos` (mesma estrutura de `cartorio_modelos`, com campo `observacao` indicando a qual observação se aplica) e `empresas_notificacoes` (histórico), por município, com GRANTs e RLS no padrão das demais.
- Reaproveitar `src/lib/oficios/documento.ts`, `modelos.ts` (placeholders/analisarCorpo) e `pacote.ts`; hook `useEmpresasModelos` seguindo `useCartorioModelos`.
- Lista vem da mesma lógica de cruzamento de `src/lib/empresas/prefeitura.ts`.
- Nova rota `empresas.notificacoes.tsx` e item no menu lateral; testes para as variáveis do modelo.
