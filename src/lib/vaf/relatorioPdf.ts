import { sufixoReceita, type MapaReceitaPorIe } from "@/lib/receita/porIe";
import jsPDF from "jspdf";
import marcaAsset from "@/assets/timbrado-logo.png.asset.json";
import marcaDaguaAsset from "@/assets/timbrado-dagua.png.asset.json";
import { CONTATO_HTECH } from "@/lib/reportTimbrado";
import type { DiagnosticoEvolucao, FatorVariacao } from "./diagnostico";
import { ROTULO_PRIORIDADE, potencialConsolidado, type AcaoRecuperacao } from "./recuperacao";

/**
 * Geração de relatórios em PDF com o papel timbrado H-Tech Minas
 * (mesma identidade dos DOCX: logo centralizada, marca d'água e faixa de rodapé).
 */

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "secao"; texto: string }
  | { tipo: "texto"; texto: string; bold?: boolean }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "espaco"; altura?: number }
  | {
      tipo: "tabela";
      cabecalho: string[];
      linhas: string[][];
      larguras: number[];
      direita?: boolean[];
    };

const LARANJA: [number, number, number] = [226, 88, 42];
const GRAFITE: [number, number, number] = [74, 68, 65];
const CINZA_LINHA: [number, number, number] = [204, 204, 204];
const CINZA_FUNDO: [number, number, number] = [238, 242, 240];

const MARGEM_X = 18;
const TOPO_CONTEUDO = 40;
const BASE_CONTEUDO = 258;
const LARGURA_PAGINA = 210;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM_X * 2;

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

async function comoDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type Timbrado = { marca: string | null; marcaDagua: string | null };

async function carregarTimbradoPdf(): Promise<Timbrado> {
  const [marca, marcaDagua] = await Promise.all([
    comoDataUrl(marcaAsset.url),
    comoDataUrl(marcaDaguaAsset.url),
  ]);
  return { marca, marcaDagua };
}

function desenharTimbrado(doc: jsPDF, t: Timbrado, nota: string) {
  // marca d'água ao fundo
  if (t.marcaDagua) {
    const g = doc.GState({ opacity: 0.07 });
    doc.saveGraphicsState();
    doc.setGState(g);
    doc.addImage(t.marcaDagua, "PNG", 45, 105, 120, 81);
    doc.restoreGraphicsState();
  }

  // logo centralizada no topo
  if (t.marca) {
    doc.addImage(t.marca, "PNG", (LARGURA_PAGINA - 62) / 2, 12, 62, 14);
  } else {
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(88, 81, 78);
    doc.text("H-TECH MINAS", LARGURA_PAGINA / 2, 20, { align: "center" });
  }

  // faixa de rodapé
  doc.setFillColor(...LARANJA);
  doc.rect(MARGEM_X, 272, 8, 15, "F");
  doc.setFillColor(...GRAFITE);
  doc.rect(MARGEM_X + 8, 272, LARGURA_UTIL - 8, 15, "F");
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(255, 255, 255);
  doc.text(CONTATO_HTECH.endereco, MARGEM_X + 12, 277);
  doc.text(CONTATO_HTECH.contatos, MARGEM_X + 12, 281);
  doc.setTextColor(217, 211, 208).setFontSize(6);
  doc.text(nota, MARGEM_X + 12, 285);
  doc.setTextColor(0, 0, 0);
}

class Folha {
  doc: jsPDF;
  y = TOPO_CONTEUDO;
  constructor(
    private timbrado: Timbrado,
    private nota: string,
  ) {
    this.doc = new jsPDF({ unit: "mm", format: "a4" });
    desenharTimbrado(this.doc, this.timbrado, this.nota);
  }

  espaco(altura: number) {
    if (this.y + altura > BASE_CONTEUDO) {
      this.doc.addPage();
      desenharTimbrado(this.doc, this.timbrado, this.nota);
      this.y = TOPO_CONTEUDO;
    }
  }

