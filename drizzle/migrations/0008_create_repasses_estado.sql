CREATE TABLE public.repasses_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercicio integer NOT NULL,
  mes smallint NOT NULL,
  transferencia_liquida numeric,
  vaf_75 numeric,
  robin_hood_25 numeric,
  fonte text NOT NULL DEFAULT 'fjp',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercicio, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repasses_estado TO authenticated;
GRANT ALL ON public.repasses_estado TO service_role;

ALTER TABLE public.repasses_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repasses estado leitura" ON public.repasses_estado
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "repasses estado escrita consultoria" ON public.repasses_estado
  FOR ALL TO authenticated USING (private.eh_consultoria()) WITH CHECK (private.eh_consultoria());

CREATE TRIGGER repasses_estado_atualizado_em
  BEFORE UPDATE ON public.repasses_estado
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();