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

export type Papel = "superadmin" | "consultor" | "prefeitura_admin" | "prefeitura_operador";

export type PerfilCompleto = {
  id: string;
  nome: string | null;
  papel: Papel;
  municipio_id: string | null;
  precisa_trocar_senha: boolean;
  ehConsultoria: boolean;
  ehSuperadmin: boolean;
};

export function usePerfil() {
  return useQuery({
    queryKey: ["perfil"],
    queryFn: async (): Promise<PerfilCompleto | null> => {
      const { data: userData, error: erroUsuario } = await supabase.auth.getUser();
      if (erroUsuario) {
        // sessão inválida/expirada: limpa para forçar novo login
        await supabase.auth.signOut();
        return null;
      }
      const user = userData.user;
      if (!user) return null;

      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome, papel, municipio_id, precisa_trocar_senha")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const papel = data.papel as Papel;
      return {
        id: data.id,
        nome: data.nome,
        papel,
        municipio_id: data.municipio_id,
        precisa_trocar_senha: data.precisa_trocar_senha ?? false,
        ehConsultoria: papel === "superadmin" || papel === "consultor",
        ehSuperadmin: papel === "superadmin",
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
