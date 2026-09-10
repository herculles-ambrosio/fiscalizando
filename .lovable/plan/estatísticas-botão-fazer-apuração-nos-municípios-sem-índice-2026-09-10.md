# Estatísticas: botão "Fazer apuração" nos municípios sem índice

Hoje um município só entra no comparativo de Estatísticas quando tem índice salvo na tabela `indices_apurados` — ou seja, quando alguém apurou o índice na aba **Análises do VAF → Índice do VAF** e clicou em **Salvar apuração**. Quem aparece como "Sem apuração" fica sem caminho de ação. Este plano adiciona o atalho direto.

## O que muda na tela de Estatísticas

1. **Coluna/botão "Fazer apuração"**: nas linhas em que falta o índice do ano-base ou do período comparado (situação "Sem apuração"), a célula de situação ganha um botão discreto **"Fazer apuração"**.
2. Ao clicar:
   - a **prefeitura ativa do app troca para aquele município** (via `trocar()` de `useMunicipioAtivo`, que já persiste a escolha);
   - o usuário é levado para **Análises do VAF → aba Índice do VAF** (`/analises?aba=indice`), já com a prefeitura certa selecionada, pronto para subir o arquivo e salvar a apuração.
3. O botão indica o que falta: texto auxiliar como "falta o índice de 2025 (provisório)" ou "faltam os dois lados", conforme o caso.
4. **Painel lateral de detalhe**: quando a linha está sem apuração, o painel também mostra o mesmo botão, com a explicação curta do passo a passo (subir arquivo da SEFAZ → apurar → salvar).
5. Para usuário de prefeitura (que não troca de município), o botão só navega para a aba Índice do VAF — a prefeitura dele já é a ativa.

## Detalhes técnicos

- Alteração apenas em `src/routes/_authenticated/estatisticas.tsx`:
  - novo componente interno `AcaoApurar({ linha })` que decide o rótulo conforme `linha.base`/`linha.alvo` ausentes;
  - usa `useMunicipioAtivo().trocar(linha.municipioId)` quando `podeTrocar` (consultoria) e `Link`/`navigate` para `/analises` com `search: { aba: "indice" }`;
  - badge "Sem apuração" mantido, com o botão ao lado/abaixo.
- Sem mudanças em banco, RLS, hooks de dados ou regras de cálculo.
- Verificação: `bunx tsgo --noEmit` e conferência do log de build; teste visual na tela de Estatísticas clicando no botão de um município sem apuração.
