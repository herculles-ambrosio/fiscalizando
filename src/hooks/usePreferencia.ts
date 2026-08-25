import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Preferência de tela gravada por usuário (tabela preferencias_usuario).
 * Assim a escolha acompanha o usuário em qualquer navegador/login.
 */
export function usePreferencia<T>(chave: string, padrao: T) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["preferencia", chave],
    queryFn: async (): Promise<T | null> => {
      const { data: sessao } = await supabase.auth.getUser();
      const usuarioId = sessao.user?.id;
      if (!usuarioId) return null;

      const { data: linha, error } = await supabase
        .from("preferencias_usuario")
        .select("valor")
        .eq("usuario_id", usuarioId)
        .eq("chave", chave)
        .maybeSingle();

      if (error) throw error;
      return (linha?.valor as T | undefined) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const gravar = useMutation({
    mutationFn: async (valor: T) => {
      const { data: sessao } = await supabase.auth.getUser();
      const usuarioId = sessao.user?.id;
      if (!usuarioId) return;

      const { error } = await supabase.from("preferencias_usuario").upsert(
        {
          usuario_id: usuarioId,
          chave,
          valor: valor as never,
        },
        { onConflict: "usuario_id,chave" },
      );
      if (error) throw error;
    },
    onSuccess: (_r, valor) => {
      queryClient.setQueryData(["preferencia", chave], valor);
    },
  });

  const [local, setLocal] = useState<T | null>(null);

  useEffect(() => {
    if (data !== undefined) setLocal(data);
  }, [data]);

  const valor = useMemo(() => local ?? padrao, [local, padrao]);

  const definir = useCallback(
    (proximo: T) => {
      setLocal(proximo);
      gravar.mutate(proximo);
    },
    [gravar],
  );

  return { valor, definir, carregando: isLoading, salvando: gravar.isPending };
}
