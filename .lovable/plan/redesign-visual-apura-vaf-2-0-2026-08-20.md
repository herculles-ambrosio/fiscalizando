# Redesign visual — Apura VAF 2.0

Nova camada estética premium (referência Linear/Stripe/Vercel) sem tocar em arquitetura de informação, menus, campos de formulário ou regras de negócio. Só identidade, cor, tipografia, espaçamento e microinterações.

## 1. Marca e logo

- Novo símbolo: barras estilizadas formando um "V" (gráfico + VAF), geométrico, duotone verde-esmeralda/âmbar, legível a 32px.
- Componente React `Logo` com duas variantes: horizontal (ícone + wordmark "Apura VAF" + badge discreto "2.0") e só ícone.
- Usado na sidebar, no header mobile, na coluna institucional do login e como novo favicon.
- Wordmark em fonte de destaque, peso 700, tracking levemente fechado; "2.0" como pill pequena em fundo suave.

## 2. Paleta

- Primária: verde-esmeralda profundo (faixa #0F4C3A–#166534) substituindo o verde-oliva.
- Acento: âmbar/dourado suave (#D4A24C) para CTAs de destaque, item ativo do menu e séries de gráfico.
- Fundo: off-white quente (#FAFAF7); cards em branco puro com sombras em camadas, sem bordas duras.
- Status recalibrados em pastel + texto forte: Omissos coral/vermelho, Zerados âmbar, Fora do prazo roxo, Discrepantes azul, Normais verde, Simples Nacional/SIMEI em neutros distintos.
- Todos os valores continuam como tokens em `src/styles.css` (oklch), com equivalentes de modo escuro atualizados.

## 3. Tipografia

- UI: Inter. Títulos/KPIs: Space Grotesk (substituem IBM Plex Sans / Archivo, carregados via `<link>` no root).
- Escala: títulos 600–700, corpo 400, KPIs 700–800 com tamanho maior; legendas menores e mais discretas.

## 4. Tela de login

- Mantém as duas colunas e os mesmos campos.
- Coluna esquerda: gradiente verde profundo → verde mais claro, com padrão de grid/blobs de baixa opacidade; logo maior no topo; headline em fonte de destaque com "Valor Adicionado Fiscal" em âmbar; miniatura vetorial do painel (cards + barras) como apoio visual.
- Coluna direita: labels acima dos campos, inputs 10px de raio com foco em âmbar, botão "Entrar" com sombra e microinteração de hover/press, erro em estilo suave.
- Rodapé "Acesso restrito…" como legenda pequena com ícone de cadeado.

## 5. Sidebar e painel

- Mesmos itens, mesma ordem. Ícones Lucide outline com peso uniforme.
- Item ativo em pill arredondada com acento; hover suave nos demais.
- Agrupamento visual com labels de seção em caixa-alta pequena e divisores sutis (sem alterar a ordem dos itens).
- "Prefeitura ativa" vira card com avatar/inicial do município, cantos arredondados e sombra leve.
- Cards de KPI: padding maior, raio 12–16px, sombra suave, badge pill no topo, número grande, "de X ativos" como legenda discreta.
- Gráfico de CNAEs: barras com topo arredondado em gradiente do acento, grid pontilhado claro, tooltip moderno.

## 6. Componentes gerais

- Variantes de botão atualizadas (primário com elevação; secundário com borda fina e fundo transparente).
- Raios consistentes: 8px inputs/botões, 12–16px cards; tabelas, sheets, dialogs e badges alinhados ao novo token de sombra/raio.
- Espaçamento mais generoso entre seções nas telas existentes (painel, contribuintes, análises, ofícios) sem mudar conteúdo.

## Notas técnicas

- Tokens novos (`--accent-gold`, `--shadow-soft`, `--gradient-brand`, status atualizados) em `src/styles.css` no `:root`/`.dark` e registrados em `@theme inline`.
- Fontes por `<link>` em `src/routes/__root.tsx`; nada de `@import` remoto no CSS.
- Arquivos tocados: `src/styles.css`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/components/AppLayout.tsx`, `src/components/SituacaoBadge.tsx`, `src/routes/_authenticated/dashboard.tsx`, variantes de `src/components/ui/{button,card,input,badge}.tsx`, novo `src/components/Logo.tsx` e novo favicon.
- Nenhuma mudança em hooks, libs de apuração, rotas, banco ou lógica de formulários.
