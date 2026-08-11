import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "./useMunicipio";
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
  const { municipioId } = useMunicipioAtivo();

  return useQuery({
    queryKey: ["configuracao", municipioId],
    enabled: !!municipioId,
    queryFn: async (): Promise<ConfigRegistro | null> => {
      const { data, error } = await supabase
        .from("configuracoes_municipio")
        .select("*")
        .eq("municipio_id", municipioId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ConfigRegistro | null) ?? null;
    },
  });
}

export function useSalvarConfiguracao() {
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (valores: ConfiguracaoMunicipio & { brasao_path?: string | null }) => {
      if (!municipioId) throw new Error("Nenhuma prefeitura selecionada.");
      const { error } = await supabase
        .from("configuracoes_municipio")
        .upsert({ ...valores, municipio_id: municipioId }, { onConflict: "municipio_id" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracao"] }),
  });
}
