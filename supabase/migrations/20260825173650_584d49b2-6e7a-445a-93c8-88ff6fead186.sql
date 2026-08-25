CREATE TABLE public.receita_fila (
  cnpj text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  ultimo_erro text,
  proxima_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receita_fila_status_check CHECK (status IN ('pendente','concluido','desistido'))
);
CREATE INDEX receita_fila_pendentes_idx ON public.receita_fila (status, proxima_em);

GRANT SELECT ON public.receita_fila TO authenticated;
GRANT ALL ON public.receita_fila TO service_role;
ALTER TABLE public.receita_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receita_fila_leitura_autenticados" ON public.receita_fila FOR SELECT TO authenticated USING (true);

CREATE TABLE public.jobs_lease (
  chave text PRIMARY KEY,
  expira_em timestamptz NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.jobs_lease TO service_role;
ALTER TABLE public.jobs_lease ENABLE ROW LEVEL SECURITY;