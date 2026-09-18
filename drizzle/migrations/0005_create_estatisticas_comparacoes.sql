CREATE TABLE public.estatisticas_comparacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  observacao text,
  resolucao_numero text NOT NULL,
  evolucao_ids uuid[] NOT NULL DEFAULT '{}',
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estatisticas_comparacoes TO authenticated;
GRANT ALL ON public.estatisticas_comparacoes TO service_role;

ALTER TABLE public.estatisticas_comparacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comparacoes_select" ON public.estatisticas_comparacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "comparacoes_insert" ON public.estatisticas_comparacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comparacoes_update" ON public.estatisticas_comparacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comparacoes_delete" ON public.estatisticas_comparacoes FOR DELETE TO authenticated USING (true);

CREATE TRIGGER estatisticas_comparacoes_atualizado_em
BEFORE UPDATE ON public.estatisticas_comparacoes
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();