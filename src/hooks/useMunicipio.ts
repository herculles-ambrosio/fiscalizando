import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "./usePerfil";

export type Municipio = {
  id: string;
  nome: string;
  uf: string;
  codigo_sef: string;
  cliente: boolean;
  fonte_indice: string;
};

const CHAVE = "vaf.municipio_ativo";
const ouvintes = new Set<(id: string | null) => void>();

function lerArmazenado(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHAVE);
}

export function definirMunicipioArmazenado(id: string) {
  window.localStorage.setItem(CHAVE, id);
  ouvintes.forEach((fn) => fn(id));
}

export function useMunicipios() {
  const { data: perfil } = usePerfil();
  return useQuery({
    queryKey: ["municipios", perfil?.id],
    enabled: !!perfil,
    queryFn: async (): Promise<Municipio[]> => {
      const { data, error } = await supabase
        .from("municipios")
        .select("id, nome, uf, codigo_sef, cliente, fonte_indice")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Município em que as telas operam: fixo para usuários de prefeitura,
 * selecionável (e persistido) para a consultoria.
 */
export function useMunicipioAtivo() {
  const { data: perfil } = usePerfil();
  const { data: municipios, isLoading } = useMunicipios();
  // Inicia sempre em null: ler o localStorage durante o render quebraria a
  // hidratação (o servidor não tem storage) e derrubaria a árvore React.
  const [escolhido, setEscolhido] = useState<string | null>(null);

  useEffect(() => {
    setEscolhido(lerArmazenado());
    const fn = (id: string | null) => setEscolhido(id);
    ouvintes.add(fn);
    return () => {
      ouvintes.delete(fn);
    };
  }, []);


  const lista = municipios ?? [];
  const permitido = (id: string | null | undefined) => !!id && lista.some((m) => m.id === id);

  let municipioId: string | null = null;
  if (perfil?.ehConsultoria) {
    municipioId = permitido(escolhido) ? escolhido : (lista[0]?.id ?? null);
  } else {
    municipioId = perfil?.municipio_id ?? null;
  }

  const municipio = lista.find((m) => m.id === municipioId) ?? null;

  const trocar = useCallback((id: string) => definirMunicipioArmazenado(id), []);

  return {
    municipioId,
    municipio,
    municipios: lista,
    podeTrocar: !!perfil?.ehConsultoria,
    carregando: isLoading || !perfil,
    trocar,
  };
}
