import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PopulacaoMunicipio = {
  nome: string;
  codigoIbge: string;
  /** População do Censo 2022. */
  censo: number | null;
  /** Estimativa mais recente publicada pelo IBGE. */
  estimativa: number | null;
  /** Ano da estimativa mais recente. */
  anoEstimativa: number | null;
};

/** Chave tolerante a acentos, espaços e pontuação ("Pará de Minas" = "PARADEMINAS"). */
export function chavePopulacao(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

export type MapaPopulacao = {
  /** População de referência do município (estimativa mais recente, senão Censo). */
  de: (nome: string | null | undefined) => number | null;
  detalhe: (nome: string | null | undefined) => PopulacaoMunicipio | null;
  /** Ano da estimativa mais recente disponível na base. */
  anoReferencia: number | null;
  carregado: boolean;
};

/**
 * População oficial (IBGE) de todos os municípios mineiros, para comparar
 * repasse por habitante e dar escala ao ranking dos critérios.
 */
export function usePopulacao(): MapaPopulacao {
  const { data } = useQuery({
    queryKey: ["municipios-populacao"],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipios_populacao")
        .select("codigo_ibge, ano, nome, populacao, fonte")
        .order("ano", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    const mapa = new Map<string, PopulacaoMunicipio>();
    let anoReferencia: number | null = null;
    for (const l of data ?? []) {
      const chave = chavePopulacao(l.nome);
      const atual =
        mapa.get(chave) ??
        ({
          nome: l.nome,
          codigoIbge: l.codigo_ibge,
          censo: null,
          estimativa: null,
          anoEstimativa: null,
        } satisfies PopulacaoMunicipio);
      if (String(l.fonte).toLowerCase().includes("censo")) {
        atual.censo = l.populacao;
      } else if (!atual.anoEstimativa || l.ano > atual.anoEstimativa) {
        atual.estimativa = l.populacao;
        atual.anoEstimativa = l.ano;
        if (!anoReferencia || l.ano > anoReferencia) anoReferencia = l.ano;
      }
      mapa.set(chave, atual);
    }
    const detalhe = (nome: string | null | undefined) =>
      nome ? (mapa.get(chavePopulacao(nome)) ?? null) : null;
    return {
      detalhe,
      de: (nome) => {
        const d = detalhe(nome);
        return d ? (d.estimativa ?? d.censo) : null;
      },
      anoReferencia,
      carregado: (data?.length ?? 0) > 0,
    };
  }, [data]);
}

export function formatarPopulacao(valor: number | null): string {
  return valor == null ? "—" : valor.toLocaleString("pt-BR");
}
