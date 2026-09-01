CREATE TABLE public.icms_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('indice_anual','transferencia_anual','comparativo')),
  exercicio integer NOT NULL CHECK (exercicio BETWEEN 1991 AND 2100),
  arquivo_nome text NOT NULL,
  origem text NOT NULL DEFAULT 'upload' CHECK (origem IN ('upload','fjp')),
  linhas integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_cargas TO authenticated;
GRANT ALL ON public.icms_cargas TO service_role;
ALTER TABLE public.icms_cargas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icms_cargas_select" ON public.icms_cargas FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_cargas_insert" ON public.icms_cargas FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_cargas_update" ON public.icms_cargas FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_cargas_delete" ON public.icms_cargas FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE TABLE public.icms_indices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  carga_id uuid REFERENCES public.icms_cargas(id) ON DELETE SET NULL,
  exercicio integer NOT NULL,
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  criterio text NOT NULL,
  indice numeric,
  valor numeric,
  fonte text NOT NULL DEFAULT 'upload',
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, exercicio, mes, criterio)
);
CREATE INDEX icms_indices_municipio_exercicio ON public.icms_indices (municipio_id, exercicio);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_indices TO authenticated;
GRANT ALL ON public.icms_indices TO service_role;
ALTER TABLE public.icms_indices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icms_indices_select" ON public.icms_indices FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_indices_insert" ON public.icms_indices FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_indices_update" ON public.icms_indices FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_indices_delete" ON public.icms_indices FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE TABLE public.icms_comparativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  carga_id uuid REFERENCES public.icms_cargas(id) ON DELETE SET NULL,
  exercicio integer NOT NULL,
  mes smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  criterio text NOT NULL DEFAULT 'vaf',
  municipio_nome text NOT NULL,
  valor numeric,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, exercicio, mes, criterio, municipio_nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_comparativo TO authenticated;
GRANT ALL ON public.icms_comparativo TO service_role;
ALTER TABLE public.icms_comparativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icms_comparativo_select" ON public.icms_comparativo FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_comparativo_insert" ON public.icms_comparativo FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_comparativo_update" ON public.icms_comparativo FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_comparativo_delete" ON public.icms_comparativo FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE TABLE public.icms_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  exercicio integer NOT NULL,
  criterio text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  orgao text,
  responsavel text,
  prazo date,
  impacto_estimado numeric,
  status text NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista','em_andamento','concluida','descartada')),
  observacao text,
  criado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icms_acoes TO authenticated;
GRANT ALL ON public.icms_acoes TO service_role;
ALTER TABLE public.icms_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icms_acoes_select" ON public.icms_acoes FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_acoes_insert" ON public.icms_acoes FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_acoes_update" ON public.icms_acoes FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "icms_acoes_delete" ON public.icms_acoes FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE TRIGGER icms_acoes_atualizado_em BEFORE UPDATE ON public.icms_acoes FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();