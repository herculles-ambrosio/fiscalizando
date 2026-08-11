import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracao } from "./useConfiguracao";
import { useModelos } from "./useModelos";
import { MODELOS_PADRAO } from "@/lib/oficios/modelos";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import { baixarBlob, carregarBrasao } from "@/lib/oficios/pacote";
import { nomeArquivoOficio } from "@/lib/oficios/zerados";
import { hojeIso } from "@/lib/oficios/texto";
import { marcarStatusEmissoes, type EmissaoRegistro } from "@/lib/oficios/registro";

/**
 * Regera e baixa novamente o .docx de um ofício já registrado no histórico,
 * mesmo que o download anterior já tenha sido concluído.
 */
export function useReemitirOficio() {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emissao: EmissaoRegistro) => {
      if (!config?.nome_prefeitura || !config?.cidade_data) {
        throw new Error("Preencha os dados da prefeitura em Configurações.");
      }

      const modelo =
        (modelos ?? []).find((m) => m.chave === emissao.modelo_chave) ??
        MODELOS_PADRAO.find((m) => m.chave === emissao.modelo_chave);
      if (!modelo) throw new Error("O modelo usado nesta emissão não existe mais.");

      let contribuinte = {
        id: emissao.contribuinte_id ?? undefined,
        nome: emissao.nome_contribuinte,
        cnpj: emissao.cnpj,
        inscricao_estadual: emissao.inscricao_estadual,
        endereco: null as string | null,
      };

      let consulta = supabase
        .from("contribuintes_apurados")
        .select("id, nome, cnpj, inscricao_estadual, endereco")
        .eq("municipio_id", emissao.municipio_id)
        .limit(1);
      consulta = emissao.contribuinte_id
        ? consulta.eq("id", emissao.contribuinte_id)
        : consulta.eq("inscricao_estadual", emissao.inscricao_estadual);
      const { data: atual } = await consulta.maybeSingle();
      if (atual) {
        contribuinte = {
          id: atual.id,
          nome: atual.nome,
          cnpj: atual.cnpj,
          inscricao_estadual: atual.inscricao_estadual,
          endereco: atual.endereco,
        };
      }

      const brasao = await carregarBrasao(config.brasao_path);
      const blob = await gerarDocxOficio({
        contribuinte,
        modelo,
        config,
        exercicio: emissao.exercicio,
        dataOficio: hojeIso(),
        brasao,
      });

      baixarBlob(blob, emissao.arquivo_nome ?? nomeArquivoOficio(contribuinte));
      await marcarStatusEmissoes([emissao.id], "baixado");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["oficios-emitidos"] });
    },
  });
}
