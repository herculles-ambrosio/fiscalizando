# Nova aba "Outras receitas" na Evolução do VAF

## O que foi confirmado no arquivo enviado

No `P025RT1426.txt`, a VIACAO SERRENSE (IE 0253405210050) aparece assim:

- Registro **07**: saídas 382.181 · entradas 76.436 · **outras entradas 305.745** (é o valor circulado na imagem 1).
- Registro **10**: repete "outras entradas VAF" = 305.745.
- Registro **08**: `município 025 · valor 305.745 · tipo de detalhamento 05 · percentual 100% · valor computado 305.745`.

O campo "tipo de detalhamento" do registro 08 é exatamente a tabela da imagem 2 (1 Produtos Agropecuários … 8 Resumo por Município). Nesse caso o código 05 = Prestação de Serviço de Transporte Rodoviário, coerente com a empresa ser transportadora.

A imagem 3 (registros 14, 15, 18 a 22 e 23) é o detalhamento nota a nota de cada uma dessas classificações. Esses registros já existem no layout do sistema, mas o arquivo enviado só traz o 15 (2 linhas) e o 23 — os demais não vêm em toda remessa. Então: o registro **08 é a fonte principal** da aba; os registros 14/15/18/19/20/21/22 entram como detalhe adicional quando existirem, e o **23** como conferência do total por município do estabelecimento.

## O que será construído

Nova aba **"Outras receitas"** no grid de detalhamento da aba Evolução do VAF, ao lado de Indicadores, Memória de cálculo, etc.

Conteúdo da aba:

1. **Cartões de topo**: total de outras entradas do arquivo atual, total do arquivo base e a diferença/variação.
2. **Resumo por classificação** (os 8 códigos da imagem 2): valor base, valor atual, diferença e participação % — com o nome de cada classificação escrito por extenso.
3. **Tabela por contribuinte**: IE, nome, CNPJ, classificação(ões), município de destino do valor, percentual, valor computado, valor no arquivo base, diferença. Com busca, ordenação por valor/diferença e paginação.
4. **Detalhe por contribuinte**: ao clicar na linha, abre o desdobramento vindo dos registros 14/15/18/19/20/21/22 (quando presentes no arquivo) e a conferência com o registro 23. Se o arquivo não trouxer esses registros, mostra aviso claro dizendo que aquela remessa não veio com o detalhamento.
5. **Exportação CSV** respeitando busca/filtro ativo, no mesmo padrão das outras abas.

## Detalhes técnicos

- Novo módulo `src/lib/vaf/outrasEntradas.ts`:
  - `extrairOutrasEntradas(texto)` — percorre as linhas e monta: mapa por IE com total do registro 07/10, linhas do registro 08 (município, tipo de detalhamento, percentual, valor computado), linhas dos registros 14/15/18–22 e totais do registro 23.
  - `CLASSIFICACOES_OUTRAS_ENTRADAS` — tabela código → descrição (imagem 2).
  - `compararOutrasEntradas(base, atual)` — junta por IE + classificação e devolve base/atual/diferença, no mesmo formato das comparações já existentes.
  - Nome e CNPJ reaproveitados dos registros 01/11/35/40 pela mesma lógica já usada em `extrairDeclarantes`.
- `src/lib/vaf/evolucao.ts`: `analisarArquivo()` passa a incluir `outrasEntradas` no `ArquivoEvolucao`.
- `src/components/analises/EvolucaoView.tsx`: novo `TabsTrigger`/`TabsContent` "Outras receitas" com os blocos acima, reaproveitando os componentes de tabela, busca e paginação já usados nas outras abas.
- Sem mudança de banco de dados; tudo é lido do arquivo carregado na tela.
