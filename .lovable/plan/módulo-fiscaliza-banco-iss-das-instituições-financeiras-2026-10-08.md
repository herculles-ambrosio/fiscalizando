# Módulo "Fiscaliza Banco" (ISS das instituições financeiras)

Novo botão **Bancos** na barra de módulos (ao lado de Cartório e Empresas), trabalhando sempre com a Prefeitura Ativa. Ele confronta o que o banco declara com o que ele informa ao Banco Central.

```text
Declaração do banco (DES-IF / planilha / valor)  ──┐
ESTBAN (BC, mensal, por município)               ──┼──> Conferência ──> Indícios ──> Notificação
IF.data (BC, trimestral, cooperativas)           ──┘
```

## Menus

1. **Instituições**: cadastro das agências e cooperativas do município (nome, CNPJ, código no BC, tipo: banco ou cooperativa). Pode ser preenchido automaticamente pelo ESTBAN.
2. **Declarações**: importação flexível, porque ainda não sabemos o formato que a prefeitura recebe:
   - **arquivo DES-IF** (padrão ABRASF): lê o balancete analítico, as contas COSIF, o valor declarado, o item da LC 116 e se a conta foi marcada como tributável;
   - **planilha Excel/CSV** com colunas de conta, mês e valor, usando um mapeamento simples de colunas;
   - **lançamento manual** de base e ISS por mês, quando só existe o valor total.
3. **Plano de contas e alíquotas**: tabela de contas COSIF ligadas ao item da LC 116 e à alíquota (de 3% a 5%), editável por prefeitura. Já vem preenchida com o grupo 7.1.7 (rendas de prestação de serviços) e as contas de tarifas mais comuns.
4. **Conferência**: uma tela com três quadros e semáforo por banco e mês:
   - **Contas COSIF**: contas de rendas de serviços (7.1.7 e afins) declaradas como não tributáveis ou com alíquota errada, mostrando o ISS que deixou de entrar;
   - **ESTBAN**: evolução mensal das receitas das agências do município (verbete 710) comparada com a base declarada. Um alerta aparece quando a receita sobe e o ISS fica parado ou cai;
   - **Cooperativas (IF.data)**: rendas de tarifas e serviços de Sicoob, Sicredi etc. comparadas com o declarado. Quando a cooperativa atua em vários municípios, o valor é rateado pela participação do município.
   - Totais, gráfico e exportação em CSV e PDF. Os textos sempre deixam claro que se trata de **indício para fiscalizar, não prova**.
5. **Notificações**: mesmo padrão dos Ofícios e de Empresas. Modelos editáveis (cabeçalho, rodapé, margens e variáveis como `{{banco}}`, `{{cnpj}}`, `{{competencia}}`, `{{contas}}`, `{{iss_diferenca}}`), prévia, emissão em Word ou .zip e histórico. Três modelos de partida:
   - pedido de apresentação da DES-IF completa (balancete, plano de contas comentado e demonstrativo por subtítulo COSIF);
   - notificação de contas tributáveis classificadas como não tributáveis;
   - pedido de esclarecimento sobre divergência com os dados do Banco Central.

## Pontos a confirmar durante a construção

- **ESTBAN**: o Banco Central publica um arquivo mensal por município. Vou verificar se o dado por agência continua disponível depois da descontinuação do documento 4510. Se só houver o total por município, a comparação será feita por município e banco.
- **IF.data**: consulta pela API pública do Banco Central. Se ela não responder do servidor, haverá a opção de importar o arquivo baixado.
- Os textos dos modelos e a tabela de alíquotas serão rascunhos para você revisar com a legislação de cada município.

## Detalhes técnicos

- Tabelas por município com GRANTs e RLS no padrão do Cartório:
  - `bancos_instituicoes`
  - `bancos_contas_cosif` (conta, item LC 116, alíquota, tributável)
  - `bancos_declaracoes` (instituição, competência, conta, valor, tributável declarado, origem)
  - `bancos_estban` (competência, CNPJ/instituição, verbete, valor)
  - `bancos_ifdata` (trimestre, instituição, rendas de serviços e tarifas)
  - `bancos_modelos`
  - `bancos_notificacoes`
- Server functions (`createServerFn` + `requireSupabaseAuth`) para baixar e ler o ZIP do ESTBAN e consultar a API OData do IF.data, compatíveis com o Worker (fetch e unzip com `fflate`/JSZip, sem Node).
- Parsers puros em `src/lib/bancos/` (DES-IF, planilha, ESTBAN, IF.data) e regras de conferência em `conferencia.ts`, com testes cobrindo: conta 7.1.7 marcada como não tributável gera indício; aplicação da alíquota por item; cálculo do rateio.
- Gerador de documentos reaproveitando `src/lib/oficios/documento.ts`, como em Empresas.
- Rotas em `src/routes/_authenticated/bancos*.tsx` e grupo `NAV_BANCOS` em `AppLayout.tsx`.
