/**
 * Parser dos relatórios do Critério Esportes (ICMS Solidário) publicados pela
 * SEDESE/Subsecretaria de Esportes.
 *
 * O relatório tem duas seções:
 *  1) ranking geral (uma linha por município habilitado);
 *  2) memória de cálculo, com um bloco por município e atividade.
 *
 * A extração do bloco é ancorada EXCLUSIVAMENTE em linhas que começam com
 * "Município:". Menções ao nome de um município dentro do texto de eventos de
 * outro município (ex.: "Festival Esportivo da Escola Municipal Raul Soares",
 * em Aimorés) jamais abrem um bloco novo.
 */

export type CelulaPos = {
  /** coordenada horizontal do início do texto */
  x: number;
  /** largura do texto na página */
  largura: number;
  texto: string;
};

export type LinhaPos = {
  texto: string;
  /** coordenada vertical na página (maior = mais alto) */
  y: number;
  /**
   * Células da linha com a posição horizontal. Só é preenchido pelo leitor de
   * PDF; relatórios colados não têm coordenadas. Necessário para tabelas com
   * muitas colunas vazias (ex.: pontuação do IEPHA), em que a posição é a
   * única forma de saber a qual coluna o número pertence.
   */
  celulas?: CelulaPos[];
};

export type PaginaTexto = {
  pagina: number;
  linhas: LinhaPos[];
};

export type LinhaRanking = {
  posicao: number;
  municipioNome: string;
  municipio: string;
  notaAtividades: number;
  notaJimi: number;
  notaJemg: number;
  notaBabt: number;
  notaFinal: number;
  indicePercentual: number;
};

export type BlocoAtividade = {
  municipioNome: string;
  municipio: string;
  atividadeNome: string;
  eventosTexto: string;
  qtdEventos: number;
  totalParticipantes: number;
  modalidadesTexto: string;
  pesoAtividade: number | null;
  pesoRcl: number | null;
  pontuacaoAtletas: number | null;
  pontuacaoModalidades: number | null;
  pontuacao: number | null;
};

export type AtividadeReferencia = {
  codigo: string;
  nome_oficial: string;
  sinonimos: string[];
  peso: number;
};

export type IdentificacaoRelatorioEsportes = {
  anoBase: number | null;
  fonte: "preliminar" | "definitivo" | null;
};

/** Identifica no cabeçalho do próprio PDF o ano-base e a versão publicada. */
export function identificarRelatorioEsportes(
  paginas: PaginaTexto[],
): IdentificacaoRelatorioEsportes {
  const cabecalho = paginas
    .slice(0, 12)
    .flatMap((pagina) => pagina.linhas.map((linha) => linha.texto))
    .join(" ")
    .replace(/\s+/g, " ");
  const normalizado = normalizarTexto(cabecalho);
  const anoExplicito = cabecalho.match(/ano\s*[-–—:]?\s*base\D{0,20}(20\d{2})/i);
  const anoReferencia = cabecalho.match(/ano\s+(?:de\s+)?refer[eê]ncia\D{0,20}(20\d{2})/i);
  const ano = Number(anoExplicito?.[1] ?? anoReferencia?.[1] ?? 0);
  const fonte = /PRELIMINAR|PROVISORI/.test(normalizado)
    ? "preliminar"
    : /DEFINITIV|FINAL/.test(normalizado)
      ? "definitivo"
      : null;

  return {
    anoBase: ano >= 2000 && ano <= 2100 ? ano : null,
    fonte,
  };
}

