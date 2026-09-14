# Apura VAF: média dos índices, impacto por contribuinte, prefeituras e resolução

## 1. Card "Média dos Índices"

Na aba Evolução do VAF, ao lado dos cards de índice, entra um card novo com a média simples entre o índice do arquivo base e o do arquivo comparado. O título acompanha os anos dos arquivos (ex.: "Média dos Índices 2024/2025") e o texto de ajuda explica que é esse valor que a SEF aplica no repasse do exercício seguinte. Quando um dos lados ainda não tem índice, o card mostra traço e avisa que faltam os dois arquivos.

## 2. Aba "Impacto por contribuinte"

Nova aba logo após "Variação por contribuinte", com uma linha por contribuinte mostrando:

- VAF do arquivo comparado/estimado
- percentual que ele representa do VAF total do município no arquivo comparado
- percentual acumulado (ordenado do maior para o menor), para enxergar quem concentra a receita
- impacto em pontos de índice (participação do contribuinte aplicada ao índice do município)
- variação em relação ao arquivo base

Ordenada por participação, com busca, paginação e exportação em CSV, no mesmo padrão das outras abas.

## 3. Menu Prefeituras: dados da prefeitura e marcação de cliente

Na carteira de prefeituras:

- Cada linha ganha a coluna "Cliente" e um botão "Editar" que abre um painel com os mesmos dados hoje em Configurações (identificação, endereço/data, assinatura e brasão), agora editáveis direto dali, para qualquer prefeitura da carteira.
- No mesmo painel, um seletor "É cliente" / "Não é cliente".
- Todas as prefeituras que já possuem apuração cadastrada são marcadas como clientes de uma vez na migração.
- A tela Configurações continua funcionando como hoje para a prefeitura ativa.

## 4. Importação dos índices da Resolução SEF

Tela de importação disponível na área de consultoria:

- Opção A: informar o endereço da resolução (já validado com a Resolução SEF nº 6.069/2026) e o sistema lê o Anexo Único sozinho.
- Opção B: colar o conteúdo da tabela, caso o site esteja fora do ar ou mude de formato.

O sistema lê as colunas Cód. Mun., Nome do Município, VAF Individual 2024, Índice 2024, VAF Individual 2025, Índice 2025 e Média dos Índices 2024/2025, casa cada linha com os municípios cadastrados pelo nome e mostra, antes de gravar, quantos foram reconhecidos e quais não foram.

Ao cadastrar uma prefeitura como "Não é cliente", aparece a opção de usar os índices da resolução. Nas Estatísticas, essas prefeituras passam a entrar no panorama com os índices da resolução (identificados como "Resolução SEF"), enquanto as clientes continuam exclusivamente com as apurações feitas no sistema.

## Detalhes técnicos

- **Banco**: `municipios` ganha `cliente boolean not null default false` e `fonte_indice text not null default 'apuracao'` (`apuracao` | `resolucao`); migração marca `cliente = true` para municípios com registro em `indices_apurados` ou `cargas`. Nova tabela `indices_resolucao` (municipio_id nullable, codigo_mun, municipio_nome, resolucao, exercicio_aplicacao, ano_a, vaf_a, indice_a, ano_b, vaf_b, indice_b, media_indices, fonte_url, criado_em) com GRANTs, RLS e política de leitura para autenticados e escrita para consultoria; índice único por (resolucao, codigo_mun).
- **Parser**: `src/lib/vaf/resolucao.ts` puro (recebe HTML ou texto colado, devolve linhas normalizadas, com decimal pt-BR e normalização de nome reusando `municipiosSef.ts`), com teste unitário sobre um trecho do anexo.
- **Busca da página**: `createServerFn` em `src/lib/vaf/resolucao.functions.ts` com `requireSupabaseAuth`, valida o domínio `fazenda.mg.gov.br` via Zod, baixa a página (latin-1) e devolve as linhas já parseadas; a gravação acontece no cliente via Supabase.
- **Evolução**: card novo em `EvolucaoView.tsx` usando os índices já calculados; nova função pura `impactoPorContribuinte(base, atual)` em `src/lib/vaf/evolucao.ts` + componente de tabela na nova aba, com CSV próprio.
- **Prefeituras**: painel de edição reaproveita `useConfiguracao`/`useSalvarConfiguracao` parametrizados por `municipioId` (hoje fixos no município ativo) e um upsert em `configuracoes_municipio`.
- **Panorama**: `usePanoramaMunicipios` passa a carregar `indices_resolucao`; `montarPanorama` usa esses índices quando o município não é cliente e a fonte é `resolucao`, marcando a origem na linha.
