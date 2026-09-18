/**
 * Dados do módulo Fiscaliza Cartório: emolumentos publicados pelo TJMG,
 * o que o cartório declarou ao município e o cruzamento entre os dois.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import { chave, type LinhaDeclaracao, type LinhaEmolumento } from "@/lib/cartorios/parser";

export type Competencia = { ano: number; mes: number };

/**
 * Antes de gravar: confere que há prefeitura ativa e sessão válida. Sem isso o
 * banco recusa a linha pela política de acesso e a carga para no meio.
 */
async function exigirContexto(municipioId: string | null): Promise<string> {
  if (!municipioId) {
    throw new Error(
      "Nenhuma prefeitura ativa selecionada. Escolha a prefeitura antes de importar.",
    );
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sua sessão expirou. Entre novamente e refaça a importação.");
  }
  return data.user.id;
}

/**
 * Grava em lotes sem derrubar a competência inteira: se um lote é recusado
 * (por exemplo, um cartório que ainda não está vinculado à prefeitura), tenta
 * linha a linha e devolve o que ficou de fora, em vez de perder tudo.
 */
async function gravarEmLotes<T extends Record<string, unknown>>(
  tabela: "cartorio_emolumentos" | "cartorio_serventias",
  registros: T[],
  onConflict: string,
): Promise<{ gravadas: number; ignoradas: number; motivo: string | null }> {
  let gravadas = 0;
  let ignoradas = 0;
  let motivo: string | null = null;
  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500);
    const { error } = await supabase.from(tabela).upsert(lote as never, { onConflict });
    if (!error) {
      gravadas += lote.length;
      continue;
    }
    for (const linha of lote) {
      const r = await supabase.from(tabela).upsert(linha as never, { onConflict });
      if (r.error) {
        ignoradas += 1;
        motivo ??= r.error.message;
      } else {
        gravadas += 1;
      }
    }
  }
  return { gravadas, ignoradas, motivo };
}

export type CargaCartorio = {
  id: string;
  tipo: "emolumentos" | "declaracoes";
  competencia_ano: number;
  competencia_mes: number;
  arquivo_nome: string;
  origem: string;
  linhas: number;
  observacao: string | null;
  criado_em: string;
};

/** Histórico de todas as cargas mensais enviadas pelo município. */
export function useCargasCartorio() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["cartorio-cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<CargaCartorio[]> => {
      const { data, error } = await supabase
        .from("cartorio_cargas")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("competencia_ano", { ascending: false })
        .order("competencia_mes", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CargaCartorio[];
    },
  });
}

export function useExcluirCargaCartorio() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartorio_cargas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-cargas", municipioId] }),
  });
}

/** Grava no histórico cada envio de planilha, para consulta na aba Cargas. */
async function registrarCarga(dados: {
  municipioId: string;
  tipo: "emolumentos" | "declaracoes";
  competencia: Competencia;
  arquivoNome: string;
  origem: string;
  linhas: number;
  criadoPor: string | null;
}) {
  const { error } = await supabase.from("cartorio_cargas").insert({
    municipio_id: dados.municipioId,
    tipo: dados.tipo,
    competencia_ano: dados.competencia.ano,
    competencia_mes: dados.competencia.mes,
    arquivo_nome: dados.arquivoNome,
    origem: dados.origem,
    linhas: dados.linhas,
    criado_por: dados.criadoPor,
  });
  if (error) throw error;
}



export type LinhaFiscalizacao = {
  cns: string;
  nome: string;
  comarca: string | null;
  tipoServico: string;
  status: string | null;
  emolumentos: number;
  recompe: number;
  tfj: number;
  despesa: number;
  baseDeclarada: number | null;
  issDeclarado: number | null;
  issPago: number | null;
  /** ISS calculado sobre os emolumentos publicados pelo TJMG. */
  issDevido: number;
  diferencaBase: number | null;
  diferencaIss: number | null;
  temDeclaracao: boolean;
  competenciaAno: number;
  competenciaMes: number;
  meses: number;
};

export function useCartorioConfig() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["cartorio-config", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartorio_config")
        .select("aliquota_iss, observacao")
        .eq("municipio_id", municipioId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { aliquota_iss: 5, observacao: null }) as {
        aliquota_iss: number;
        observacao: string | null;
      };
    },
  });
}

