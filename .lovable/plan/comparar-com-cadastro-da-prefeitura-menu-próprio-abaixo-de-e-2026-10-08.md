# Comparar com cadastro da prefeitura — menu próprio abaixo de Empresas

## Objetivo
Mover a comparação do cadastro municipal (hoje um botão dentro da tela Empresas que abre um painel) para um item próprio no menu lateral, abaixo de "Empresas", com nome "Comparar com cadastro da prefeitura".

## Mudanças

### 1. Nova rota `src/routes/_authenticated/empresas.comparar.tsx`
- `createFileRoute("/_authenticated/empresas/comparar")` → URL `/empresas/comparar`.
- Componente de página: usa `useMunicipioAtivo` e `useEmpresas` (mesmos dados de hoje) e renderiza `ComparacaoPrefeitura` em tela cheia, com título "Comparar com cadastro da prefeitura — {município}".
- `onClose` do componente passa a navegar de volta para `/empresas` (mantém o botão X).
- `head()` com título e descrição próprios.

### 2. Menu lateral `src/components/AppLayout.tsx`
- `NAV_EMPRESAS` recebe dois itens: `Empresas` e `Comparar com cadastro da prefeitura` (ícone `GitCompare`, importado do lucide-react).
- Ajuste no destaque do item ativo: `/empresas` passa a ser correspondência exata (como já ocorre com `/icms`), para não ficar dois itens destacados quando a URL for `/empresas/comparar`.
- Nenhuma mudança no seletor de produto: `pathname.startsWith("/empresas")` já cobre a nova URL, então o módulo Empresas continua com a mesma apresentação.

### 3. Tela Empresas `src/components/empresas/EmpresasView.tsx`
- Remove o botão "Comparar com cadastro da prefeitura", o estado `compAberta` e a renderização do painel embutido.
- Limpa imports que ficarem sem uso (`GitCompare`, `ComparacaoPrefeitura`).

### 4. Verificação
- Typecheck do projeto.
- Checagem visual com Playwright: menu lateral mostra o novo item abaixo de Empresas; `/empresas/comparar` abre a comparação; `/empresas` abre a listagem sem o botão.

Fora de escopo: nenhuma mudança no parser `prefeitura.ts`, no banco (`empresas_prefeitura`) ou nas exportações.
