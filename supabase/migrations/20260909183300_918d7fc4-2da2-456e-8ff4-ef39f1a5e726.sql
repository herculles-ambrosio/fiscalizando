CREATE TABLE public.educacao_metadados_indicador (
  indicador text PRIMARY KEY,
  direcao_desejada text NOT NULL DEFAULT 'maior_melhor' CHECK (direcao_desejada IN ('maior_melhor','menor_melhor')),
  etapa text,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.educacao_metadados_indicador TO authenticated;
GRANT ALL ON public.educacao_metadados_indicador TO service_role;

ALTER TABLE public.educacao_metadados_indicador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem metadados de indicadores"
ON public.educacao_metadados_indicador FOR SELECT TO authenticated USING (true);

CREATE TRIGGER educacao_metadados_indicador_atualizado_em
BEFORE UPDATE ON public.educacao_metadados_indicador
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.educacao_metadados_indicador (indicador, direcao_desejada, etapa, descricao) VALUES
  ('taxa_abandono_5ano','menor_melhor','anos_iniciais','Taxa de abandono nos anos iniciais'),
  ('taxa_abandono_9ano','menor_melhor','anos_finais','Taxa de abandono nos anos finais'),
  ('taxa_distorcao_5ano','menor_melhor','anos_iniciais','Distorção idade-série nos anos iniciais'),
  ('taxa_distorcao_9ano','menor_melhor','anos_finais','Distorção idade-série nos anos finais'),
  ('escolas_sem_acessibilidade','menor_melhor',NULL,'Escolas sem acessibilidade'),
  ('indice_vulnerabilidade_anosiniciais','menor_melhor','anos_iniciais','Vulnerabilidade nos anos iniciais'),
  ('indice_vulnerabilidade_anosfinais','menor_melhor','anos_finais','Vulnerabilidade nos anos finais');