# Empresas: comparação com o cadastro da prefeitura

## O que a planilha traz (economico_2026-10.xlsx)
- 1.038 linhas: 753 com CNPJ, 285 com CPF (autônomos). 37 CNPJs aparecem repetidos.
- Município: 1.013 em Caparaó e 25 em outras cidades.
- Regime Tributário (Tributação Normal, MEI, Microempresa Municipal, Autônomo etc.), Simples Nacional (Optante / Não optante) e Situação (Ativo, Baixado, Suspenso, Provisório NFS-e).

## Prévia do cruzamento (feita agora, com a base da Receita já importada)
| Item | Quantidade |
|---|---|
| CNPJs únicos na planilha da prefeitura | 716 |
| Empresas de Caparaó no nosso cadastro (Receita) | 822 (todas já completadas) |
| Nos dois cadastros | 503 |
| Só na prefeitura | 213 (137 baixadas, 69 ativas/provisórias; 14 com endereço em outra cidade) |
| Só na Receita, sem cadastro na prefeitura | 319, sendo **98 ativas**: o principal alvo de fiscalização |
| Simples: prefeitura "Optante" e Receita não optante | 121 |
| Simples: prefeitura "Não optante" e Receita optante | 42 |
| MEI na prefeitura e não MEI na Receita | 98 |
| MEI na Receita e não MEI na prefeitura | 14 |
| Ativa na prefeitura e baixada/inapta na Receita | 106 |
| Baixada na prefeitura e ativa na Receita | 3 |

Os 199 que estão "só na prefeitura" com endereço em Caparaó são, na maioria, empresas baixadas antes da data do filtro de importação ou de fora do município na Receita. A tela vai mostrar o motivo de cada caso.

## Sobre os municípios diferentes
A coluna Município é a cidade do endereço do contribuinte, e não a prefeitura que o cadastrou. Por isso a maioria dos 25 casos não é erro:
- **Empresas de fora que prestam serviço em Caparaó:** Claro, Copasa, provedores de internet, fundações de Muriaé e Alto Jequitibá, empresas de BH e Manhuaçu.
- **Prováveis erros de digitação**, porque o CEP é o de Caparaó (36834-000) mas a cidade está diferente:
  - Igreja Assembleia de Deus ("Centro Linha Brasil (Venâncio Aires)")
  - Murilo de Oliveira Garcia ("Manhumirim")
  - Oliveira Farma (zona rural)

**Regra proposta:**
- **Bloqueio:** a planilha só é aceita se o município mais frequente for a prefeitura ativa. Se não for, aparece a mensagem "Esta planilha não é da prefeitura ativa (X)".
- **Linhas de outro município:** são importadas e recebem um selo.
  - "Endereço em outro município"
  - "Provável erro de digitação", quando o CEP é o da prefeitura

## O que será construído
1. **Botão "Comparar com cadastro da prefeitura"** em Empresas. Ele recebe o Excel exportado do sistema da prefeitura, confere o município e grava a carga com o mês de referência.
2. **Resumo em cartões:**
   - Total no cadastro da prefeitura e total no nosso cadastro (Receita)
   - Empresas nos dois cadastros
   - Só na prefeitura
   - Só na Receita: empresas que existem no município e a prefeitura não cadastrou, o principal ganho para a fiscalização
   - CPFs/autônomos (ficam fora do cruzamento por CNPJ)
   - CNPJs repetidos na planilha
3. **Divergências por CNPJ:**
   - **Simples:** a prefeitura diz "Optante" e a Receita diz não optante, ou o contrário.
   - **MEI:** "Micro Empreendedor Individual" na prefeitura × MEI na Receita.
   - **Situação:** ativa na prefeitura e baixada/inapta na Receita (ou o contrário).
   - **Nome/endereço:** razão social ou endereço muito diferente (só informativo).
4. **Grade de comparação** com filtros por tipo de divergência, as colunas "Prefeitura" e "Receita" lado a lado, totalizador e exportação em CSV.
5. **Na grade principal de Empresas:** um selo "Não cadastrada na prefeitura" e um filtro com o mesmo nome.

## Detalhes técnicos
- Nova tabela `empresas_prefeitura`: `municipio_id`, `carga_ref`, documento, tipo do documento, inscrição municipal, nome, regime, `simples_optante`, situação, município, CEP, endereço, `alerta_municipio` e `criado_em`. Regras de acesso iguais às de `empresas` (por município). A gravação substitui a carga do mesmo município.
- Leitura do xlsx no navegador (SheetJS), com os cabeçalhos mapeados por nome: N. Documento, Regime Tributário, Simples Nacional, Situação, Município, CEP.
- Comparação feita no navegador entre `empresas` e `empresas_prefeitura`, pelo CNPJ só com dígitos. A situação é traduzida assim: Ativo/Ativo-Vigente/Provisório = ativa; Baixado = baixada; Suspenso = suspensa.
- Teste de unidade para a regra de município e a tradução de regime/Simples/situação.
