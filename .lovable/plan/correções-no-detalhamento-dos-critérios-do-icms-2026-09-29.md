# Correções no detalhamento dos critérios do ICMS

## Resultado esperado
- Educação: a coluna Pontuação em Vizinhos exibirá números com até oito casas decimais sem quebrar ou cortar, inclusive 0,00107039.
- Patrimônio Cultural: o relatório enviado, identificado como “Pontuação definitiva — exercício 2027”, será apresentado como referente ao exercício de 2027. Remover a afirmação automática de publicação em 2028 e repasse em 2029; mostrar claramente a pontuação oficial e distinguir qualquer índice calculado pela aplicação da fórmula própria do sistema.
- Turismo: revisar o mesmo quadro de conferência da imagem enviada, sem afirmar automaticamente que o relatório de 2026 gera repasse em 2028. Comparar com valores recebidos apenas quando relatório, exercício e escala do índice forem compatíveis; caso contrário, mostrar a incompatibilidade e não uma meta ou alerta monetário enganoso.
- Meio Ambiente: identificar a origem dos 0,175 de Alto Caparaó, eliminar a repetição indevida de registros já importados e mostrar um histórico legível por exercício, tipo de publicação e competência, com aviso antes de repetir a mesma carga.

## Implementação e conferência
1. Ajustar a formatação e a largura da tabela Vizinhos sem alterar os valores originais do relatório.
2. Ajustar a conferência financeira compartilhada para distinguir ano de atividade, exercício do relatório e exercício do repasse; não usar uma regra fixa de +2 anos. Para Patrimônio, separar os 9,7 pontos oficiais de Alto Caparaó do número 14,3068, que hoje é uma proporção calculada sobre o maior total do ranking, não um índice oficial de repasse. Exibir a memória da conta somente quando as bases forem comparáveis.
3. Para Meio Ambiente, revisar as tabelas parciais/trimestrais e o Fator de Qualidade antes de escolher o índice aplicável; preservar publicações complementares, mas evitar registros repetidos da mesma publicação e recargas repetidas. Conferir o histórico já existente e corrigir duplicações confirmadas sem apagar dados de competências diferentes.
4. Organizar a importação e o histórico de Meio Ambiente por exercício, versão e competência identificada, avisar quando a mesma publicação já tiver sido importada e permitir substituí-la de forma segura quando houver nova versão. Testar importação repetida e publicação complementar.
5. Validar com os exemplos das imagens, o PDF do IEPHA e registros de Alto Caparaó; testar cálculos e apresentar os valores finais com suas origens.

## Detalhes técnicos
- O quadro compartilhado usa atualmente o último exercício importado do município e aplica ano-base + 2 indiscriminadamente. Condicionar a conferência a exercícios compatíveis; se não houver repasse da competência correspondente, apresentar o relatório sem comparação numérica e sem alerta de divergência.
- O parser do Meio Ambiente toma o maior valor entre índices publicados e índice de conservação; as importações complementares não limpam itens e novas cargas fazem inserção simples. Registrar a identidade da publicação e sua competência; tornar a substituição/deduplicação atômica no servidor e não reduzir a pontuação de uma competência ao importar outra.
- Na base consultada, Alto Caparaó tem 0,1746988 no ranking definitivo de Meio Ambiente 2025, arredondado para 0,175; há repetições idênticas de itens importados. Verificar no PDF/identificação de cada carga se 0,1746988 é índice aplicável, em vez de presumir que o maior valor entre tabelas parciais é o índice final.
- O PDF anexado traz “PONTUAÇÃO DEFINITIVA – EXERCÍCIO 2027”; o ano de publicação exato não deve ser inferido do exercício. O histórico de Turismo inclui importações do mesmo link identificadas como preliminar e definitivo; não misturá-las na conferência.
