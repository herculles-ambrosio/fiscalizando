# Situação da Receita não aparece no "O que fazer para recuperar"

## O que está acontecendo (confirmado nos dados)

A inscrição estadual 6410911180059 (FRIGORIFICO FRANBOM LTDA) tem no cadastro apurado o CNPJ **24.873.010/0001-08**, e esse CNPJ já está no cache da Receita com situação **ATIVA** — por isso a tela "Contribuintes" mostra "Ativa".

Já no plano de recuperação a linha exibe o CNPJ **00.006.721/6906-16**, que não é um CNPJ válido: ele vem do arquivo de retorno, onde esse campo nem sempre traz o CNPJ correto. A busca da situação usa preferencialmente o CNPJ que vem da própria ação; como esse número não existe no cache (e nem existe de verdade), a etiqueta fica "Não consultado" — mesmo com o contribuinte já consultado.

O mesmo vale para o "Por que variou", que usa o mesmo caminho.

## Correção

- Passar a tratar o **cadastro apurado do município como fonte principal do CNPJ** por inscrição estadual, nas telas de Análise do VAF. O CNPJ que vem junto da ação/diagnóstico só é usado quando a inscrição não está no cadastro.
- Descartar CNPJs inválidos (que não tenham 14 dígitos ou que não passem no dígito verificador) antes de usá-los para consulta ou exibição — evita gerar consultas para números inexistentes.
- Exibir na linha do contribuinte o CNPJ efetivamente usado (o do cadastro), para o número mostrado bater com o da tela de Contribuintes.
- Efeito prático: contribuintes já consultados passam a mostrar Ativa/Baixada/etc. imediatamente, sem reconsultar, e os contadores de "pendentes"/"sem CNPJ" ficam corretos.

## Detalhes técnicos

- `src/hooks/useReceitaPorIe.ts`: inverter a precedência em `cnpjPorIe` para `cadastro?.[k]?.cnpj` primeiro e `e.cnpj` como fallback, ambos passando por uma validação de CNPJ.
- Novo helper `cnpjValido` em `src/lib/receita/normalizar.ts` (14 dígitos, rejeita repetidos, confere dígitos verificadores), aplicado em `limparCnpj` ou logo após ele nesse fluxo.
- `PlanoRecuperacao.tsx` e `DiagnosticoVariacao.tsx`: exibir o CNPJ vindo de `receita.cnpjDe(ie)` em vez de `c.cnpj` na linha e no painel de detalhe (exportações CSV/DOCX/PDF seguem o mesmo valor).
- Sem migração e sem alteração na lógica de apuração/gravação das ações.
