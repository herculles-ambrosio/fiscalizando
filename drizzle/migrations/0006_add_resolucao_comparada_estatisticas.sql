ALTER TABLE public.estatisticas_comparacoes
ADD COLUMN resolucao_comparada_numero text;

UPDATE public.estatisticas_comparacoes
SET resolucao_comparada_numero = resolucao_numero
WHERE resolucao_comparada_numero IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estatisticas_comparacoes TO authenticated;
GRANT ALL ON public.estatisticas_comparacoes TO service_role;