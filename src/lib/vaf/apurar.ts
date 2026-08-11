import { LAYOUT_ATIVOS, LAYOUTS_RETORNO } from "./layouts";
import { chaveData, dataSefParaISO, parseLinha, separarLinhas } from "./parser";

export const SITUACOES = [
  "OMISSO",
  "ZERADO",
  "FORA_DO_PRAZO",
  "DISCREPANTE",
  "NORMAL",
] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  OMISSO: "Omisso",
  ZERADO: "Zerado",
  FORA_DO_PRAZO: "Fora do prazo",
  DISCREPANTE: "Discrepante",
  NORMAL: "Normal",
};

export type ContribuinteApurado = {
  inscricao_estadual: string;
  cnpj: string | null;
  nome: string | null;
  endereco: string | null;
  cnae: string | null;
  entregou_declaracao: boolean;
  vaf_atual: number | null;
  vaf_anterior: number | null;
  variacao_pct: number | null;
  data_entrega: string | null;
  situacoes: Situacao[];
};

export type ResultadoApuracao = {
  exercicio: number;
  contribuintes: ContribuinteApurado[];
  totais: Record<"ativos" | Lowercase<Situacao>, number>;
};

export type OpcoesApuracao = {
  exercicio?: number | null;
  limiarDiscrepancia?: number; // 0.30 = 30%
  dataLimiteEntrega?: string | null; // ISO; padrão 31/05 do ano seguinte
};

function limparNumero(txt: string): string {
  return (txt || "").replace(/[^0-9]/g, "").replace(/^0+/, "");
}

function sinalAplicado(valor: number | null, sinal: string | undefined): number | null {
  if (valor == null) return null;
  return (sinal || "").trim() === "-" ? -valor : valor;
}

function montarEndereco(reg: Record<string, any>): string {
  const partes = [
    [reg["tipo_logradouro"], reg["nome_logradouro"]].filter(Boolean).join(" "),
    reg["numero_logradouro"],
    reg["bairro_contribuinte"],
    reg["codigo_cep"],
  ].filter((p) => p && String(p).trim().length > 0);
  return partes.join(", ");
}

