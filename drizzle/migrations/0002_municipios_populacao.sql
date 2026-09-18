CREATE TABLE public.municipios_populacao (
  codigo_ibge text NOT NULL,
  ano integer NOT NULL,
  nome text NOT NULL,
  uf text NOT NULL DEFAULT 'MG',
  populacao integer NOT NULL,
  fonte text NOT NULL DEFAULT 'IBGE',
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (codigo_ibge, ano)
);

CREATE INDEX municipios_populacao_ano_idx ON public.municipios_populacao (ano);

GRANT SELECT ON public.municipios_populacao TO authenticated;
GRANT ALL ON public.municipios_populacao TO service_role;

ALTER TABLE public.municipios_populacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "populacao leitura autenticada"
ON public.municipios_populacao FOR SELECT TO authenticated USING (true);
