CREATE TABLE public.acoes_recuperacao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipio_id uuid NOT NULL REFERENCES public.municipios(id),
  carga_id uuid REFERENCES public.cargas(id) ON DELETE CASCADE,
  referencia text NOT NULL DEFAULT '',
  exercicio integer,
  acao_chave text NOT NULL,
  acao_titulo text NOT NULL DEFAULT '',
  inscricao_estadual text NOT NULL DEFAULT '',
  nome_contribuinte text,
  cnpj text,
  valor_recuperavel numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'prevista',
  observacao text,
  oficio_enviado_em timestamp with time zone,
  resposta_em timestamp with time zone,
  concluida_em timestamp with time zone,
  atualizado_por uuid,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT acoes_recuperacao_status_check CHECK (status IN ('prevista','oficio_enviado','resposta_recebida','concluida','sem_efeito'))
);

CREATE UNIQUE INDEX acoes_recuperacao_chave_unica
  ON public.acoes_recuperacao (municipio_id, referencia, acao_chave, inscricao_estadual);
CREATE INDEX acoes_recuperacao_municipio_idx ON public.acoes_recuperacao (municipio_id, referencia);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_recuperacao TO authenticated;
GRANT ALL ON public.acoes_recuperacao TO service_role;

ALTER TABLE public.acoes_recuperacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve acoes recuperacao permitidas" ON public.acoes_recuperacao
  FOR SELECT TO authenticated USING (private.pode_ver_municipio(municipio_id));
CREATE POLICY "registra acoes recuperacao" ON public.acoes_recuperacao
  FOR INSERT TO authenticated WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "atualiza acoes recuperacao" ON public.acoes_recuperacao
  FOR UPDATE TO authenticated USING (private.pode_ver_municipio(municipio_id))
  WITH CHECK (private.pode_ver_municipio(municipio_id));
CREATE POLICY "exclui acoes recuperacao" ON public.acoes_recuperacao
  FOR DELETE TO authenticated USING (private.pode_ver_municipio(municipio_id));

CREATE TRIGGER acoes_recuperacao_atualizado_em
  BEFORE UPDATE ON public.acoes_recuperacao
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();