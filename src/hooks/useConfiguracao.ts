import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "./usePerfil";
import type { ConfiguracaoMunicipio } from "@/lib/oficios/zerados";

export type ConfigRegistro = ConfiguracaoMunicipio & {
  id: string;
  municipio_id: string;
  brasao_path: string | null;
};

export const CONFIG_VAZIA: ConfiguracaoMunicipio = {
  nome_prefeitura: "",
  estado: "ESTADO DE MINAS GERAIS",
  secretaria: "SECRETARIA MUNICIPAL DE FAZENDA",
  setor: "",
  endereco_rodape: "",
  cidade_data: "",
  signatario_nome: "",
  signatario_cargo: "",
  texto_assinatura: "Secretaria Municipal da Fazenda",
};

export function useConfiguracao() {
  const { data: perfil } = usePerfil();

  return useQuery({
    queryKey: ["configuracao", perfil?.municipio_id],
    enabled: !!perfil,
    queryFn: async (): Promise<ConfigRegistro | null> => {
      const { data, error } = await supabase
        .from("configuracoes_municipio")
        .select("*")
        .eq("municipio_id", perfil!.municipio_id)
        .maybeSingle();
      if (error) throw error;
      return (data as ConfigRegistro | null) ?? null;
    },
  });
}

export function useSalvarConfiguracao() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (valores: ConfiguracaoMunicipio & { brasao_path?: string | null }) => {
      if (!perfil) throw new Error("Perfil não carregado.");
      const { error } = await supabase
        .from("configuracoes_municipio")
        .upsert({ ...valores, municipio_id: perfil.municipio_id }, { onConflict: "municipio_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracao"] }),
  });
}