  linhas(texto: string, tamanho: number, bold: boolean, cor: [number, number, number] = [30, 30, 30]) {
    this.doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(tamanho);
    this.doc.setTextColor(...cor);
    const partes = this.doc.splitTextToSize(texto, LARGURA_UTIL) as string[];
    const alturaLinha = tamanho * 0.42 + 0.8;
    for (const parte of partes) {
      this.espaco(alturaLinha);
      this.doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(tamanho);
      this.doc.setTextColor(...cor);
      this.doc.text(parte, MARGEM_X, this.y);
      this.y += alturaLinha;
    }
  }

  tabela(cabecalho: string[], linhas: string[][], larguras: number[], direita: boolean[]) {
    const total = larguras.reduce((s, l) => s + l, 0);
    const cols = larguras.map((l) => (l / total) * LARGURA_UTIL);
    const escrever = (celulas: string[], bold: boolean, fundo: boolean) => {
      this.doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
      const quebradas = celulas.map(
        (c, i) => this.doc.splitTextToSize(c ?? "", cols[i]! - 3) as string[],
      );
      const altura = Math.max(...quebradas.map((q) => q.length)) * 3.6 + 2.4;
      this.espaco(altura);
      let x = MARGEM_X;
      if (fundo) {
        this.doc.setFillColor(...CINZA_FUNDO);
        this.doc.rect(MARGEM_X, this.y - 3.4, LARGURA_UTIL, altura, "F");
      }
      this.doc.setDrawColor(...CINZA_LINHA).setLineWidth(0.1);
      this.doc.setTextColor(30, 30, 30);
      quebradas.forEach((q, i) => {
        const largura = cols[i]!;
        this.doc.rect(x, this.y - 3.4, largura, altura);
        this.doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8);
        q.forEach((linha, j) => {
          const alvo = direita[i] ? x + largura - 1.5 : x + 1.5;
          this.doc.text(linha, alvo, this.y + j * 3.6, {
            align: direita[i] ? "right" : "left",
          });
        });
        x += largura;
      });
      this.y += altura;
    };
    escrever(cabecalho, true, true);
    for (const linha of linhas) escrever(linha, false, false);
    this.y += 2;
  }

  render(blocos: Bloco[]) {
    for (const b of blocos) {
      switch (b.tipo) {
        case "titulo":
          this.linhas(b.texto, 15, true, [23, 23, 23]);
          this.y += 2;
          break;
        case "secao":
          this.y += 2;
          this.linhas(b.texto, 11, true, [40, 40, 40]);
          this.y += 1;
          break;
        case "texto":
          this.linhas(b.texto, 9.5, b.bold ?? false);
          break;
        case "lista":
          for (const item of b.itens) this.linhas(`• ${item}`, 9.5, false);
          break;
        case "espaco":
          this.y += b.altura ?? 3;
          break;
        case "tabela":
          this.tabela(
            b.cabecalho,
            b.linhas,
            b.larguras,
            b.direita ?? b.cabecalho.map(() => false),
          );
          break;
      }
    }
  }
}

const limpo = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 40);

export async function gerarPdf(nomeArquivo: string, blocos: Bloco[]): Promise<void> {
  const timbrado = await carregarTimbradoPdf();
  const folha = new Folha(
    timbrado,
    `Apura VAF 2.0 — relatório gerado em ${new Date().toLocaleDateString("pt-BR")}`,
  );
  folha.render(blocos);
  folha.doc.save(nomeArquivo);
}

function blocosFatores(titulo: string, fatores: FatorVariacao[]): Bloco[] {
  if (!fatores.length) return [];
  return [
    { tipo: "secao", texto: titulo },
    {
      tipo: "tabela",
      cabecalho: ["Fator", "Impacto (R$)", "Peso"],
      larguras: [5, 2.4, 1.6],
      direita: [false, true, true],
      linhas: fatores.map((f) => [`${f.rotulo} — ${f.detalhe}`, moeda(f.impacto), pct(f.peso)]),
    },
  ];
}

