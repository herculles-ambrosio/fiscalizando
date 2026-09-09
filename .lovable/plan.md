# Buscar a lista de serventias direto do portal do TJMG

Hoje a tela de Cartórios só consegue ler a planilha que você exporta no portal. A ideia é o próprio sistema entrar no painel do TJMG e trazer a lista pronta.

## O que eu verifiquei agora

- A página do portal da transparência do TJMG recusa acesso automático (erro 403) quando é chamada por um programa.
- Mas o painel de dados em si (o servidor Qlik do TJMG, em `qlik.tjmg.jus.br`) respondeu normalmente e aceita o modo de visualização pública, sem login. Esse é o caminho viável: pedir os dados diretamente ao painel, e não à página que o embute.
- O que falta descobrir é o identificador do painel de serventias (o "código" do painel e da tabela). Ele aparece no endereço do painel quando você o abre no navegador.

## Como vai funcionar para você

1. Na aba de carga de emolumentos, o botão passa a ser "Buscar no portal do TJMG": um clique, sem exportar nada.
2. O sistema conversa com o painel público, baixa a tabela completa de serventias (nome, CNS, comarca, tipo de serviço, situação, emolumentos DAP, Recompe, TFJ, despesa) e joga direto no mesmo leitor que já valida a prefeitura ativa e a competência.
3. Se a busca automática falhar (portal fora do ar, painel alterado, bloqueio), a tela avisa em linguagem clara e mantém o envio manual do arquivo como alternativa.
4. Um campo em Configurações guarda o endereço/identificador do painel, para eu ou você atualizar caso o TJMG mude o painel, sem precisar mexer no programa.

## O que preciso de você

O endereço completo do painel de serventias como ele aparece na barra do navegador quando você abre a tabela de emolumentos (é a partir dele que extraio o identificador). Se preferir, posso tentar descobrir sozinho a partir do servidor publicado, que tem menos restrição de rede que o ambiente de testes.

## Detalhes técnicos

- Nova rota de servidor (não roda no navegador, evita bloqueio de origem cruzada) substituindo/estendendo `src/lib/cartorios/portal.functions.ts`:
  - `descobrirPainelTjmg`: lê a página `genot-portal-da-transparencia.htm` a partir do runtime publicado com cabeçalhos de navegador e extrai `appid`/`sheet` do iframe `single/`; resultado é armazenado em configuração.
  - `baixarServentiasTjmg`: abre sessão WebSocket com a Engine API do Qlik (`wss://qlik.tjmg.jus.br/app/<appid>`), executa `OpenDoc`, localiza o objeto de tabela por título, e pagina `GetHyperCubeData` em blocos (limite de 10 mil células por chamada) até o fim.
  - Retorno normalizado como matriz de linhas, convertida para `LinhaEmolumento[]` pelo mesmo mapeador do `parser.ts` (reaproveita normalização de colunas, valores em centavos e campo `municipio`).
- Workers suportam WebSocket de saída via `fetch` com `Upgrade: websocket`; o handler ficará em `src/routes/api/` para poder manipular a resposta bruta.
- Persistência: tabela `cartorio_config` já existe; adicionar chaves `tjmg_appid`, `tjmg_objectid`, `tjmg_atualizado_em`.
- A carga resultante entra pelo fluxo existente (`useImportarEmolumentos`), registrando origem `portal-tjmg` no histórico de cargas e passando pela conferência de prefeitura ativa.
- Fallback preservado: se a Engine recusar sessão anônima, a função devolve diagnóstico e a tela mantém o upload manual.
