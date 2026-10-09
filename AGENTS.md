<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Os ofícios VAF aceitam ano de apuração e ano de aplicação separados, pois o intervalo não é necessariamente de um ano.
- As publicações ambientais são complementares por exercício, versão e identidade da fonte; a importação atômica substitui somente a mesma fonte e o Fator de Qualidade não sobrescreve o índice consolidado, para evitar somas e duplicações indevidas.
- Na comparação regional dos critérios, componentes de escalas distintas devem ser exibidos separadamente; índices consolidados ambientais usam o maior índice publicado, não a soma das linhas, para preservar o significado oficial.
- Empresas (`empresas`) é por município; dados vêm das fontes públicas de CNPJ por consulta e da base aberta da Receita lida em fluxo no navegador — o servidor nunca recebe os arquivos brutos (muitos GB).
- O cadastro econômico da prefeitura (`empresas_prefeitura`) é substituído inteiro a cada importação e cruzado com `empresas` por CNPJ no navegador; a planilha só é aceita se o município predominante for a prefeitura ativa, porque a coluna Município é o endereço do contribuinte e não quem o cadastrou.
- Modelos exclusivos de uma prefeitura ficam em `documentos_prefeitura_modelos` (por município e módulo) e usam o componente compartilhado `DocumentosPrefeituraView`; os modelos padrão de cada módulo seguem nas tabelas próprias — assim cada cidade tem documentos próprios sem afetar as demais.
