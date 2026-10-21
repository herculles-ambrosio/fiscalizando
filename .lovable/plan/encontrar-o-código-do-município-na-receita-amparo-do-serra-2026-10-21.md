# Encontrar o código do município na Receita (Amparo do Serra)

## Diagnóstico (confirmado no código)
Ao ler a "Tabela de municípios", o sistema só aceita nome **exatamente igual** ao da prefeitura (ignora só acentos e maiúsculas). Como a Receita grava "AMPARO DA SERRA" e o cadastro tem "Amparo do Serra", a comparação falha e aparece "Município não encontrado". O mesmo acontece com qualquer cidade cuja grafia difere em do/da/de, "D'", hífens, etc.

## O que vai mudar

1. **Busca pelo nome mais tolerante** (Tabela de municípios)
   - Ignora conectivos (de, da, do, das, dos, d'), hífens, apóstrofos e espaços extras.
   - Se ainda não achar, aceita a grafia mais parecida (diferença de 1–2 letras), mostrando "Código provável: 0000 – AMPARO DA SERRA. Confira." em vez de preencher sem aviso.
   - Homônimos continuam listados para escolha.

2. **Descobrir o código pelo CNPJ** (novo botão "Descobrir pelo CNPJ")
   - Usa CNPJs já conhecidos da prefeitura ativa: o cadastro econômico importado em "Comparar com cadastro da prefeitura" ou empresas já gravadas.
   - Consulta alguns desses CNPJs nas fontes públicas de CNPJ e lê o código do município da Receita que vem na resposta; adota o código mais frequente entre os de MG e mostra quantos CNPJs confirmaram.
   - Se não houver CNPJ cadastrado, permite digitar um CNPJ conhecido de uma empresa da cidade.

3. **Conferência automática na importação** (rede de segurança)
   - Se os arquivos de Estabelecimentos forem lidos sem código, ou se o código informado não trouxer nenhuma empresa, o sistema procura nos arquivos os CNPJs da prefeitura e sugere o código em que eles aparecem.

O código continua editável manualmente.

## Detalhes técnicos
- `src/lib/empresas/baseReceita.ts`: nova função `acharCodigoMunicipio(mapa, nome)` com normalização (remove stopwords/pontuação) + distância de Levenshtein ≤ 2; testes em `baseReceita.test.ts` incluindo "Amparo do Serra" × "AMPARO DA SERRA".
- `EmpresasView.tsx` (`lerMunicipios`): usa a nova função e exibe se o resultado é exato ou provável.
- Descoberta por CNPJ: lê até ~5 CNPJs de `empresas_prefeitura`/`empresas` do município, consulta via o serviço de CNPJ já usado em "Completar na Receita" e lê `codigo_municipio`; se a fonte não trouxer o campo, cai para varredura dos arquivos de Estabelecimentos (coluna 21) contando os CNPJs encontrados.
- Nada muda no banco de dados.
