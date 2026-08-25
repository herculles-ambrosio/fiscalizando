import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { reconsultarFalhasReceita } from "@/lib/receita/cnpj.functions";
import { limparCnpj } from "@/lib/receita/normalizar";

/**
 * CNPJs que ficaram "sem resposta" nas bases públicas e aguardam reconsulta.
 * A fila é reprocessada automaticamente por um worker agendado; aqui apenas
 * lemos os pendentes e oferecemos a reconsulta imediata.
 */
export function useFilaReceita(cnpjs?: (string | null | undefined)[]) {
  const escopo = cnpjs
    ? [...new Set(cnpjs.map(limparCnpj).filter((c): c is string => !!c))].sort()
    : null;

  const query = useQuery({
    queryKey: ["receita-fila", escopo],
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const pendentes: string[] = [];
      const lotes = escopo ? chunk(escopo, 200) : [null];
      for (const lote of lotes) {
        let consulta = supabase.from("receita_fila").select("cnpj").eq("status", "pendente");
        if (lote) consulta = consulta.in("cnpj", lote);
        const { data, error } = await consulta.limit(1000);
        if (error) throw error;
        pendentes.push(...(data ?? []).map((r) => r.cnpj));
      }
      return [...new Set(pendentes)];
    },
  });

  const reconsultar = useServerFn(reconsultarFalhasReceita);
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: async () => reconsultar({ data: { cnpjs: query.data ?? [] } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["receita-fila"] });
      void queryClient.invalidateQueries({ queryKey: ["situacoes-receita"] });
    },
  });

  return {
    semResposta: query.data ?? [],
    total: query.data?.length ?? 0,
    reconsultar: mutacao.mutate,
    reconsultando: mutacao.isPending,
  };
}

function chunk<T>(lista: T[], tamanho: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) partes.push(lista.slice(i, i + tamanho));
  return partes;
}