/** Remove acentos, pontuação supérflua e caixa, para comparar nomes. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizarMunicipio(valor: string): string {
  return normalizarTexto(valor).replace(/\s+/g, " ");
}

function numeroBr(valor: string): number {
  const bruto = valor.trim();
  // O ranking usa vírgula decimal ("9481,5"); os quadros de pontuação usam
  // ponto decimal ("0.5"). Trata os dois formatos.
  const limpo = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : /^\d+\.\d+$/.test(bruto)
      ? bruto
      : bruto.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

const RE_RANKING =
  /^(\d{1,4})\s+([^\d]*?)\s*([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s*%$/;

const RE_SO_NUMERO = /^[\d.,%\s]+$/;

function ehRuido(texto: string): boolean {
  const t = normalizarTexto(texto);
  if (!t) return true;
  if (/^\d+\s+\d+$/.test(texto.trim())) return true; // "20 / 717" vira "20 717"
  return (
    t.startsWith("GOVERNO DO ESTADO") ||
    t.startsWith("SECRETARIA DE ESTADO") ||
    t.startsWith("SUBSECRETARIA") ||
    t.startsWith("RELATORIO DOS INDICADORES") ||
    t.startsWith("ART 8") ||
    t.startsWith("LISTAGEM DA MEMORIA") ||
    t.startsWith("HABILITADOS AO CRITERIO") ||
    t.startsWith("18 030 2009") ||
    t === "PONTUACAO" ||
    t.startsWith("RANKING MUNICIPIO") ||
    t.startsWith("ATIVIDADES JIMI JEMG") ||
    t.startsWith("B A E B T") ||
    t === "PERCENTUAL" ||
    t === "MUNICIPIO" ||
    t === "RANKING" ||
    t === "FINAL" ||
    t === "ESTADUAL"
  );
}

/**
 * Lê a seção de ranking. O nome do município pode vir quebrado em uma linha
 * acima e/ou abaixo da linha numérica; cada fragmento solto é atribuído à
 * linha numérica mais próxima verticalmente.
 */
