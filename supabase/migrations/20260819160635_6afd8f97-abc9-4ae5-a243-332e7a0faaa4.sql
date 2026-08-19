CREATE TABLE public.evolucoes_salvas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  observacao text,
  vaf_referencia text,
  arquivo_base_nome text NOT NULL,
  arquivo_atual_nome text NOT NULL,
  base jsonb NOT NULL,
  atual jsonb NOT NULL,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evolucoes_salvas TO authenticated;
GRANT ALL ON public.evolucoes_salvas TO service_role;

ALTER TABLE public.evolucoes_salvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve evolucoes permitidas" ON public.evolucoes_salvas
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE POLICY "grava evolucoes permitidas" ON public.evolucoes_salvas
  FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id) AND criado_por = auth.uid());

CREATE POLICY "atualiza evolucoes permitidas" ON public.evolucoes_salvas
  FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));

CREATE POLICY "exclui evolucoes permitidas" ON public.evolucoes_salvas
  FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE INDEX evolucoes_salvas_municipio_idx ON public.evolucoes_salvas (municipio_id, criado_em DESC);

CREATE TRIGGER evolucoes_salvas_atualizado_em BEFORE UPDATE ON public.evolucoes_salvas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();