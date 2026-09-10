/**
 * Petição de impugnação do índice provisório do VAF, em DOCX,
 * no mesmo timbrado dos demais relatórios do Apura VAF 2.0.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  MARGENS_TIMBRADO,
  cabecalhoTimbrado,
  carregarImagensTimbrado,
  rodapeTimbrado,
  type ImagensTimbrado,
} from "@/lib/reportTimbrado";
import {
  diferencaItem,
  moedaBr,
  totalContestado,
  type DadosImpugnacao,
} from "./impugnacao";

const FONTE = "Arial";
const LARGURA = 9026;
const BORDA = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
const MARGENS = { top: 60, bottom: 60, left: 100, right: 100 };

export type ContextoImpugnacao = {
  municipio: string | null;
  prefeitura: string | null;
  cidadeData: string | null;
  signatarioNome: string | null;
  signatarioCargo: string | null;
  /** CNPJ da prefeitura, citado na qualificação da peça */
  cnpj?: string | null;
  /** consultor responsável pelo acompanhamento do VAF (assinatura adicional) */
  consultorNome?: string | null;
  consultorCargo?: string | null;
};

function texto(t: string, o: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: t, font: FONTE, size: o.size ?? 20, bold: o.bold ?? false });
}

function paragrafo(
  t: string,
  o: { bold?: boolean; size?: number; after?: number; centro?: boolean; justificado?: boolean } = {},
) {
  return new Paragraph({
    spacing: { after: o.after ?? 120 },
    alignment: o.centro
      ? AlignmentType.CENTER
      : o.justificado
        ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT,
    children: [texto(t, { bold: o.bold ?? false, size: o.size ?? 20 })],
  });
}

function celula(
  t: string,
  largura: number,
  o: { bold?: boolean; fill?: string; direita?: boolean } = {},
) {
  return new TableCell({
    borders: BORDAS,
    margins: MARGENS,
    width: { size: largura, type: WidthType.DXA },
    ...(o.fill ? { shading: { fill: o.fill, type: ShadingType.CLEAR } } : {}),
    children: [
      new Paragraph({
        alignment: o.direita ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [texto(t, { bold: o.bold ?? false, size: 16 })],
      }),
    ],
  });
}

function tabelaItens(dados: DadosImpugnacao): Table {
  const cols = [500, 1300, 2626, 2200, 1200, 1200];
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: cols,
    rows: [
      new TableRow({
        children: [
          celula("Nº", cols[0]!, { bold: true, fill: "EEF2F0" }),
          celula("IE", cols[1]!, { bold: true, fill: "EEF2F0" }),
          celula("Contribuinte", cols[2]!, { bold: true, fill: "EEF2F0" }),
          celula("Motivo", cols[3]!, { bold: true, fill: "EEF2F0" }),
          celula("VAF apurado", cols[4]!, { bold: true, fill: "EEF2F0", direita: true }),
          celula("A recompor", cols[5]!, { bold: true, fill: "EEF2F0", direita: true }),
        ],
      }),
      ...dados.itens.map(
        (i, n) =>
          new TableRow({
            children: [
              celula(String(n + 1), cols[0]!),
              celula(i.ie, cols[1]!),
              celula(i.nome ?? "(sem nome)", cols[2]!),
              celula(i.motivo, cols[3]!),
              celula(moedaBr(i.vafApurado), cols[4]!, { direita: true }),
              celula(moedaBr(diferencaItem(i)), cols[5]!, { direita: true }),
            ],
          }),
      ),
      new TableRow({
        children: [
          celula("", cols[0]!, { fill: "F6F7F6" }),
          celula("", cols[1]!, { fill: "F6F7F6" }),
          celula("", cols[2]!, { fill: "F6F7F6" }),
          celula("Total", cols[3]!, { bold: true, fill: "F6F7F6", direita: true }),
          celula("", cols[4]!, { fill: "F6F7F6" }),
          celula(moedaBr(totalContestado(dados.itens)), cols[5]!, {
            bold: true,
            fill: "F6F7F6",
            direita: true,
          }),
        ],
      }),
    ],
  });
}

