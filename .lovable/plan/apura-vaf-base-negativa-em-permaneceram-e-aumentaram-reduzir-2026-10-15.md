# Apura VAF: base negativa em "Permaneceram e aumentaram/reduziram"

## O que muda

Na aba Evolução do VAF, no quadro **Por que variou**, o detalhamento dos fatores
"Permaneceram e aumentaram" e "Permaneceram e reduziram" mostra, por contribuinte,
as colunas Base, Comparado/estimado e Impacto. Hoje, quando a **Base é negativa**
(o contribuinte declarou VAF negativo no arquivo base), o Impacto soma o comparado
com a base negativa (ex.: -R$ 2.890.096 + R$ 4.456.430 = R$ 7.346.526), o que não
reflete o efeito real esperado.

Nova regra, aplicada **somente quando a Base é negativa**:

- **Impacto** = o valor da coluna Comparado/estimado (a base é tratada como zero,
  não soma nem subtrai).
- **Base** = exibida como **(R$ 0,00)** em **vermelho**, para deixar claro que esse
  valor não entrou na conta.
- O total do fator (a barra e o valor acima da tabela, ex. "R$ 15.533.500,00")
  passa a somar os impactos com essa nova regra.
- A diferença que deixar de ser contada aparece no fator "Demais componentes",
  garantindo que a soma dos fatores continue fechando com a variação total.

Onde aparece: tela "Por que variou" (aba por declarantes), cards "Maiores
quedas/altas", texto copiável, documentos .docx e .pdf da análise — todos passam a
usar o mesmo cálculo.

Fica como está: a exportação CSV da evolução continua com os valores originais dos
arquivos, e o fator "Deixaram de declarar" mantém o cálculo atual.

## Detalhes técnicos

- `src/lib/vaf/diagnostico.ts`
  - Nova função `impactoDeclarante(d)`: `d.vafBase < 0 ? d.vafAtual : d.diferenca`.
  - Itens dos fatores `quedas` e `altas` usam esse impacto (e ordenação por ele);
    `somaQuedas`/`somaAltas` passam a somá-lo. O `residual` continua sendo
    `diferenca - deltaDeclarado`, absorvendo a parte não contada.
  - `topQuedas`/`topAltas`: seleção e valores com o impacto ajustado.
- `src/components/analises/DiagnosticoVariacao.tsx` (tabela da `Barra`)
  - Nos fatores `quedas`/`altas` por contribuinte, célula Base com
    `i.valorBase < 0` renderiza `(R$ 0,00)` em `text-destructive`.
- `src/lib/vaf/diagnosticoDocx.ts` (`tabelaDetalhe`) e `src/lib/vaf/relatorioPdf.ts`
  - Mesma regra de exibição para a coluna Base quando o fator é
    "Permaneceram e reduziram/aumentaram".
- Teste unitário novo em `src/lib/vaf/diagnostico.test.ts`: base negativa →
  impacto = comparado; base positiva → impacto = diferença; soma dos fatores
  fechando com a variação total.