export function extrairRanking(paginas: PaginaTexto[]): LinhaRanking[] {
  const resultado: LinhaRanking[] = [];

  for (const pagina of paginas) {
    const linhas = pagina.linhas.filter((l) => l.texto.trim() && !ehRuido(l.texto));
    const numericas: { indice: number; y: number; dados: LinhaRanking; nomes: string[] }[] = [];

    linhas.forEach((linha, indice) => {
      const m = RE_RANKING.exec(linha.texto.trim());
      if (!m) return;
      const nomeNaLinha = (m[2] ?? "").trim();
      numericas.push({
        indice,
        y: linha.y,
        nomes: nomeNaLinha ? [nomeNaLinha] : [],
        dados: {
          posicao: Number(m[1]),
          municipioNome: nomeNaLinha,
          municipio: "",
          notaAtividades: numeroBr(m[3] ?? "0"),
          notaJimi: numeroBr(m[4] ?? "0"),
          notaJemg: numeroBr(m[5] ?? "0"),
          notaBabt: numeroBr(m[6] ?? "0"),
          notaFinal: numeroBr(m[7] ?? "0"),
          indicePercentual: numeroBr(m[8] ?? "0"),
        },
      });
    });

    if (!numericas.length) continue;

    // fragmentos de nome: linhas sem números, atribuídas à numérica mais próxima
    linhas.forEach((linha, indice) => {
      const texto = linha.texto.trim();
      if (!texto || RE_SO_NUMERO.test(texto)) return;
      if (RE_RANKING.test(texto)) return;
      if (/\d/.test(texto)) return;
      let alvo = numericas[0]!;
      let melhor = Number.POSITIVE_INFINITY;
      for (const n of numericas) {
        const dist =
          Number.isFinite(linha.y) && Number.isFinite(n.y)
            ? Math.abs(n.y - linha.y)
            : Math.abs(n.indice - indice);
        if (dist < melhor) {
          melhor = dist;
          alvo = n;
        }
      }
      if (alvo.indice > indice) alvo.nomes.unshift(texto);
      else alvo.nomes.push(texto);
    });

    for (const n of numericas) {
      const nome = n.nomes.join(" ").replace(/\s+/g, " ").trim();
      if (!nome) continue;
      resultado.push({
        ...n.dados,
        municipioNome: nome,
        municipio: normalizarMunicipio(nome),
      });
    }
  }

  // remove duplicidades (mesma posição repetida entre páginas)
  const vistos = new Set<string>();
  return resultado.filter((l) => {
    const chave = `${l.posicao}|${l.municipio}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

const RE_MUNICIPIO = /^Munic[ií]pio:\s*(.+)$/;
const RE_ATIVIDADE = /^Atividade\s+Esportiva:\s*(.+)$/i;
const RE_EVENTOS = /^Eventos\s+Realizados/i;
const RE_MODALIDADES = /^Modalidades\s+Oferecidas/i;
const RE_CABECALHO_PONTOS = /^Peso\s+Atividade\s+Esportiva/i;
const RE_LINHA_PONTOS = /^([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/;

/** Lê a seção de memória de cálculo (um registro por município + atividade). */
export function extrairBlocos(linhasBrutas: string[]): BlocoAtividade[] {
  const linhas = linhasBrutas.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);

  const blocos: BlocoAtividade[] = [];
  let municipioNome = "";
  let atual: BlocoAtividade | null = null;
  let secao: "eventos" | "modalidades" | null = null;

  const fechar = () => {
    if (!atual) return;
    atual.eventosTexto = atual.eventosTexto.trim();
    atual.modalidadesTexto = atual.modalidadesTexto.trim();
    const eventos = atual.eventosTexto
      ? atual.eventosTexto.split(/\)\s*,\s*/).filter((e) => e.trim().length > 0)
      : [];
    atual.qtdEventos = eventos.length;
    atual.totalParticipantes = [...atual.eventosTexto.matchAll(/\((\d+)\)/g)].reduce(
      (soma, m) => soma + Number(m[1] ?? 0),
      0,
    );
    blocos.push(atual);
    atual = null;
    secao = null;
  };

  for (const linha of linhas) {
    const mMun = RE_MUNICIPIO.exec(linha);
    if (mMun) {
      fechar();
      municipioNome = (mMun[1] ?? "").trim();
      continue;
    }
    if (ehRuido(linha)) continue;

    const mAtiv = RE_ATIVIDADE.exec(linha);
    if (mAtiv) {
      fechar();
      if (!municipioNome) continue;
      atual = {
        municipioNome,
        municipio: normalizarMunicipio(municipioNome),
        atividadeNome: (mAtiv[1] ?? "").trim(),
        eventosTexto: "",
        qtdEventos: 0,
        totalParticipantes: 0,
        modalidadesTexto: "",
        pesoAtividade: null,
        pesoRcl: null,
        pontuacaoAtletas: null,
        pontuacaoModalidades: null,
        pontuacao: null,
      };
      secao = null;
      continue;
    }

    if (!atual) continue;

    if (RE_EVENTOS.test(linha)) {
      secao = "eventos";
      continue;
    }
    if (RE_MODALIDADES.test(linha)) {
      secao = "modalidades";
      continue;
    }
    if (RE_CABECALHO_PONTOS.test(linha)) {
      secao = null;
      continue;
    }
    const mPontos = RE_LINHA_PONTOS.exec(linha);
    if (mPontos) {
      atual.pesoAtividade = numeroBr(mPontos[1] ?? "");
      atual.pesoRcl = numeroBr(mPontos[2] ?? "");
      atual.pontuacaoAtletas = numeroBr(mPontos[3] ?? "");
      atual.pontuacaoModalidades = numeroBr(mPontos[4] ?? "");
      atual.pontuacao = numeroBr(mPontos[5] ?? "");
      fechar();
      continue;
    }
    if (secao === "eventos") atual.eventosTexto += (atual.eventosTexto ? " " : "") + linha;
    else if (secao === "modalidades")
      atual.modalidadesTexto += (atual.modalidadesTexto ? " " : "") + linha;
  }

  fechar();
  return blocos;
}

/** Casa o nome da atividade vindo do PDF com o Anexo V (nome oficial ou sinônimo). */
export function mapearAtividade(
  nome: string,
  referencia: AtividadeReferencia[],
): AtividadeReferencia | null {
  const alvo = normalizarTexto(nome);
  for (const ref of referencia) {
    if (normalizarTexto(ref.nome_oficial) === alvo) return ref;
    if ((ref.sinonimos ?? []).some((s) => normalizarTexto(s) === alvo)) return ref;
  }
  for (const ref of referencia) {
    const oficial = normalizarTexto(ref.nome_oficial);
    if (alvo.includes(oficial) || oficial.includes(alvo)) return ref;
    if ((ref.sinonimos ?? []).some((s) => alvo.includes(normalizarTexto(s)))) return ref;
  }
  return null;
}
