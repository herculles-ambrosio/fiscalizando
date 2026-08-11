CREATE TABLE public.modelos_oficio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  chave text NOT NULL,
  nome text NOT NULL,
  situacao text NOT NULL,
  titulo text NOT NULL DEFAULT '',
  corpo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_id, chave)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_oficio TO authenticated;
GRANT ALL ON public.modelos_oficio TO service_role;

ALTER TABLE public.modelos_oficio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve modelos permitidos" ON public.modelos_oficio
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE POLICY "cria modelos permitidos" ON public.modelos_oficio
  FOR INSERT TO authenticated WITH CHECK (private.eh_admin_municipio(municipio_id));

CREATE POLICY "edita modelos permitidos" ON public.modelos_oficio
  FOR UPDATE TO authenticated USING (private.eh_admin_municipio(municipio_id))
  WITH CHECK (private.eh_admin_municipio(municipio_id));

CREATE POLICY "exclui modelos permitidos" ON public.modelos_oficio
  FOR DELETE TO authenticated USING (private.eh_admin_municipio(municipio_id));

CREATE TRIGGER modelos_oficio_atualizado_em
  BEFORE UPDATE ON public.modelos_oficio
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

CREATE INDEX modelos_oficio_municipio_idx ON public.modelos_oficio (municipio_id, situacao);