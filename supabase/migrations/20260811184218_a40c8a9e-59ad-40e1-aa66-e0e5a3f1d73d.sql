CREATE TABLE public.oficios_emitidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL REFERENCES public.municipios(id),
  carga_id uuid REFERENCES public.cargas(id) ON DELETE SET NULL,
  contribuinte_id uuid REFERENCES public.contribuintes_apurados(id) ON DELETE SET NULL,
  inscricao_estadual text NOT NULL,
  cnpj text,
  nome_contribuinte text,
  exercicio integer NOT NULL,
  modelo_chave text NOT NULL,
  modelo_nome text NOT NULL,
  situacao text NOT NULL DEFAULT 'GERAL',
  tipo_emissao text NOT NULL DEFAULT 'individual',
  arquivo_nome text,
  status_download text NOT NULL DEFAULT 'gerado',
  erro_mensagem text,
  emitido_por uuid,
  emitido_por_nome text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  baixado_em timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios_emitidos TO authenticated;
GRANT ALL ON public.oficios_emitidos TO service_role;

ALTER TABLE public.oficios_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve oficios emitidos permitidos" ON public.oficios_emitidos
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE POLICY "registra oficios emitidos" ON public.oficios_emitidos
  FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id) AND emitido_por = auth.uid());

CREATE POLICY "atualiza oficios emitidos" ON public.oficios_emitidos
  FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id)) WITH CHECK (private.pode_ver_municipio(municipio_id));

CREATE POLICY "exclui oficios emitidos" ON public.oficios_emitidos
  FOR DELETE TO authenticated USING (private.eh_admin_municipio(municipio_id));

CREATE INDEX oficios_emitidos_municipio_idx ON public.oficios_emitidos (municipio_id, criado_em DESC);
CREATE INDEX oficios_emitidos_contribuinte_idx ON public.oficios_emitidos (municipio_id, inscricao_estadual, criado_em DESC);
CREATE INDEX oficios_emitidos_carga_idx ON public.oficios_emitidos (carga_id);