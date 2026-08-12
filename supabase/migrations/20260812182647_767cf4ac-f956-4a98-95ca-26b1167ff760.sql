CREATE TABLE public.indices_apurados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  carga_id uuid REFERENCES public.cargas(id) ON DELETE SET NULL,
  exercicio integer NOT NULL,
  competencia_mes integer,
  competencia_ano integer,
  tipo_indice text NOT NULL DEFAULT 'provisorio',
  estimado boolean NOT NULL DEFAULT false,
  origem_vaf_estadual text,
  fator_calibragem numeric NOT NULL DEFAULT 1,
  periodo_inicio date,
  periodo_fim date,
  vaf_proprio numeric NOT NULL DEFAULT 0,
  credito_externo numeric NOT NULL DEFAULT 0,
  credito_interno numeric NOT NULL DEFAULT 0,
  credito_proprio numeric NOT NULL DEFAULT 0,
  debito numeric NOT NULL DEFAULT 0,
  acerto_credito numeric NOT NULL DEFAULT 0,
  acerto_debito numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  indice numeric NOT NULL DEFAULT 0,
  vaf_estadual numeric NOT NULL DEFAULT 0,
  total_declaracoes integer NOT NULL DEFAULT 0,
  arquivo_nome text,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT indices_apurados_tipo_check CHECK (tipo_indice IN ('provisorio','definitivo')),
  CONSTRAINT indices_apurados_mes_check CHECK (competencia_mes IS NULL OR (competencia_mes BETWEEN 1 AND 13))
);

CREATE UNIQUE INDEX indices_apurados_unico
  ON public.indices_apurados (municipio_id, exercicio, COALESCE(competencia_mes, 0), COALESCE(competencia_ano, 0), tipo_indice);

CREATE INDEX indices_apurados_municipio_exercicio ON public.indices_apurados (municipio_id, exercicio);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.indices_apurados TO authenticated;
GRANT ALL ON public.indices_apurados TO service_role;

ALTER TABLE public.indices_apurados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve indices permitidos" ON public.indices_apurados
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE POLICY "registra indices permitidos" ON public.indices_apurados
  FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));

CREATE POLICY "atualiza indices permitidos" ON public.indices_apurados
  FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id))
  WITH CHECK (private.pode_ver_municipio(municipio_id));

CREATE POLICY "exclui indices permitidos" ON public.indices_apurados
  FOR DELETE TO authenticated USING (private.eh_admin_municipio(municipio_id));

CREATE TRIGGER indices_apurados_atualizado_em
  BEFORE UPDATE ON public.indices_apurados
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();