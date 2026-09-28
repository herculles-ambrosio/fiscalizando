import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Noticia = {
  id: string;
  titulo: string;
  resumo: string | null;
  url: string;
  fonte: string | null;
  publicada_em: string;
  temas: string[];
  origem: string;
  fixada: boolean;
  oculta: boolean;
};

export function useNoticias(limite = 300) {
  return useQuery({
    queryKey: ["noticias", limite],
    queryFn: async (): Promise<Noticia[]> => {
      const { data, error } = await supabase
        .from("noticias")
        .select("id, titulo, resumo, url, fonte, publicada_em, temas, origem, fixada, oculta")
        .order("fixada", { ascending: false })
        .order("publicada_em", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data as Noticia[];
    },
  });
}

export function useSalvarNoticia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: Partial<Noticia> & { id?: string }) => {
      if (n.id) {
        const { id, ...resto } = n;
        const { error } = await supabase.from("noticias").update(resto).eq("id", id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("noticias").insert({
          titulo: n.titulo!,
          url: n.url!,
          resumo: n.resumo ?? null,
          fonte: n.fonte ?? "Consultoria",
          temas: n.temas ?? [],
          origem: "manual",
          criado_por: u.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["noticias"] }),
  });
}

export function useApagarNoticia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("noticias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["noticias"] }),
  });
}

export type Fonte = { id: string; nome: string; url: string; tipo: string; ativa: boolean };

export function useFontes() {
  return useQuery({
    queryKey: ["noticias-fontes"],
    queryFn: async (): Promise<Fonte[]> => {
      const { data, error } = await supabase.from("noticias_fontes").select("*").order("nome");
      if (error) throw error;
      return data as Fonte[];
    },
  });
}

export function useSalvarFonte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Partial<Fonte> & { remover?: boolean }) => {
      if (f.remover && f.id) {
        const { error } = await supabase.from("noticias_fontes").delete().eq("id", f.id);
        if (error) throw error;
      } else if (f.id) {
        const { id, remover: _r, ...resto } = f;
        const { error } = await supabase.from("noticias_fontes").update(resto).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("noticias_fontes")
          .insert({ nome: f.nome!, url: f.url!, tipo: f.tipo ?? "rss" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["noticias-fontes"] }),
  });
}
