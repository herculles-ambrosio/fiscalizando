export const TIPOS_RETORNO = ["mensal", "indice_provisorio", "indice_definitivo"] as const;
export type TipoRetorno = (typeof TIPOS_RETORNO)[number];

export const ROTULO_TIPO_RETORNO: Record<TipoRetorno, string> = {
  mensal: "Retorno mensal",
  indice_provisorio: "Índice provisório",
  indice_definitivo: "Índice definitivo",
};

export const ROTULO_TIPO_RETORNO_CURTO: Record<TipoRetorno, string> = {
  mensal: "Mensal",
  indice_provisorio: "Provisório",
  indice_definitivo: "Definitivo",
};

export function rotuloTipoRetorno(tipo: string | null | undefined): string {
  return ROTULO_TIPO_RETORNO[(tipo ?? "mensal") as TipoRetorno] ?? "Retorno mensal";
}

/**
 * Nome padrão da SEF-MG: P{codigo}RT{remessa}{ano}.txt — ex.: P443RT1226.
 * A remessa 13 é a que traz o fechamento (índice definitivo).
 */
export function remessaDoArquivo(nome: string): number | null {
  const m = /RT(\d{2})(\d{2})/i.exec(nome.replace(/\s+/g, ""));
  if (!m) return null;
  const remessa = Number(m[1]);
  return remessa >= 1 && remessa <= 13 ? remessa : null;
}

export function sugerirTipoRetorno(nome: string): { tipo: TipoRetorno; mes: number | null } {
  const remessa = remessaDoArquivo(nome);
  if (remessa === 13) return { tipo: "indice_definitivo", mes: 13 };
  return { tipo: "mensal", mes: remessa };
}

export const MESES_CURTOS = [
  "jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez",
] as const;

/**
 * Rótulo da remessa (número do arquivo enviado pela SEF), de 1 a 13.
 * Não é mês de competência: o layout do retorno não traz mês, só o exercício.
 */
export function rotuloRemessa(remessa: number | null | undefined): string {
  if (!remessa) return "—";
  if (remessa === 13) return "Arquivo 13 · fechamento";
  return `Arquivo ${String(remessa).padStart(2, "0")}`;
}

/** Rótulo temporal padrão do sistema: "2025 · Arquivo 12" / "2025 · Definitivo". */
export function rotuloExercicioRemessa(
  exercicio: number | null | undefined,
  remessa: number | null | undefined,
  tipo?: string | null,
): string {
  if (!exercicio) return "—";
  if (tipo === "indice_definitivo" || remessa === 13) return `${exercicio} · Definitivo`;
  if (tipo === "indice_provisorio" && !remessa) return `${exercicio} · Provisório`;
  if (!remessa || remessa < 1 || remessa > 13) return String(exercicio);
  return `${exercicio} · Arquivo ${String(remessa).padStart(2, "0")}`;
}

/** Ordenação por exercício e, dentro dele, pelo número da remessa. */
export function ordemExercicioRemessa(
  exercicio: number | null | undefined,
  remessa: number | null | undefined,
): number {
  return (exercicio ?? 0) * 100 + (remessa ?? 0);
}


/** Ano de competência a partir do nome padrão SEF-MG (P443RT1226 -> 2026). */
export function anoDoArquivo(nome: string): number | null {
  const m = /RT(\d{2})(\d{2})/i.exec(nome.replace(/\s+/g, ""));
  if (!m) return null;
  return 2000 + Number(m[2]);
}

/** Código do município no nome padrão SEF-MG (P443RT1226 -> "443"). */
export function codigoMunicipioDoArquivo(nome: string): string | null {
  const m = /P(\d{3})(AT|RT)/i.exec(nome.replace(/\s+/g, ""));
  return m?.[1] ?? null;
}

