import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSessao() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s);
      setCarregando(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { sessao, carregando };
}

export type PerfilCompleto = {
  id: string;
  nome: string | null;
  papel: string;
  municipio_id: string;
  municipio: { id: string; nome: string; uf: string; codigo_sef: string };
};

export function usePerfil() {
  return useQuery({
    queryKey: ["perfil"],
    queryFn: async (): Promise<PerfilCompleto | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome, papel, municipio_id, municipios(id, nome, uf, codigo_sef)")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.municipios) return null;
      return {
        id: data.id,
        nome: data.nome,
        papel: data.papel,
        municipio_id: data.municipio_id,
        municipio: data.municipios as PerfilCompleto["municipio"],
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
