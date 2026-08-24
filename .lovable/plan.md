# Papel timbrado H-Tech Minas em todos os relatórios

Padronizar as saídas de relatório do Apura VAF com o mesmo timbrado do arquivo TIMBRADO_HTEC: logo no topo, marca d'água clara ao fundo e a faixa laranja/cinza com endereço e contatos no pé. Os ofícios continuam exatamente como estão hoje.

## Como o timbrado será reproduzido

- **Cabeçalho**: logo H-Tech Minas (com "Consultoria Tributária / Desenvolvimento de Sistemas") centralizada no topo de cada página.
- **Marca d'água**: a mesma logo, ampliada e bem clara, centralizada atrás do conteúdo, sem prejudicar a leitura de tabelas e gráficos.
- **Rodapé**: faixa com bloco laranja à esquerda e barra cinza-escuro com o texto:
  - Rua Frederico Dolabela, 703 - Centro - Manhuaçu - MG
  - 33 98414 2223 | contato@htechminas.com.br | www.htechminas.com.br
  - Complemento discreto na mesma linha: "Apura VAF 2.0 — relatório gerado em {data}".

## Onde será aplicado

1. **Impressão / PDF das telas de relatório** (Painel, Índice do VAF, Evolução, Estatísticas, Contribuintes, Apurações Realizadas): timbrado repetido em todas as páginas impressas.
2. **Documento Word da Análise do VAF ("Por que variou") e do Plano de Recuperação**: cabeçalho, marca d'água e rodapé no padrão do timbrado, em todas as páginas.
3. **Ofícios (.docx e pacotes ZIP)**: sem alteração.

Também será removido o cabeçalho/rodapé simples adicionado na versão anterior, substituído por este padrão único.

## Detalhes técnicos

- Subir dois assets no CDN: a logo do timbrado e uma versão clara para marca d'água (gerada a partir da logo).
- Substituir `PrintHeader`/`PrintFooter` por um único componente `Timbrado` (cabeçalho + rodapé + marca d'água), montado uma vez em `AppLayout`.
- CSS de impressão em `src/styles.css`: usar `position: fixed` para cabeçalho, rodapé e marca d'água (`opacity` baixa, `z-index` negativo) com `@page` e margens adequadas para que se repitam em todas as páginas; ajustar `padding` do conteúdo para não colidir com as faixas.
- Criar `src/lib/reportTimbrado.ts` com helpers reutilizáveis do `docx`: `Header` com a logo centralizada, `Footer` com tabela de 2 colunas (célula laranja + célula cinza com o texto de contato) e marca d'água via `ImageRun` flutuante com `behindDocument: true` no cabeçalho.
- `src/lib/vaf/diagnosticoDocx.ts` passa a usar esses helpers (as imagens são buscadas por `fetch` do CDN antes de montar o documento). Ajustar as margens da seção para acomodar cabeçalho/rodapé.
- Nada em `src/lib/oficios/*` é alterado.