export function useSalvarCartorioConfig() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valores: { aliquota_iss: number; observacao: string | null }) => {
      const { error } = await supabase
        .from("cartorio_config")
        .upsert({ municipio_id: municipioId!, ...valores }, { onConflict: "municipio_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-config", municipioId] }),
  });
}

/** Competências que já têm emolumentos importados. */
export function useCompetenciasCartorio() {
  const { municipioId } = useMunicipioAtivo();
  return useQuery({
    queryKey: ["cartorio-competencias", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<Competencia[]> => {
      const { data, error } = await supabase
        .from("cartorio_emolumentos")
        .select("competencia_ano, competencia_mes")
        .eq("municipio_id", municipioId!)
        .order("competencia_ano", { ascending: false })
        .order("competencia_mes", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const vistos = new Set<string>();
      const saida: Competencia[] = [];
      for (const l of data ?? []) {
        const k = `${l.competencia_ano}-${l.competencia_mes}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        saida.push({ ano: l.competencia_ano as number, mes: l.competencia_mes as number });
      }
      return saida;
    },
  });
}

/** Cruzamento emolumentos × declarado, já com o ISS devido pela alíquota. */
export function useFiscalizacaoCartorio(competencia: Competencia | "todos" | null) {
  const { municipioId } = useMunicipioAtivo();
  const { data: config } = useCartorioConfig();
  const aliquota = config?.aliquota_iss ?? 5;

  return useQuery({
    queryKey: [
      "cartorio-fiscalizacao",
      municipioId,
      competencia === "todos" ? "todos" : competencia?.ano,
      competencia === "todos" ? "todos" : competencia?.mes,
      aliquota,
    ],
    enabled: !!municipioId && !!competencia,
    queryFn: async (): Promise<LinhaFiscalizacao[]> => {
      const buscarEmolumentos = async () => {
        const saida: Array<Record<string, unknown>> = [];
        for (let inicio = 0; ; inicio += 1000) {
          let consulta = supabase
            .from("cartorio_emolumentos")
            .select("*")
            .eq("municipio_id", municipioId!);
          if (competencia !== "todos") {
            consulta = consulta
              .eq("competencia_ano", competencia!.ano)
              .eq("competencia_mes", competencia!.mes);
          }
          const { data, error } = await consulta.range(inicio, inicio + 999);
          if (error) throw error;
          saida.push(...((data ?? []) as Array<Record<string, unknown>>));
          if (!data || data.length < 1000) break;
        }
        return saida;
      };
      const buscarDeclaracoes = async () => {
        const saida: Array<Record<string, unknown>> = [];
        for (let inicio = 0; ; inicio += 1000) {
          let consulta = supabase
            .from("cartorio_declaracoes")
            .select("*")
            .eq("municipio_id", municipioId!);
          if (competencia !== "todos") {
            consulta = consulta
              .eq("competencia_ano", competencia!.ano)
              .eq("competencia_mes", competencia!.mes);
          }
          const { data, error } = await consulta.range(inicio, inicio + 999);
          if (error) throw error;
          saida.push(...((data ?? []) as Array<Record<string, unknown>>));
          if (!data || data.length < 1000) break;
        }
        return saida;
      };
      const [emolumentosSalvos, declaracoesSalvas] = await Promise.all([
        buscarEmolumentos(),
        buscarDeclaracoes(),
      ]);

      const declaradas = new Map<string, Record<string, unknown>>();
      for (const d of declaracoesSalvas) {
        const prefixo = `${d.competencia_ano}-${d.competencia_mes}|`;
        declaradas.set(prefixo + chave(String(d.cns)), d);
        if (d.serventia_nome) declaradas.set(prefixo + chave(String(d.serventia_nome)), d);
      }

      const linhas: LinhaFiscalizacao[] = emolumentosSalvos.map((e) => {
        const prefixo = `${e.competencia_ano}-${e.competencia_mes}|`;
        const d =
          declaradas.get(prefixo + chave(String(e.cns))) ??
          declaradas.get(prefixo + chave(String(e.serventia_nome ?? "")));
        const emolumentos = Number(e.emolumentos ?? 0);
        const issDevido = (emolumentos * aliquota) / 100;
        const baseDeclarada = d ? Number(d.base_declarada ?? 0) : null;
        const issDeclarado = d ? Number(d.iss_declarado ?? 0) : null;
        return {
          cns: String(e.cns),
          nome: e.serventia_nome,
          comarca: e.comarca,
          tipoServico: e.tipo_servico ?? "",
          status: e.status,
          emolumentos,
          recompe: Number(e.recompe ?? 0),
          tfj: Number(e.tfj ?? 0),
          despesa: Number(e.despesa ?? 0),
          baseDeclarada,
          issDeclarado,
          issPago: d ? Number(d.iss_pago ?? 0) : null,
          issDevido,
          diferencaBase: baseDeclarada == null ? null : emolumentos - baseDeclarada,
          diferencaIss:
            issDeclarado == null
              ? null
              : issDevido - (issDeclarado || (baseDeclarada ?? 0) * (aliquota / 100)),
          temDeclaracao: !!d,
          competenciaAno: Number(e.competencia_ano),
          competenciaMes: Number(e.competencia_mes),
          meses: 1,
        };
      });

      return linhas.sort((a, b) => (b.diferencaIss ?? b.issDevido) - (a.diferencaIss ?? a.issDevido));
    },
  });
}

export function useImportarEmolumentos() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: {
      linhas: LinhaEmolumento[];
      competencia: Competencia;
      arquivoNome: string;
      fonte?: string;
    }) => {
      const usuarioId = await exigirContexto(municipioId);
      const registros = dados.linhas.map((l) => ({
        municipio_id: municipioId!,
        competencia_ano: l.ano ?? dados.competencia.ano,
        competencia_mes: l.mes ?? dados.competencia.mes,
        cns: l.cns,
        serventia_nome: l.nome,
        comarca: l.comarca,
        tipo_servico: l.tipoServico,
        status: l.status,
        emolumentos: l.emolumentos,
        recompe: l.recompe,
        tfj: l.tfj,
        despesa: l.despesa,
        outras_receitas: l.outrasReceitas,
        fonte: dados.fonte ?? "arquivo",
        arquivo_nome: dados.arquivoNome,
        criado_por: usuarioId,
      }));
      const emol = await gravarEmLotes(
        "cartorio_emolumentos",
        registros,
        "municipio_id,competencia_ano,competencia_mes,cns,tipo_servico",
      );
      if (!emol.gravadas) {
        throw new Error(
          emol.motivo
            ? `Nenhum cartório pôde ser gravado: ${emol.motivo}`
            : "Nenhum cartório pôde ser gravado.",
        );
      }
      // Mantém o cadastro de serventias em dia com o que veio do portal.
      // Falha aqui não invalida os emolumentos já gravados.
      const serventias = new Map<string, (typeof registros)[number]>();
      for (const r of registros) serventias.set(`${r.cns}|${r.tipo_servico}`, r);
      const cadastro = [...serventias.values()].map((r) => ({
        municipio_id: municipioId!,
        cns: r.cns,
        nome: r.serventia_nome,
        comarca: r.comarca,
        tipo_servico: r.tipo_servico,
        status: r.status,
      }));
      await gravarEmLotes("cartorio_serventias", cadastro, "municipio_id,cns,tipo_servico");
      await registrarCarga({
        municipioId: municipioId!,
        tipo: "emolumentos",
        competencia: {
          ano: registros[0]?.competencia_ano ?? dados.competencia.ano,
          mes: registros[0]?.competencia_mes ?? dados.competencia.mes,
        },
        arquivoNome: dados.arquivoNome,
        origem: dados.fonte ?? "arquivo",
        linhas: emol.gravadas,
        criadoPor: usuarioId,
      });
      return { gravadas: emol.gravadas, ignoradas: emol.ignoradas, motivo: emol.motivo };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartorio-competencias", municipioId] });
      qc.invalidateQueries({ queryKey: ["cartorio-fiscalizacao", municipioId] });
      qc.invalidateQueries({ queryKey: ["cartorio-serventias", municipioId] });
      qc.invalidateQueries({ queryKey: ["cartorio-cargas", municipioId] });
    },

  });
}

export function useImportarDeclaracoes() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: {
      linhas: LinhaDeclaracao[];
      competencia: Competencia;
      arquivoNome: string;
    }) => {
      const usuarioId = await exigirContexto(municipioId);
      const registros = dados.linhas.map((l) => ({
        municipio_id: municipioId!,
        competencia_ano: l.ano ?? dados.competencia.ano,
        competencia_mes: l.mes ?? dados.competencia.mes,
        cns: l.cns,
        serventia_nome: l.nome,
        tipo_servico: l.tipoServico,
        base_declarada: l.baseDeclarada,
        iss_declarado: l.issDeclarado,
        iss_pago: l.issPago,
        origem: "planilha",
        arquivo_nome: dados.arquivoNome,
        criado_por: usuarioId,
      }));
      for (let i = 0; i < registros.length; i += 500) {
        const { error } = await supabase
          .from("cartorio_declaracoes")
          .upsert(registros.slice(i, i + 500), {
            onConflict: "municipio_id,competencia_ano,competencia_mes,cns,tipo_servico",
          });
        if (error) throw error;
      }
      await registrarCarga({
        municipioId: municipioId!,
        tipo: "declaracoes",
        competencia: {
          ano: registros[0]?.competencia_ano ?? dados.competencia.ano,
          mes: registros[0]?.competencia_mes ?? dados.competencia.mes,
        },
        arquivoNome: dados.arquivoNome,
        origem: "planilha",
        linhas: registros.length,
        criadoPor: usuarioId,
      });
      return registros.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartorio-fiscalizacao", municipioId] });
      qc.invalidateQueries({ queryKey: ["cartorio-cargas", municipioId] });
    },

  });
}

/** Lançamento manual do que um cartório declarou em um mês. */
export function useSalvarDeclaracao() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dados: {
      competencia: Competencia;
      cns: string;
      tipoServico: string;
      serventiaNome: string | null;
      baseDeclarada: number;
      issDeclarado: number;
      issPago: number;
      observacao: string | null;
    }) => {
      const usuarioId = await exigirContexto(municipioId);
      const { error } = await supabase.from("cartorio_declaracoes").upsert(
        {
          municipio_id: municipioId!,
          competencia_ano: dados.competencia.ano,
          competencia_mes: dados.competencia.mes,
          cns: dados.cns,
          tipo_servico: dados.tipoServico,
          serventia_nome: dados.serventiaNome,
          base_declarada: dados.baseDeclarada,
          iss_declarado: dados.issDeclarado,
          iss_pago: dados.issPago,
          origem: "manual",
          observacao: dados.observacao,
          criado_por: usuarioId,
        },
        { onConflict: "municipio_id,competencia_ano,competencia_mes,cns,tipo_servico" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-fiscalizacao", municipioId] }),
  });
}

export type ResumoMunicipio = {
  municipioId: string;
  nome: string;
  aliquota: number;
  cartorios: number;
  meses: number;
  emolumentos: number;
  issDevido: number;
  issDeclarado: number;
  issPago: number;
  diferenca: number;
  semDeclaracao: number;
};

/**
 * Resumo consolidado por município: cartórios fiscalizados, ISS devido,
 * declarado, pago e o total acumulado no período escolhido.
 */
export function useResumoMunicipios(ano: number | null) {
  return useQuery({
    queryKey: ["cartorio-resumo-municipios", ano],
    queryFn: async (): Promise<ResumoMunicipio[]> => {
      const emolQ = supabase
        .from("cartorio_emolumentos")
        .select(
          "municipio_id, competencia_ano, competencia_mes, cns, tipo_servico, serventia_nome, emolumentos",
        )
        .limit(20000);
      const declQ = supabase
        .from("cartorio_declaracoes")
        .select(
          "municipio_id, competencia_ano, competencia_mes, cns, tipo_servico, serventia_nome, iss_declarado, iss_pago",
        )
        .limit(20000);
      if (ano) {
        emolQ.eq("competencia_ano", ano);
        declQ.eq("competencia_ano", ano);
      }
      const [emol, decl, cfg, muns] = await Promise.all([
        emolQ,
        declQ,
        supabase.from("cartorio_config").select("municipio_id, aliquota_iss"),
        supabase.from("municipios").select("id, nome").order("nome"),
      ]);
      if (emol.error) throw emol.error;
      if (decl.error) throw decl.error;
      if (cfg.error) throw cfg.error;
      if (muns.error) throw muns.error;

      const aliquotas = new Map(
        (cfg.data ?? []).map((c) => [c.municipio_id as string, Number(c.aliquota_iss ?? 5)]),
      );
      const nomes = new Map((muns.data ?? []).map((m) => [m.id as string, m.nome as string]));

      // Declarações indexadas por município + competência + serventia.
      const declaradas = new Map<string, { iss: number; pago: number }>();
      const marca = (
        mun: string,
        ano_: number,
        mes: number,
        id: string,
        iss: number,
        pago: number,
      ) => {
        const k = `${mun}|${ano_}|${mes}|${chave(id)}`;
        const atual = declaradas.get(k);
        declaradas.set(k, { iss: (atual?.iss ?? 0) + iss, pago: (atual?.pago ?? 0) + pago });
      };
      for (const d of decl.data ?? []) {
        const iss = Number(d.iss_declarado ?? 0);
        const pago = Number(d.iss_pago ?? 0);
        marca(
          d.municipio_id as string,
          d.competencia_ano as number,
          d.competencia_mes as number,
          String(d.cns),
          iss,
          pago,
        );
        if (d.serventia_nome)
          marca(
            d.municipio_id as string,
            d.competencia_ano as number,
            d.competencia_mes as number,
            d.serventia_nome,
            iss,
            pago,
          );
      }

      const acc = new Map<
        string,
        ResumoMunicipio & { cnsSet: Set<string>; mesesSet: Set<string>; usadas: Set<string> }
      >();

      for (const e of emol.data ?? []) {
        const mun = e.municipio_id as string;
        let r = acc.get(mun);
        if (!r) {
          r = {
            municipioId: mun,
            nome: nomes.get(mun) ?? "Município",
            aliquota: aliquotas.get(mun) ?? 5,
            cartorios: 0,
            meses: 0,
            emolumentos: 0,
            issDevido: 0,
            issDeclarado: 0,
            issPago: 0,
            diferenca: 0,
            semDeclaracao: 0,
            cnsSet: new Set(),
            mesesSet: new Set(),
            usadas: new Set(),
          };
          acc.set(mun, r);
        }
        const valor = Number(e.emolumentos ?? 0);
        r.emolumentos += valor;
        r.issDevido += (valor * r.aliquota) / 100;
        r.cnsSet.add(String(e.cns));
        r.mesesSet.add(`${e.competencia_ano}-${e.competencia_mes}`);

        const base = `${mun}|${e.competencia_ano}|${e.competencia_mes}|`;
        const kCns = base + chave(String(e.cns));
        const kNome = base + chave(e.serventia_nome ?? "");
        const usarCns = declaradas.has(kCns) ? kCns : declaradas.has(kNome) ? kNome : null;
        if (!usarCns) {
          r.semDeclaracao += 1;
          continue;
        }
        if (r.usadas.has(usarCns)) continue;
        r.usadas.add(usarCns);
        const d = declaradas.get(usarCns)!;
        r.issDeclarado += d.iss;
        r.issPago += d.pago;
      }

      return [...acc.values()]
        .map(({ cnsSet, mesesSet, usadas, ...r }) => ({
          ...r,
          cartorios: cnsSet.size,
          meses: mesesSet.size,
          diferenca: r.issDevido - r.issDeclarado,
        }))
        .sort((a, b) => b.diferenca - a.diferenca);
    },
  });
}

export function useExcluirCompetenciaCartorio() {
  const { municipioId } = useMunicipioAtivo();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Competencia) => {
      const { error } = await supabase
        .from("cartorio_emolumentos")
        .delete()
        .eq("municipio_id", municipioId!)
        .eq("competencia_ano", c.ano)
        .eq("competencia_mes", c.mes);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartorio-competencias", municipioId] });
      qc.invalidateQueries({ queryKey: ["cartorio-fiscalizacao", municipioId] });
    },
  });
}
