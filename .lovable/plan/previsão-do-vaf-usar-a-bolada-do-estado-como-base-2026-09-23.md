# Previsão do VAF: usar a bolada do Estado como base

## O que a imagem confirmou

A tabela "Transferências de 2026" traz, mês a mês, a linha **75% repassado pelo VAF** (a bolada estadual). Conferi com os números de Alto Caparaó e o cálculo fecha exatamente:

- Janeiro: 1.083.066.222 x 0,006760149% = R$ 73.216 (recebido 72.699)
- Fevereiro: 890.501.000 x 0,006760149% = R$ 60.199 (recebido 60.199)
- Agosto: 1.068.420.215 x 0,006691978% = R$ 71.498 (recebido 71.498)

Ou seja: **repasse do mês = índice do município x bolada do VAF do mês**. Hoje a tela deduz essa bolada de trás para frente (valor recebido ÷ índice), o que dá praticamente o mesmo número (R$ 757,3 mil contra R$ 757,8 mil pela bolada real), mas não deixa a conta visível e não permite simular a arrecadação do Estado.

A previsão de 2027 (R$ 757 mil) já embute a queda de 13,6% do índice: ela é 14% **menor** que o ano fechado de 2026 (R$ 880 mil). Parecia alta só porque estava sendo comparada com os R$ 587 mil recebidos até agosto.

## O que muda

### 1. Cadastro da bolada do Estado
Nova tela para guardar, por exercício, os valores mensais da tabela de transferências da FJP:
- colar a tabela copiada do portal (ou enviar o CSV baixado pelo botão Download) e o sistema lê as linhas Transferência líquida, 75% VAF e 25% Lei Robin Hood;
- também dá para digitar mês a mês.
Os dados valem para todas as prefeituras, então bastam uma carga por ano.

### 2. Previsão passa a calcular pela bolada
- Base da receita do ano seguinte, três opções:
  1. **Repetir o Estado** — total do VAF de 2026, completando os meses que faltam pela média.
  2. **Crescimento da arrecadação** — o total acima corrigido por um percentual informado.
  3. **Digitar a bolada** — total anual do VAF informado à mão.
- Previsão anual = índice projetado x bolada anual; mês a mês pela sazonalidade da bolada do Estado.
- Quando não houver bolada cadastrada, continua valendo o cálculo atual (valor recebido ÷ índice), com aviso na tela.

### 3. Memória de cálculo visível
- Quadro "Como chegamos nesse valor" com as quatro linhas: índice aplicado hoje, índice projetado (e a variação em %), bolada do Estado usada, previsão resultante.
- Os cartões passam a separar claramente **recebido até o último mês informado** de **ano fechado estimado**, e a diferença/% sempre comparam previsão x ano fechado.
- Novo cartão com a queda/alta do índice em pontos e em %, para ficar claro que a queda está aplicada.
- Opção de escolher o índice projetado entre: média das duas últimas apurações (padrão), só a última apuração, ou valor digitado.

## Detalhes técnicos

- Migração: tabela `repasses_estado` (exercicio, mes, transferencia_liquida, vaf_75, robin_hood_25, unique(exercicio, mes)) com GRANT para `authenticated`/`service_role`, RLS com leitura para autenticados e escrita para superadmin/consultor.
- `src/lib/icms/transferenciasFjp.ts`: parser do texto/CSV da tabela de transferências (pt-BR, milhar com ponto), com testes.
- `src/hooks/useRepassesEstado.ts`: leitura por exercício e gravação em lote.
- `src/lib/vaf/previsaoRepasse.ts`: aceitar `boladaEstado` (12 meses) como fonte primária; manter o caminho atual (`valor ÷ índice`) como reserva; expor `memoriaCalculo` com índice, bolada e previsão.
- `src/components/analises/PrevisaoRepasse.tsx`: seletor da origem do índice, quadro de memória de cálculo, cartões separados e aviso quando faltar a bolada.
- Nova rota de carga sob `/icms/` para a tabela de transferências, com `head()` próprio.
- Nada da apuração do VAF é alterado.
