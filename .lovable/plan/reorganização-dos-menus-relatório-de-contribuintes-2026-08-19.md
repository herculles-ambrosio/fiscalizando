# Reorganização dos menus + Relatório de Contribuintes

Hoje existem 4 telas que respondem perguntas parecidas: Comparar apurações, Evolução do VAF, Índice do VAF e o grid dentro de Apurações Realizadas. A proposta mantém tudo que existe (nada é perdido), mas reduz a navegação de 9 itens para 6 e cria a tela de contribuintes que falta.

## Menu proposto

```text
Painel
Nova apuração
Apurações Realizadas
Contribuintes            <- NOVO (relatório por situação/CNAE)
Análises do VAF          <- Evolução (padrão) + Comparar + Índice em abas
Ofícios                  <- Modelos + Emitidos em abas
Configurações
Prefeituras / Usuários   (consultoria, inalterado)
```

## 1. Análises do VAF (unifica 3 menus)

Uma rota única `/analises` com seletor de período no topo (base x comparado) compartilhado pelas abas:

- **Evolução** (aba padrão, tela atual intacta: KPIs, memória de cálculo, deixaram de declarar, novos, variação, municípios). É o coração do módulo e continua sendo o que abre primeiro.
- **Comparar apurações** — o conteúdo atual de `/comparacao` (totais e situações, índice/participação, por CNAE, contribuinte a contribuinte).
- **Índice do VAF** — o conteúdo atual de `/indice` (KPIs de índice, VAF próprio, débito, crédito externo, entre municípios, SIMEI, histórico de índices).

As rotas antigas `/comparacao`, `/evolucao` e `/indice` passam a redirecionar para `/analises?aba=...`, então links e histórico continuam funcionando.

## 2. Contribuintes (tela nova)

Rota `/contribuintes`, com seletor de apuração (competência) e visão consolidada:

- Cartões-contadores clicáveis: Omissos, Zerados, Fora do prazo, Discrepantes, Normais, Simples Nacional, SIMEI, Somente retorno.
- Filtros combináveis: situação (múltipla), CNAE, faixa de VAF, busca por nome/CNPJ/IE.
- Colunas ordenáveis com totalizador de VAF no rodapé (reaproveita o grid já existente da tela de apuração).
- Aba **Deixaram de declarar**: compara a competência selecionada com a anterior automaticamente (mesma lógica de `evolucao.ts`), com marcação de fallback de nome/CNPJ já implementada.
- Ações em lote: exportar CSV/Excel do recorte filtrado e gerar ofícios do grupo selecionado (usa o fluxo de ofícios existente).
- Painel lateral de detalhe do contribuinte (o `ContribuinteDetalhe` atual) reaproveitado aqui.

O grid dentro de Apurações Realizadas continua existindo para conferência da carga, mas o relatório transversal (por situação, entre competências, exportável) passa a viver em Contribuintes.

## 3. Ofícios

`/oficios` com duas abas: **Modelos** e **Emitidos** — mesmo conteúdo de hoje, um item de menu a menos.

## Detalhes técnicos

- Novas rotas: `src/routes/_authenticated/analises.tsx`, `contribuintes.tsx`, `oficios.tsx`.
- O conteúdo de `comparacao.tsx`, `evolucao.tsx`, `indice.tsx`, `modelos.tsx`, `emissoes.tsx` vira componente em `src/components/analises/*` e `src/components/oficios/*`; as rotas antigas viram redirects (`beforeLoad` com `redirect`).
- Aba controlada por search param (`?aba=evolucao`) para permitir link direto e voltar do navegador.
- `/contribuintes` consulta `contribuintes_apurados` da carga escolhida e usa `src/lib/vaf/evolucao.ts` para a aba de quem deixou de declarar. Sem mudança de schema.
- `AppLayout` atualizado com os 6 itens e ícones correspondentes.
- Cada rota nova recebe seu próprio `head()` com título e descrição próprios.
