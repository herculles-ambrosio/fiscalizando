CREATE TABLE public.resolucoes_sef (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  data_publicacao date,
  url text,
  ano_apuracao integer NOT NULL,
  ano_aplicacao integer NOT NULL,
  ano_a integer,
  ano_b integer,
  observacao text,
  municipios integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resolucoes_sef TO authenticated;
GRANT ALL ON public.resolucoes_sef TO service_role;

ALTER TABLE public.resolucoes_sef ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem resolucoes" ON public.resolucoes_sef
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados criam resolucoes" ON public.resolucoes_sef
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam resolucoes" ON public.resolucoes_sef
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados excluem resolucoes" ON public.resolucoes_sef
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER resolucoes_sef_atualizado_em
  BEFORE UPDATE ON public.resolucoes_sef
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

ALTER TABLE public.indices_resolucao ADD COLUMN resolucao_id uuid REFERENCES public.resolucoes_sef(id) ON DELETE CASCADE;

CREATE INDEX idx_indices_resolucao_resolucao_id ON public.indices_resolucao (resolucao_id);
