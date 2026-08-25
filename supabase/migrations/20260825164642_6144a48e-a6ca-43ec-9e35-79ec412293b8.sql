CREATE TABLE public.situacoes_receita (
  cnpj text PRIMARY KEY,
  situacao text NOT NULL,
  situacao_data date,
  motivo text,
  razao_social text,
  nome_fantasia text,
  uf text,
  municipio text,
  cnae_principal text,
  fonte text NOT NULL,
  payload jsonb,
  consultado_em timestamp with time zone NOT NULL DEFAULT now(),
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.situacoes_receita TO authenticated;
GRANT ALL ON public.situacoes_receita TO service_role;

ALTER TABLE public.situacoes_receita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler situacoes da Receita"
  ON public.situacoes_receita FOR SELECT TO authenticated USING (true);

CREATE TRIGGER situacoes_receita_atualizado_em
  BEFORE UPDATE ON public.situacoes_receita
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
