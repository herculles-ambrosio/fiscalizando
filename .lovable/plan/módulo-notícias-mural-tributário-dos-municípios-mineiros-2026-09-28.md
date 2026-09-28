# Módulo Notícias — mural tributário dos municípios mineiros

## O que o usuário verá
- **Novo botão "Notícias"** ao lado de Apura VAF, ICMS e Cartório, visível para todos os usuários (consultoria e prefeituras).
- **Mural de notícias** em cartões: título, resumo curto, fonte, data, etiquetas de tema (VAF, ICMS, ITBI, ISS, IPTU, Nota Fiscal, Simples Nacional, Reforma Tributária, TCE-MG, Legislação) e botão **Abrir matéria** (link original em nova aba).
- **Filtros**: tema, fonte, período e busca por palavra. Destaque para notícias fixadas pela consultoria.
- **Quadro "Últimas notícias"** no Painel do Apura VAF com as 5 mais recentes e link "Ver todas".
- **Área da consultoria** no próprio módulo: publicar notícia à mão (título, resumo, link, tema), editar, fixar no topo, ocultar e gerenciar a lista de fontes. Botão **Buscar novidades agora**.

## Como as notícias chegam
- **Automático, uma vez por dia (de manhã cedo):** o sistema lê as fontes cadastradas (sugestão inicial: SEF-MG, FJP, AMM, Receita Federal, TCE-MG, Portal da Nota Fiscal/NFS-e Nacional, Agência Minas, Diário Oficial de MG), mantém só o que é de matéria tributária municipal, resume com IA em 2–3 frases e classifica o tema.
- Notícias repetidas (mesmo link) não entram duas vezes.
- **Manual:** a consultoria publica quando quiser; aparece com a marca "Publicado pela consultoria".

## Detalhes técnicos
- Tabelas: `noticias_fontes` (nome, url, tipo rss/página, ativa) e `noticias` (titulo, resumo, url única, fonte, publicada_em, temas[], origem auto/manual, fixada, oculta, criado_por). RLS: leitura para autenticados; escrita só consultoria/superadmin (via `has_role`/perfil existente). GRANTs conforme padrão.
- Coleta: server function `buscarNoticias` (lê RSS/HTML das fontes, filtra por palavras-chave e usa Lovable AI Gateway para resumo + classificação) e rota pública `/api/public/hooks/noticias-coleta` protegida por segredo, chamada diariamente por agendamento no banco (pg_cron), às 06h de Brasília.
- Rotas: `/noticias` (mural) com `head()` próprio; item de menu e aba de módulo em `AppLayout.tsx` (produto "noticias").
- Componentes: `MuralNoticias`, `CartaoNoticia`, `FormNoticia`, `FontesNoticias`, `UltimasNoticias` (Painel).
- Hook `useNoticias` com TanStack Query.
