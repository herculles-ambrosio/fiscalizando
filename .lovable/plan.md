# Cartório: coluna "(-) 7% Recompe" e trabalho por cartório com todos os meses

## 1. Nova coluna "(-) 7% Recompe"
- Na tabela da Fiscalização, logo após "Emolumentos", entra a coluna **"(-) 7% Recompe"** = Emolumentos × 0,93.
- Essa passa a ser a **base de cálculo**: ISS devido = (-) 7% Recompe × alíquota. Diferença de ISS e status acompanham automaticamente.
- Aplicado em todos os lugares que calculam ISS devido: tabela mensal, "Todos os meses", cartões de totais do topo, resumo por municípios e exportação CSV (com a nova coluna).
- Cartão de totais ganha "(-) 7% Recompe" ao lado de "Emolumentos (TJMG)".

## 2. Seletor de cartório com visão anual
- No topo da Fiscalização, novo seletor **"Cartório"** (padrão: "Todos os cartórios", lista por nome + tipo de serviço, com busca) e seletor **"Ano"**.
- Ao escolher um cartório e um ano, a tela muda para uma **grade anual**:

```text
Linha                    | Jan | Fev | ... | Dez | Total
Emolumentos (TJMG)       |     |     |     |     |
(-) 7% Recompe           |     |     |     |     |
ISS devido (5%)          |     |     |     |     |
Base declarada  [editar] |     |     |     |     |
ISS pago        [editar] |     |     |     |     |
Diferença de ISS         |     |     |     |     |
Status                   |     |     |     |     |
```

- Base declarada e ISS pago são editáveis mês a mês, com gravação automática ao sair do campo (mesma regra atual: apagar volta ao status anterior).
- Meses sem carga do TJMG aparecem esmaecidos com "sem carga".
- Coluna Total soma o ano; botão CSV exporta a grade.
- Voltar para "Todos os cartórios" retorna à visão atual (por competência).

## Detalhes técnicos
- Cálculo central em `useFiscalizacaoCartorio` e `useResumoMunicipios` (`useCartorios.ts`): novo campo `baseRecompe = emolumentos * 0.93`; `issDevido` e diferença passam a usar essa base. Constante `DESCONTO_RECOMPE = 0.07` exportada.
- Nova consulta `useFiscalizacaoCartorioAnual(cns, ano)` reaproveitando a leitura por competência para os 12 meses; salvamento via `useSalvarDeclaracao` existente, invalidando o cache.
- Novo componente `src/components/cartorios/GradeAnualCartorio.tsx`; `cartorios.tsx` recebe os seletores e alterna entre as visões.
- Sem mudança no banco.