export function construirDocImpugnacao(
  dados: DadosImpugnacao,
  ctx: ContextoImpugnacao,
  imagens?: ImagensTimbrado,
): Document {
  const timbrado: ImagensTimbrado = imagens ?? { marca: null, marcaDagua: null };
  const total = totalContestado(dados.itens);
  const anoBase = dados.anoBase ?? dados.exercicio - 2;
  const resolucao = dados.resolucao.trim() || "resolução que fixou os índices provisórios";

  const municipioNome = ctx.municipio ?? "do Município";
  const municipioCaixa = (ctx.municipio ?? "MUNICÍPIO").toUpperCase();
  const publicacao = dados.resolucaoData ? `, publicada em ${dados.resolucaoData},` : "";

  const filhos: Array<Paragraph | Table> = [
    paragrafo("À SECRETARIA DE ESTADO DE FAZENDA DE MINAS GERAIS – SEF/MG", { bold: true, after: 20 }),
    paragrafo("SUPERINTENDÊNCIA DE ARRECADAÇÃO E INFORMAÇÕES FISCAIS – SAIF", { bold: true, after: 20 }),
    paragrafo("DIVISÃO DE VALOR ADICIONADO FISCAL – DVAF", { bold: true, after: 240 }),
    paragrafo(
      `ASSUNTO: Impugnação dos Valores Adicionados Fiscais – VAF e dos Índices Provisórios de Participação dos Municípios na Receita do ICMS – Exercício ${dados.exercicio} – Ano-base ${anoBase}`,
      { bold: true, justificado: true, after: 80 },
    ),
    paragrafo(`MUNICÍPIO: ${municipioCaixa}/MG`, { bold: true, after: 240 }),
    paragrafo(
      `O MUNICÍPIO DE ${municipioCaixa}, ESTADO DE MINAS GERAIS, pessoa jurídica de direito público interno, inscrito no CNPJ sob o nº ${
        ctx.cnpj ?? "[INFORMAR]"
      }, neste ato representado por seu representante legal, vem, respeitosamente, perante a Secretaria de Estado de Fazenda de Minas Gerais – SEF/MG, com fundamento no art. 3º, § 7º, da Lei Complementar federal nº 63, de 11 de janeiro de 1990, na Lei estadual nº 18.030, de 12 de janeiro de 2009, e no art. 2º da ${resolucao}${publicacao} apresentar a presente`,
      { justificado: true, after: 160 },
    ),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [texto("IMPUGNAÇÃO DOS VALORES E ÍNDICES PROVISÓRIOS DO VAF", { bold: true, size: 26 })],
    }),
    paragrafo(`ANO-BASE ${anoBase} – EXERCÍCIO ${dados.exercicio}`, { centro: true, bold: true, after: 200 }),
    paragrafo("pelos fatos e fundamentos a seguir expostos.", { justificado: true, after: 240 }),

    paragrafo("I – DA TEMPESTIVIDADE", { bold: true, size: 24 }),
    paragrafo(
      `A ${resolucao}${publicacao} divulgou os Valores Adicionados Fiscais – VAF e os respectivos índices provisórios dos municípios mineiros na parcela do ICMS que lhes será destinada no exercício de ${dados.exercicio}.`,
      { justificado: true },
    ),
    paragrafo(
      "Nos termos do art. 2º da referida Resolução, foi assegurado aos Municípios e às associações de Municípios o prazo de até 30 (trinta) dias, contado da publicação, para impugnação dos valores e índices apurados. Dessa forma, a presente impugnação é apresentada tempestivamente.",
      { justificado: true, after: 200 },
    ),

    paragrafo("II – DO OBJETO DA IMPUGNAÇÃO", { bold: true, size: 24 }),
    paragrafo(
      `A presente impugnação tem por objeto os valores do VAF atribuídos ao Município ${municipioNome}/MG, relativos ao ano-base ${anoBase}, e o consequente índice provisório de participação na receita do ICMS para o exercício de ${dados.exercicio}${
        dados.indicePublicado != null
          ? `, publicado no percentual de ${dados.indicePublicado.toLocaleString("pt-BR", { minimumFractionDigits: 7 })}%`
          : ""
      }.`,
      { justificado: true },
    ),
    paragrafo(
      "Após a divulgação dos valores provisórios, o Município realizou procedimento interno de conferência e auditoria das informações que compõem seu movimento econômico, especialmente quanto às declarações e informações prestadas pelos contribuintes estabelecidos em seu território.",
      { justificado: true },
    ),
    paragrafo(
      `Nessa análise foram identificados ${dados.itens.length} contribuinte(s) com valor adicionado zerado, omisso, ausente ou com indícios de inconsistência nas informações utilizadas na apuração do movimento econômico municipal, relacionados individualmente no quadro do item IV desta peça e na planilha anexa.`,
      { justificado: true },
    ),
    paragrafo(
      "Tais ocorrências possuem potencial para ocasionar redução do VAF atribuído ao Município e, consequentemente, repercutir negativamente no índice de participação na distribuição constitucional da receita do ICMS. Por essa razão, o Município apresenta a presente impugnação para que as divergências identificadas sejam consideradas na apuração definitiva do VAF.",
      { justificado: true, after: 200 },
    ),

    paragrafo("III – DAS DIVERGÊNCIAS IDENTIFICADAS", { bold: true, size: 24 }),
    paragrafo(
      `A Administração Municipal realizou levantamento individualizado dos contribuintes estabelecidos no Município ${municipioNome}/MG, confrontando as informações disponíveis para o ano-base ${anoBase} com os dados relacionados ao movimento econômico de cada estabelecimento. Foram identificados contribuintes enquadrados, dentre outras, nas seguintes situações:`,
      { justificado: true },
    ),
    paragrafo(
      `a) contribuintes que constam com VAF zerado no ano-base ${anoBase};`,
      { justificado: true, after: 40 },
    ),
    paragrafo(
      "b) contribuintes que apresentam omissão ou ausência de informações necessárias à adequada apuração do VAF;",
      { justificado: true, after: 40 },
    ),
    paragrafo(
      "c) contribuintes cujos valores declarados apresentam indícios de incompatibilidade com o movimento econômico observado ou com as informações de períodos anteriores;",
      { justificado: true, after: 40 },
    ),
    paragrafo(
      "d) contribuintes cujas declarações demandam conferência, validação, revalidação ou eventual retificação para que os respectivos valores sejam corretamente considerados na apuração do VAF municipal;",
      { justificado: true, after: 40 },
    ),
    paragrafo(
      `e) outras divergências relacionadas às informações econômico-fiscais do ano-base ${anoBase} que possam repercutir na correta atribuição do Valor Adicionado Fiscal ao Município.`,
      { justificado: true },
    ),
    paragrafo(
      "Considerando que o § 1º do art. 2º da Resolução determina que a matéria relacionada à divergência seja apresentada na impugnação, o Município registra, por meio deste recurso, a divergência relativa às declarações omissas, zeradas, inconsistentes ou passíveis de validação/revalidação dos contribuintes estabelecidos em seu território.",
      { justificado: true, after: 200 },
    ),

    paragrafo("IV – DO QUADRO DE CONTRIBUINTES CONTESTADOS", { bold: true, size: 24 }),
    paragrafo(
      "Cada contribuinte é identificado pela inscrição estadual e pelo CNPJ, com indicação precisa da divergência verificada e do valor adicionado que se pretende recompor. As operações correspondentes foram praticadas no território deste Município e devem compor o seu valor adicionado.",
      { justificado: true, after: 120 },
    ),
    tabelaItens(dados),
    paragrafo("", { after: 120 }),
    paragrafo(`Valor adicionado total a recompor: ${moedaBr(total)}.`, { bold: true, after: 200 }),

    paragrafo("V – DAS PROVIDÊNCIAS ADOTADAS PELO MUNICÍPIO", { bold: true, size: 24 }),
    paragrafo(
      "Identificadas e conferidas as situações acima, o Município vem adotando as providências administrativas cabíveis junto aos respectivos contribuintes, inclusive mediante expedição de comunicações e ofícios, para que promovam a conferência e, sendo o caso, a regularização, validação ou revalidação das informações perante a Secretaria de Estado de Fazenda de Minas Gerais.",
      { justificado: true },
    ),
    paragrafo(
      "Eventuais contribuintes ainda não notificados individualmente na data desta peça não afastam a divergência já identificada quanto à existência de declarações zeradas, omissas ou aparentemente inconsistentes, nem o interesse municipal na correta apuração de seu movimento econômico.",
      { justificado: true, after: 200 },
    ),

    paragrafo("VI – DA VALIDAÇÃO E DA REVALIDAÇÃO DAS DECLARAÇÕES", { bold: true, size: 24 }),
    paragrafo(
      "A própria Resolução estabelece, em seu art. 4º, marco temporal específico para a validação ou revalidação das declarações pelos contribuintes por meio do Sistema Integrado de Administração da Receita Estadual – SIARE, não sendo incluídas na apuração do VAF as declarações validadas ou revalidadas após aquela data.",
      { justificado: true },
    ),
    paragrafo(
      "Permanece em curso, portanto, após a publicação dos índices provisórios, período destinado à validação ou revalidação de declarações que poderão repercutir na apuração do VAF. É nesse período que o Município intensifica os procedimentos de conferência dos contribuintes relacionados, para posterior comunicação aos estabelecimentos envolvidos e adoção das providências cabíveis dentro do prazo regulamentar.",
      { justificado: true },
    ),
    paragrafo(
      "Requer-se, assim, que na análise desta impugnação e na formação dos valores definitivos sejam consideradas as regularizações decorrentes de declarações validamente apresentadas, validadas ou revalidadas dentro do prazo estabelecido na Resolução.",
      { justificado: true, after: 200 },
    ),

    paragrafo("VII – DA PRESERVAÇÃO DO CORRETO MOVIMENTO ECONÔMICO MUNICIPAL", { bold: true, size: 24 }),
    paragrafo(
      "O VAF constitui elemento de relevante impacto na participação municipal na arrecadação do ICMS, devendo sua apuração refletir, com a maior exatidão possível, o movimento econômico efetivamente ocorrido no território municipal no período de referência.",
      { justificado: true },
    ),
    paragrafo(
      "A existência de estabelecimentos economicamente ativos com declarações zeradas, omissões ou informações inconsistentes exige análise específica, pois a ausência de valores que deveriam integrar a apuração provoca redução indevida do VAF municipal. A presente impugnação visa preservar o direito do Município de ver corretamente computados os valores efetivamente apurados e regularmente validados ou revalidados dentro do prazo regulamentar.",
      { justificado: true, after: 200 },
    ),

    paragrafo("VIII – DA DOCUMENTAÇÃO E DA RELAÇÃO DE CONTRIBUINTES", { bold: true, size: 24 }),
    paragrafo(
      `Para subsidiar a análise, o Município apresenta planilha contendo a relação dos ${dados.itens.length} contribuinte(s) identificado(s) com VAF zerado, omisso ou com indícios de divergência, indicando as respectivas situações encontradas, os valores apurados e os valores que se pretende recompor.`,
      { justificado: true, after: 200 },
    ),
  ];

  if (dados.observacao.trim()) {
    filhos.push(paragrafo("IX – DAS CONSIDERAÇÕES COMPLEMENTARES", { bold: true, size: 24 }));
    filhos.push(paragrafo(dados.observacao.trim(), { justificado: true, after: 200 }));
  }

  filhos.push(paragrafo("DOS PEDIDOS", { bold: true, size: 24 }));
  filhos.push(
    paragrafo("Diante de todo o exposto, o Município requer:", { justificado: true, after: 80 }),
  );
  const pedidos = [
    "a) o recebimento e o processamento da presente impugnação, por ser tempestiva e apresentada nos termos do art. 2º da Resolução;",
    `b) que sejam analisadas as divergências apontadas relativamente aos contribuintes com declarações zeradas, omissas, inconsistentes ou passíveis de validação/revalidação referentes ao ano-base ${anoBase};`,
    "c) que sejam consideradas, para formação do VAF definitivo, as declarações e informações regularmente validadas ou revalidadas pelos contribuintes dentro do prazo do art. 4º da Resolução;",
    "d) que sejam considerados os contribuintes e as situações individualizados no quadro desta peça e nas planilhas que a instruem;",
    `e) que, constatada a existência de valores não computados ou computados incorretamente, sejam efetuados os ajustes cabíveis no VAF do Município, no montante de ${moedaBr(total)};`,
    `f) que, em consequência das correções reconhecidas, seja realizado o recálculo do Valor Adicionado Fiscal e do índice de participação do Município na receita do ICMS para o exercício de ${dados.exercicio};`,
    "g) que todas as informações e documentos apresentados sejam considerados na análise e no julgamento desta impugnação, de modo a assegurar que o índice definitivo reflita corretamente o movimento econômico do Município.",
  ];
  for (const p of pedidos) filhos.push(paragrafo(p, { justificado: true, after: 60 }));

  filhos.push(paragrafo("Nestes termos, pede deferimento.", { after: 300 }));
  filhos.push(paragrafo(ctx.cidadeData ?? "", { centro: true, after: 400 }));
  filhos.push(paragrafo("__________________________________________", { centro: true, after: 40 }));
  filhos.push(paragrafo(ctx.signatarioNome ?? "", { centro: true, bold: true, after: 20 }));
  filhos.push(paragrafo(ctx.signatarioCargo ?? "", { centro: true, after: 40 }));
  filhos.push(paragrafo(ctx.prefeitura ?? "", { centro: true, after: 300 }));
  if (ctx.consultorNome?.trim()) {
    filhos.push(paragrafo("__________________________________________", { centro: true, after: 40 }));
    filhos.push(paragrafo(ctx.consultorNome, { centro: true, bold: true, after: 20 }));
    filhos.push(
      paragrafo(ctx.consultorCargo?.trim() || "Consultor Tributário", { centro: true, after: 20 }),
    );
    filhos.push(
      paragrafo("Responsável pelo acompanhamento e análise do VAF", { centro: true, after: 300 }),
    );
  }
  filhos.push(paragrafo("DOCUMENTOS ANEXOS", { bold: true, size: 24 }));
  filhos.push(
    paragrafo(
      `Anexo I – Planilha de contribuintes com VAF zerado, omisso ou com indícios de divergência – ano-base ${anoBase} (arquivo .xlsx);`,
      { justificado: true, after: 40 },
    ),
  );
  filhos.push(
    paragrafo(
      `Anexo II – Demonstrativo do levantamento e da metodologia utilizada na apuração das divergências – ano-base ${anoBase} (arquivo .docx);`,
      { justificado: true, after: 40 },
    ),
  );
  filhos.push(
    paragrafo(
      `Anexo III – Fichas individuais dos ${dados.itens.length} contribuinte(s) contestado(s), com a divergência apontada, os valores envolvidos e espaço para juntada dos documentos comprobatórios (arquivo .docx).`,
      { justificado: true, after: 120 },
    ),
  );


  return new Document({
    styles: { default: { document: { run: { font: FONTE, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: MARGENS_TIMBRADO } },
        headers: { default: cabecalhoTimbrado(timbrado) },
        footers: {
          default: rodapeTimbrado(
            `Apura VAF 2.0 — impugnação gerada em ${new Date().toLocaleDateString("pt-BR")}`,
          ),
        },
        children: filhos,
      },
    ],
  });
}

export async function gerarDocxImpugnacao(
  dados: DadosImpugnacao,
  ctx: ContextoImpugnacao,
): Promise<Blob> {
  const imagens = await carregarImagensTimbrado();
  return Packer.toBlob(construirDocImpugnacao(dados, ctx, imagens));
}
