ALTER POLICY comparacoes_select ON public.estatisticas_comparacoes USING (auth.uid() IS NOT NULL);
ALTER POLICY comparacoes_insert ON public.estatisticas_comparacoes WITH CHECK (private.eh_consultoria());
ALTER POLICY comparacoes_update ON public.estatisticas_comparacoes USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());
ALTER POLICY comparacoes_delete ON public.estatisticas_comparacoes USING (private.eh_consultoria());
ALTER POLICY "Autenticados leem resolucoes" ON public.resolucoes_sef USING (auth.uid() IS NOT NULL);
ALTER POLICY "Autenticados criam resolucoes" ON public.resolucoes_sef WITH CHECK (private.eh_consultoria());
ALTER POLICY "Autenticados atualizam resolucoes" ON public.resolucoes_sef USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());
ALTER POLICY "Autenticados excluem resolucoes" ON public.resolucoes_sef USING (private.eh_consultoria());