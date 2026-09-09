/**
 * Dados do módulo Fiscaliza Cartório: emolumentos publicados pelo TJMG,
 * o que o cartório declarou ao município e o cruzamento entre os dois.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
import { chave, type LinhaDeclaracao, type LinhaEmolumento } from "@/lib/cartorios/parser";

export type Competencia = { ano: number; mes: number };

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
export function useFiscalizacaoCartorio(competencia: Competencia | null) {
  const { municipioId } = useMunicipioAtivo();
  const { data: config } = useCartorioConfig();
  const aliquota = config?.aliquota_iss ?? 5;

  return useQuery({
    queryKey: ["cartorio-fiscalizacao", municipioId, competencia?.ano, competencia?.mes, aliquota],
    enabled: !!municipioId && !!competencia,
    queryFn: async (): Promise<LinhaFiscalizacao[]> => {
      const [emol, decl] = await Promise.all([
        supabase
          .from("cartorio_emolumentos")
          .select("*")
          .eq("municipio_id", municipioId!)
          .eq("competencia_ano", competencia!.ano)
          .eq("competencia_mes", competencia!.mes)
          .limit(2000),
        supabase
          .from("cartorio_declaracoes")
          .select("*")
          .eq("municipio_id", municipioId!)
          .eq("competencia_ano", competencia!.ano)
          .eq("competencia_mes", competencia!.mes)
          .limit(2000),
      ]);
      if (emol.error) throw emol.error;
      if (decl.error) throw decl.error;

      const declaradas = new Map<string, (typeof decl.data)[number]>();
      for (const d of decl.data ?? []) {
        declaradas.set(chave(String(d.cns)), d);
        if (d.serventia_nome) declaradas.set(chave(d.serventia_nome), d);
      }

      const linhas: LinhaFiscalizacao[] = (emol.data ?? []).map((e) => {
        const d = declaradas.get(chave(String(e.cns))) ?? declaradas.get(chave(e.serventia_nome ?? ""));
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
      const { data: sessao } = await supabase.auth.getUser();
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
        criado_por: sessao.user?.id ?? null,
      }));
      for (let i = 0; i < registros.length; i += 500) {
        const { error } = await supabase
          .from("cartorio_emolumentos")
          .upsert(registros.slice(i, i + 500), {
            onConflict: "municipio_id,competencia_ano,competencia_mes,cns,tipo_servico",
          });
        if (error) throw error;
      }
      // Mantém o cadastro de serventias em dia com o que veio do portal.
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
      for (let i = 0; i < cadastro.length; i += 500) {
        const { error } = await supabase
          .from("cartorio_serventias")
          .upsert(cadastro.slice(i, i + 500), { onConflict: "municipio_id,cns,tipo_servico" });
        if (error) throw error;
      }
      await registrarCarga({
        municipioId: municipioId!,
        tipo: "emolumentos",
        competencia: {
          ano: registros[0]?.competencia_ano ?? dados.competencia.ano,
          mes: registros[0]?.competencia_mes ?? dados.competencia.mes,
        },
        arquivoNome: dados.arquivoNome,
        origem: dados.fonte ?? "arquivo",
        linhas: registros.length,
        criadoPor: sessao.user?.id ?? null,
      });
      return registros.length;
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
      const { data: sessao } = await supabase.auth.getUser();
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
        criado_por: sessao.user?.id ?? null,
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
        criadoPor: sessao.user?.id ?? null,
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
      const { data: sessao } = await supabase.auth.getUser();
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
          criado_por: sessao.user?.id ?? null,
        },
        { onConflict: "municipio_id,competencia_ano,competencia_mes,cns,tipo_servico" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cartorio-fiscalizacao", municipioId] }),
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
