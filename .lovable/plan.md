# Comparação detalhada na aba Vizinhos dos demais critérios

## Objetivo
Permitir abrir os quadros de oportunidades de Patrimônio Cultural, Esportes, Meio Ambiente e Turismo, como já acontece na Educação, para comparar lado a lado o município analisado e o vizinho que obteve o melhor resultado naquele item.

## O que será mostrado
- **Patrimônio Cultural:** pontos de ambos em cada componente e, quando constarem no relatório, as faixas de tombamento e registros de bens, além das observações publicadas. Não apresentar essas faixas como documentos comprobatórios individuais.
- **Esportes:** pontos da atividade, atletas, modalidades, eventos e participantes disponíveis no relatório para cada município; distinguir dados ausentes de zero.
- **Meio Ambiente:** registros individuais de saneamento e unidades de conservação, com a descrição disponível para cada município; identificar índices consolidados e competências, evitando somar publicações ou registros repetidos como se fossem uma pontuação única.
- **Turismo:** nota de habilitação, circuito, receita per capita, IRC, Nota × IRC, IIT e índice de participação tal como constam do relatório; não somar medidas de escalas diferentes nem inferir causas que o relatório não comprova.

## Detalhes técnicos
- Reutilizar o painel expansível da aba Vizinhos e a seleção de exercício/tipo já existente, criando apresentações específicas por critério a partir das informações atualmente importadas.
- Corrigir a agregação genérica das oportunidades onde somar linhas do relatório distorce o resultado, sobretudo em Meio Ambiente e Turismo. Comparar valores apenas dentro da mesma medida e publicação; preservar a distinção entre pontuação, índice e registros descritivos.
- Exibir mensagem clara quando o relatório selecionado não trouxer detalhe suficiente, em vez de inventar uma decomposição.
- Validar os quatro critérios com testes dos agrupamentos e conferir a abertura dos quadros na tela.
