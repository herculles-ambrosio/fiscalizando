# Educação — expandir cada índice no quadro "O que o município precisa fazer"

## Resultado esperado
Na aba Vizinhos do critério Educação, cada cartão (IAE, IRAP, IRE e o de Gestão, se aparecer) passa a ser clicável, com uma seta indicando que abre. Ao abrir, aparece uma tabela comparando, indicador por indicador, o melhor vizinho com o município em análise:

| Indicador (com explicação ao passar o mouse) | Ipanema (melhor) | Alto Caparaó | Diferença |
|---|---|---|---|

- A diferença aparece em vermelho quando o município está pior e em verde quando está melhor, levando em conta se no indicador "quanto menor, melhor" (abandono, distorção, etc.).
- Os indicadores em que o município está pior aparecem primeiro, para mostrar logo onde está a deficiência.
- Indicadores de etapas que a rede municipal não atende (ex.: Anos Finais) aparecem em cinza, marcados "não se aplica".
- Se não houver dados constitutivos importados para o exercício, aparece um aviso pedindo a importação da planilha da FJP.
- Os demais critérios continuam como estão.

## Correspondência usada
- Índice de Atendimento Educacional (IAE) → dados da aba "Atendimento" da planilha FJP.
- Índice de Desempenho Escolar (IRAP) → aba "Desempenho".
- Índice de Rendimento Escolar (IRE) → aba "Rendimento".
- Gestão (IGE) → aba "Gestão".

## Detalhes técnicos
- Novo hook em `useEducacao.ts` que busca `educacao_dados_constitutivos` de dois municípios (o analisado e o melhor vizinho do item) para o exercício/versão do relatório selecionado; carregado só quando o cartão é aberto.
- Novo componente `ComparacaoIndicadoresEducacao.tsx` reutilizando `separarColuna`, `direcaoDoIndicador`, `etapaDoIndicador`, `etapasAtendidas`, `descricaoIndicador` e `useMetadadosIndicadores`.
- `VizinhosCriterio.tsx`: guardar a chave do melhor vizinho em cada lacuna, tornar o cartão um `Collapsible` e renderizar a comparação quando `slug === "educacao"`. Versão: `fonte` preliminar → "provisorio", definitivo → "definitivo".