export function apurar(
  textoAtivos: string,
  textoRetorno: string,
  opcoes: OpcoesApuracao = {},
): ResultadoApuracao {
  const limiar = opcoes.limiarDiscrepancia ?? 0.3;

  // ---- Universo de ativos (somente situação normal) ----
  const ativos = new Map<string, Record<string, any>>();
  for (const linha of separarLinhas(textoAtivos)) {
    const reg = parseLinha(linha, LAYOUT_ATIVOS);
    if (String(reg["codigo_situacao_contribuinte"]).trim() !== "1") continue;
    const ie = String(reg["inscricao_estadual"]).trim();
    if (!ie) continue;
    ativos.set(ie, reg);
  }

  // ---- Retorno ----
  const reg01 = new Map<string, Record<string, any>[]>();
  const reg10 = new Map<string, Record<string, any>[]>();
  const reg02 = new Map<string, Record<string, any>>();
  const contagemExercicio = new Map<number, number>();

  for (const linha of separarLinhas(textoRetorno)) {
    const tipo = linha.slice(0, 2);
    if (tipo !== "01" && tipo !== "10" && tipo !== "02") continue;
    const layout = LAYOUTS_RETORNO[tipo];
    if (!layout) continue;
    const reg = parseLinha(linha, layout);
    const ie = String(reg["inscricao_estadual"]).trim();
    if (!ie) continue;
    if (tipo === "01") {
      const ex = Number(String(reg["exercicio"]).trim());
      if (ex) contagemExercicio.set(ex, (contagemExercicio.get(ex) ?? 0) + 1);
      const lista = reg01.get(ie) ?? [];
      lista.push(reg);
      reg01.set(ie, lista);
    } else if (tipo === "10") {
      const lista = reg10.get(ie) ?? [];
      lista.push(reg);
      reg10.set(ie, lista);
    } else {
      reg02.set(ie, reg);
    }
  }

  // Exercício: informado ou a moda do registro 01
  let exercicio = opcoes.exercicio ?? 0;
  if (!exercicio) {
    let melhor = 0;
    for (const [ex, qtd] of contagemExercicio) {
      if (qtd > melhor) {
        melhor = qtd;
        exercicio = ex;
      }
    }
  }
  if (!exercicio) throw new Error("Não foi possível detectar o exercício no arquivo de retorno.");

  const dataLimite = opcoes.dataLimiteEntrega || `${exercicio + 1}-05-31`;
  const limiteNum = Number(dataLimite.replace(/-/g, ""));

  const contribuintes: ContribuinteApurado[] = [];
  const totais = {
    ativos: 0,
    omisso: 0,
    zerado: 0,
    fora_do_prazo: 0,
    discrepante: 0,
    normal: 0,
  };

  for (const [ie, ativo] of ativos) {
    const declaracoes = (reg01.get(ie) ?? []).filter(
      (r) => Number(String(r["exercicio"]).trim()) === exercicio,
    );
    const entregou = declaracoes.length > 0;
    const declaracao = declaracoes.sort(
      (a, b) => chaveData(b["data_processamento"]) - chaveData(a["data_processamento"]),
    )[0];

    const historicos = (reg10.get(ie) ?? []).filter(
      (r) => Number(String(r["exercicio"]).trim()) === exercicio,
    );
    const historico = historicos.sort(
      (a, b) => chaveData(b["data_processamento"]) - chaveData(a["data_processamento"]),
    )[0];

    const vafAtual = historico
      ? (sinalAplicado(historico["valor_vaf_num"] ?? 0, historico["sinal_valor_vaf"]) ?? 0)
      : entregou
        ? 0
        : null;

    const anterior = reg02.get(ie);
    const vafAnterior = anterior
      ? sinalAplicado(
          anterior["valor_adicionado_anterior_num"] ?? 0,
          anterior["sinal_valor_adicionado_anterior"],
        )
      : null;

    let variacao: number | null = null;
    if (vafAtual != null && vafAnterior != null && Math.abs(vafAnterior) > 0) {
      variacao = ((vafAtual - vafAnterior) / Math.abs(vafAnterior)) * 100;
    }

    const dataEntregaISO = declaracao ? dataSefParaISO(declaracao["data_entrega"]) : null;

    const situacoes: Situacao[] = [];
    if (!entregou) situacoes.push("OMISSO");
    else {
      if ((vafAtual ?? 0) === 0) situacoes.push("ZERADO");
      if (dataEntregaISO && Number(dataEntregaISO.replace(/-/g, "")) > limiteNum)
        situacoes.push("FORA_DO_PRAZO");
    }
    if (variacao != null && Math.abs(variacao) / 100 >= limiar) situacoes.push("DISCREPANTE");
    if (situacoes.length === 0) situacoes.push("NORMAL");

    totais.ativos += 1;
    for (const s of situacoes) {
      const chave = s.toLowerCase() as keyof typeof totais;
      totais[chave] += 1;
    }

    const cnpj = limparNumero(String(ativo["cnpj_contribuinte"] ?? ""));

    contribuintes.push({
      inscricao_estadual: ie,
      cnpj: cnpj ? cnpj.padStart(14, "0") : null,
      nome: String(ativo["nome_comercial"] ?? "").trim() || null,
      endereco: montarEndereco(ativo) || null,
      cnae: String(ativo["codigo_cnaef_contribuinte"] ?? "").trim() || null,
      entregou_declaracao: entregou,
      vaf_atual: vafAtual,
      vaf_anterior: vafAnterior,
      variacao_pct: variacao,
      data_entrega: dataEntregaISO,
      situacoes,
    });
  }

  return { exercicio, contribuintes, totais };
}