/** Análise "Por que variou" em PDF, com o mesmo conteúdo do DOCX. */
export async function baixarPdfDiagnostico(
  d: DiagnosticoEvolucao,
  baseNome: string,
  atualNome: string,
  contexto: {
    municipio?: string | null;
    exercicio?: number | null;
    situacoesReceita?: MapaReceitaPorIe | null;
  },
  acoes?: AcaoRecuperacao[],
): Promise<void> {
  const situacoesReceita = contexto.situacoesReceita ?? null;
  const blocos: Bloco[] = [
    { tipo: "titulo", texto: "Análise da variação do VAF — Por que variou" },
    { tipo: "texto", texto: `Arquivo base: ${baseNome}` },
    { tipo: "texto", texto: `Arquivo comparado/estimado: ${atualNome}` },
    ...(contexto.municipio
      ? ([{ tipo: "texto", texto: `Município: ${contexto.municipio}` }] as Bloco[])
      : []),
    ...(contexto.exercicio
      ? ([{ tipo: "texto", texto: `Exercício: ${contexto.exercicio}` }] as Bloco[])
      : []),
    { tipo: "texto", texto: `Emitido em: ${new Date().toLocaleString("pt-BR")}` },
    { tipo: "secao", texto: "Resumo" },
    { tipo: "texto", texto: d.resumo },
    { tipo: "secao", texto: "Valores" },
    {
      tipo: "texto",
      texto: `Valor líquido base: ${moeda(d.valorBase)} · Comparado/estimado: ${moeda(
        d.valorAtual,
      )} · Diferença: ${moeda(d.diferenca)}${
        d.variacaoPct === null ? "" : ` (${pct(d.variacaoPct)})`
      }`,
    },
    ...blocosFatores("Ranking de fatores — movimentação de declarantes", d.fatoresDeclarantes),
    ...blocosFatores(
      "Ranking de fatores — componentes do valor líquido (VAF A/B/C)",
      d.fatores,
    ),
  ];

  const comDetalhe = d.fatoresDeclarantes.filter((f) => f.itens.length > 0);
  if (comDetalhe.length) {
    blocos.push({ tipo: "secao", texto: "Detalhamento por fator" });
    for (const f of comDetalhe) {
      /** base negativa não entra na conta nos fatores de quem permaneceu */
      const baseZerada = f.chave === "quedas" || f.chave === "altas";
      blocos.push({
        tipo: "texto",
        bold: true,
        texto: `${f.rotulo} — ${moeda(f.impacto)}${
          f.totalItens > f.itens.length
            ? ` (exibindo os ${f.itens.length} maiores de ${f.totalItens} itens)`
            : ""
        }`,
      });
      blocos.push({
        tipo: "tabela",
        cabecalho: ["Item", "Base", "Comparado/estimado", "Impacto"],
        larguras: [4, 2, 2, 2],
        direita: [false, true, true, true],
        linhas: f.itens.map((i) => [
          i.sub ? `${i.rotulo} — ${i.sub}` : i.rotulo,
          baseZerada && i.valorBase < 0 ? `(${moeda(Math.abs(i.valorBase))})` : moeda(i.valorBase),
          moeda(i.valorAtual),
          moeda(i.impacto),
        ]),
      });
    }
  }

  if (d.topQuedas.length) {
    blocos.push({ tipo: "secao", texto: "Maiores quedas por contribuinte" });
    blocos.push({
      tipo: "lista",
      itens: d.topQuedas.map(
        (c) =>
          `${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): ${moeda(c.diferenca)}` +
          sufixoReceita(situacoesReceita, c.inscricao_estadual),
      ),
    });
  }
  if (d.topAltas.length) {
    blocos.push({ tipo: "secao", texto: "Maiores altas por contribuinte" });
    blocos.push({
      tipo: "lista",
      itens: d.topAltas.map(
        (c) =>
          `${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual}): ${moeda(c.diferenca)}` +
          sufixoReceita(situacoesReceita, c.inscricao_estadual),
      ),
    });
  }
  if (d.alertas.length) {
    blocos.push({ tipo: "secao", texto: "Ressalvas de comparabilidade" });
    blocos.push({ tipo: "lista", itens: d.alertas });
  }
  blocos.push({ tipo: "secao", texto: "Conclusão" });
  blocos.push({ tipo: "texto", texto: d.conclusao });

  if (acoes?.length) {
    blocos.push(...blocosPlano(acoes, situacoesReceita));
  }

  await gerarPdf(`analise-vaf_${limpo(baseNome)}_x_${limpo(atualNome)}.pdf`, blocos);
}

