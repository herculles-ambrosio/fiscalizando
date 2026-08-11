# Ofícios de retificação — contribuintes zerados

Geração dos pedidos de retificação em Word a partir do modelo enviado, com cabeçalho e dados da prefeitura configuráveis.

## 1. Configurações do município

Nova tela **Configurações** (menu lateral), onde cada prefeitura cadastra o que aparece no ofício:

- Nome da prefeitura, estado, secretaria e setor (linhas do cabeçalho)
- Brasão (upload de imagem)
- Endereço do rodapé
- Cidade/UF usada na data do ofício
- Nome e cargo do signatário
- Texto de assinatura ("Secretaria Municipal da Fazenda")

Os dados ficam salvos por município, com acesso restrito aos usuários daquela prefeitura. Somente o perfil administrador pode editar.

## 2. Geração dos ofícios

Na tela de contribuintes apurados:

- Botão **Gerar ofícios de zerados**, habilitado quando o filtro tem contribuintes zerados
- Seleção por caixa de marcação (individual ou "selecionar todos os zerados da apuração")
- Campo de data do ofício (padrão: data de hoje, por extenso, como no modelo)
- O sistema monta um arquivo .docx por empresa e entrega tudo em um **ZIP**, nomeado por CNPJ + nome da empresa
- Barra de progresso durante a geração, feita no próprio navegador

## 3. Conteúdo do documento

Reprodução fiel do modelo enviado, com campos preenchidos por contribuinte:

- Cabeçalho com brasão e as quatro linhas institucionais
- Título: "PEDIDO DE RETIFICAÇÃO EMPRESAS COM DECLARAÇÃO ZERADAS VAF {exercício}"
- Cidade/UF e data por extenso
- Contribuinte, CNPJ (formatado), Inscrição Estadual e Endereço
- Texto integral sobre VAF, Resolução 4.306/2011 (art. 21), pedido de retificação da DAMEF/VAF-PGDAS/DEFIS, multa do art. 215 do RICMS e fechamento
- O exercício (2024 no modelo) e o ano do repasse são substituídos automaticamente pelos da apuração
- Assinatura, campo "Recebi ___/___/___" e endereço no rodapé

## Detalhes técnicos

- Migração: tabela `configuracoes_municipio` (um registro por município, RLS por `meu_municipio_id()`, escrita restrita ao papel administrador) e bucket privado `brasoes` com políticas por pasta do município.
- Geração com a biblioteca `docx` + `jszip` no cliente; o brasão é lido por URL assinada e embutido como imagem.
- Montagem do documento isolada em `src/lib/oficios/zerados.ts`, recebendo o contribuinte e as configurações — assim os próximos modelos (omissos, fora do prazo, discrepantes) reaproveitam a mesma estrutura.
- Formatação de CNPJ, data por extenso em português e nomes de arquivo sem acentos ficam em utilitários compartilhados.

## Fora deste escopo

Modelos para omissos, fora do prazo e discrepantes — entram quando você enviar os respectivos textos.