/** Ano do arquivo de contribuintes ativos (P443AT0026 -> 2026). */
export function anoDoArquivoAtivos(nome: string): number | null {
  const m = /AT(\d{2})(\d{2})/i.exec(nome.replace(/\s+/g, ""));
  if (!m) return null;
  return 2000 + Number(m[2]);
}

export type NivelAlerta = "erro" | "aviso";
export type AlertaCompetencia = { nivel: NivelAlerta; mensagem: string };

export function validarCompetencia(params: {
  nomeAtivos?: string | null;
  nomeRetorno?: string | null;
  tipoRetorno: TipoRetorno;
  competenciaMes: number | null;
  competenciaAno: number | null;
}): AlertaCompetencia[] {
  const { nomeAtivos, nomeRetorno, tipoRetorno, competenciaMes, competenciaAno } = params;
  const alertas: AlertaCompetencia[] = [];

  const anoRetorno = nomeRetorno ? anoDoArquivo(nomeRetorno) : null;
  const remessa = nomeRetorno ? remessaDoArquivo(nomeRetorno) : null;
  const anoAtivos = nomeAtivos ? anoDoArquivoAtivos(nomeAtivos) : null;
  const codRetorno = nomeRetorno ? codigoMunicipioDoArquivo(nomeRetorno) : null;
  const codAtivos = nomeAtivos ? codigoMunicipioDoArquivo(nomeAtivos) : null;

  if (nomeRetorno && !anoRetorno) {
    alertas.push({
      nivel: "aviso",
      mensagem: `O nome "${nomeRetorno}" não segue o padrão P{código}RT{remessa}{ano}. Confira a remessa e o ano de entrega manualmente.`,
    });
  }

  if (codAtivos && codRetorno && codAtivos !== codRetorno) {
    alertas.push({
      nivel: "erro",
      mensagem: `Os arquivos parecem ser de municípios diferentes (ativos ${codAtivos} × retorno ${codRetorno}).`,
    });
  }

  if (anoAtivos && anoRetorno && anoAtivos !== anoRetorno) {
    alertas.push({
      nivel: "erro",
      mensagem: `O arquivo de contribuintes ativos é de ${anoAtivos} e o de retorno de ${anoRetorno}. Apuração bloqueada — ambos devem ser do mesmo ano.`,
    });
  }

  if (!competenciaAno) {
    alertas.push({
      nivel: "aviso",
      mensagem: "Ano de entrega do arquivo em branco — será usado o exercício detectado nos arquivos.",
    });
  } else {
    if (competenciaAno < 1990 || competenciaAno > new Date().getFullYear() + 1) {
      alertas.push({
        nivel: "erro",
        mensagem: `Ano de entrega ${competenciaAno} fora do intervalo esperado.`,
      });
    }
    if (anoRetorno && competenciaAno !== anoRetorno) {
      alertas.push({
        nivel: "erro",
        mensagem: `Ano de entrega informado (${competenciaAno}) diferente do ano do arquivo de retorno (${anoRetorno}).`,
      });
    }
  }

  if (tipoRetorno === "mensal") {
    if (remessa && competenciaMes && competenciaMes !== remessa) {
      alertas.push({
        nivel: "erro",
        mensagem: `Remessa informada (${String(competenciaMes).padStart(2, "0")}) diferente da remessa do nome do arquivo (${String(remessa).padStart(2, "0")}).`,
      });
    }
    if (remessa && !competenciaMes) {
      alertas.push({
        nivel: "aviso",
        mensagem: `O arquivo indica a remessa ${String(remessa).padStart(2, "0")}; informe o número da remessa.`,
      });
    }
  } else if (competenciaMes && !(competenciaMes === 13 && remessa === 13)) {
    alertas.push({
      nivel: "aviso",
      mensagem: `Retornos de índice ${tipoRetorno === "indice_definitivo" ? "definitivo" : "provisório"} costumam vir na remessa 13 — a remessa ${String(competenciaMes).padStart(2, "0")} foi informada.`,
    });
  }



  return alertas;
}