function blocosPlano(
  acoes: AcaoRecuperacao[],
  situacoesReceita?: MapaReceitaPorIe | null,
): Bloco[] {
  const total = potencialConsolidado(acoes);
  const blocos: Bloco[] = [
    { tipo: "secao", texto: "Plano de recuperação" },
    { tipo: "texto", bold: true, texto: `Potencial total mapeado: ${moeda(total)}` },
    {
      tipo: "tabela",
      cabecalho: ["Ação", "Prioridade", "Contribuintes", "Potencial (R$)"],
      larguras: [4.5, 1.7, 1.6, 2.2],
      direita: [false, false, true, true],
      linhas: acoes.map((a) => [
        a.titulo,
        ROTULO_PRIORIDADE[a.prioridade],
        String(a.contribuintes.length),
        moeda(a.valorRecuperavel),
      ]),
    },
    { tipo: "secao", texto: "Detalhamento das ações" },
  ];
  acoes.forEach((a, i) => {
    blocos.push({
      tipo: "texto",
      bold: true,
      texto: `${i + 1}. ${a.titulo} — ${ROTULO_PRIORIDADE[a.prioridade]}${
        a.valorRecuperavel > 0 ? ` · ${moeda(a.valorRecuperavel)}` : ""
      }`,
    });
    blocos.push({ tipo: "texto", texto: `Motivo: ${a.motivo}` });
    blocos.push({ tipo: "texto", texto: `Como fazer: ${a.comoFazer}` });
    blocos.push({
      tipo: "texto",
      texto:
        `Prazo: ${a.prazoSugerido}` +
        (a.contribuintes.length ? ` · Contribuintes: ${a.contribuintes.length}` : "") +
        (a.fundamento ? ` · ${a.fundamento}` : ""),
    });
    if (a.contribuintes.length) {
      blocos.push({
        tipo: "texto",
        texto: `Contribuintes: ${a.contribuintes
          .slice(0, 30)
          .map(
            (c) =>
              `${c.nome ?? "(sem nome)"} (IE ${c.inscricao_estadual})` +
              sufixoReceita(situacoesReceita, c.inscricao_estadual),
          )
          .join("; ")}${a.contribuintes.length > 30 ? " …" : ""}`,
      });
    }
    blocos.push({ tipo: "espaco" });
  });
  return blocos;
}

/** Plano de recuperação em PDF. */
export async function baixarPdfPlano(
  acoes: AcaoRecuperacao[],
  contexto: {
    municipio?: string | null;
    exercicio?: number | null;
    referencia?: string | null;
    situacoesReceita?: MapaReceitaPorIe | null;
  },
): Promise<void> {
  const blocos: Bloco[] = [
    { tipo: "titulo", texto: "Plano de recuperação do VAF — o que fazer para recuperar" },
    ...(contexto.municipio
      ? ([{ tipo: "texto", texto: `Município: ${contexto.municipio}` }] as Bloco[])
      : []),
    ...(contexto.exercicio
      ? ([{ tipo: "texto", texto: `Exercício: ${contexto.exercicio}` }] as Bloco[])
      : []),
    ...(contexto.referencia
      ? ([{ tipo: "texto", texto: `Análise: ${contexto.referencia}` }] as Bloco[])
      : []),
    { tipo: "texto", texto: `Emitido em: ${new Date().toLocaleString("pt-BR")}` },
    ...(acoes.length
      ? blocosPlano(acoes, contexto.situacoesReceita ?? null)
      : ([{ tipo: "texto", texto: "Nenhuma ação sugerida para esta análise." }] as Bloco[])),
  ];
  const sufixo = [contexto.municipio, contexto.exercicio ? String(contexto.exercicio) : null]
    .filter(Boolean)
    .map((s) => limpo(String(s)))
    .join("_");
  await gerarPdf(`plano-recuperacao-vaf${sufixo ? `_${sufixo}` : ""}.pdf`, blocos);
}
