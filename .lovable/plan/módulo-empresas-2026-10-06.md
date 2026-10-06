# Módulo "Empresas"

Novo módulo no menu lateral para importar e classificar as empresas da **Prefeitura Ativa** e fiscalizá-las conforme o tipo (Simples Nacional, MEI ou Outro).

## O que é possível com a consulta atual

| Informação | De onde vem |
|---|---|
| Razão social, nome fantasia, CNPJ | Receita (consulta atual) |
| Endereço completo, e-mail, telefone | Receita (consulta atual) |
| Atividade principal e secundárias (CNAE) | Receita (consulta atual) |
| Situação e data da situação | Receita (consulta atual) |
| Optante pelo Simples / MEI, com as datas | Receita (consulta atual) |
| Inscrição estadual | Cadastro da SEF já carregado (cruzado pelo CNPJ) |

A consulta não lista as empresas de um município; ela só responde por CNPJ. Por isso, a lista sai de duas origens.

## Etapa 1: empresas do cadastro da SEF
- Botão **Importar do cadastro da SEF**: pega os CNPJs dos contribuintes já apurados da prefeitura, consulta cada um na Receita (com barra de progresso e as mesmas fontes e reconsulta usadas hoje) e grava a empresa.
- A inscrição estadual vem do próprio cadastro.

## Etapa 2: base completa da Receita (inclui MEIs e prestadores de serviço)
- A Receita publica gratuitamente os arquivos "Estabelecimentos" (10 arquivos compactados, vários GB no total).
- Tela **Importar base da Receita**: você baixa os arquivos no site oficial e seleciona no sistema. O próprio navegador lê cada arquivo aos poucos e guarda **somente** as empresas do município ativo (pelo código do município na Receita). Nada de muitos GB é enviado ao servidor.
- Depois, as empresas encontradas são completadas pela consulta (Simples/MEI, e-mail etc.).
- Aviso: cada arquivo leva alguns minutos para ler, e o computador precisa ficar com a tela aberta durante a leitura. A base é atualizada mensalmente pela Receita; a data de referência fica registrada.

## Classificação e fiscalização
- Classificação automática: **MEI** (optante MEI) > **Simples Nacional** > **Outro**. Pode ser corrigida manualmente, com registro de quem alterou.
- Grade com filtros por tipo, situação, atividade, bairro, "tem IE / não tem IE", busca por nome/CNPJ; cartões com totais por tipo e situação.
- Destaques para a fiscalização: MEI com atividade não permitida para MEI, empresa ativa sem inscrição estadual mas com atividade de comércio/indústria, empresa baixada ou inapta ainda no cadastro da SEF.
- Painel de detalhe da empresa, botão de reconsultar e exportação CSV.

## Detalhes técnicos
- Tabela `empresas` (por `municipio_id` + `cnpj` único): dados cadastrais, endereço, email, telefone, CNAEs, situação/data, `opcao_simples`, `data_opcao_simples`, `opcao_mei`, `data_opcao_mei`, `tipo_auto`, `tipo_manual`, `inscricao_estadual`, `origem` (sef/base_receita), `referencia_base`, `consultado_em`. RLS por acesso ao município, como as demais tabelas.
- Ampliar `normalizarRetorno` para extrair Simples/MEI, e-mail, telefone, endereço e CNAEs secundários das três fontes; manter o cache `situacoes_receita` compatível.
- Server function protegida para enriquecimento em lotes (reaproveita `consultarLote` e a fila de reconsulta).
- Leitura dos ZIPs no navegador com descompactação em fluxo (Web Worker), filtrando a coluna de município (tabela de municípios da Receita para MG) e gravando em lotes.
- Rota `/_authenticated/empresas`, item no menu e regras registradas no AGENTS.md.

## Ordem de entrega
1. Tabela, consulta ampliada, importação pelo cadastro da SEF, grade e classificação.
2. Importação da base completa da Receita.
