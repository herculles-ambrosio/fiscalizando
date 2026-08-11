CREATE TABLE public.configuracoes_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_id uuid NOT NULL UNIQUE REFERENCES public.municipios(id) ON DELETE CASCADE,
  nome_prefeitura text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'ESTADO DE MINAS GERAIS',
  secretaria text NOT NULL DEFAULT 'SECRETARIA MUNICIPAL DE FAZENDA',
  setor text NOT NULL DEFAULT '',
  brasao_path text,
  endereco_rodape text NOT NULL DEFAULT '',
  cidade_data text NOT NULL DEFAULT '',
  signatario_nome text NOT NULL DEFAULT '',
  signatario_cargo text NOT NULL DEFAULT '',
  texto_assinatura text NOT NULL DEFAULT 'Secretaria Municipal da Fazenda',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_municipio TO authenticated;
GRANT ALL ON public.configuracoes_municipio TO service_role;

ALTER TABLE public.configuracoes_municipio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ve configuracoes do seu municipio"
ON public.configuracoes_municipio FOR SELECT TO authenticated
USING (municipio_id = public.meu_municipio_id());

CREATE POLICY "admin cria configuracoes do seu municipio"
ON public.configuracoes_municipio FOR INSERT TO authenticated
WITH CHECK (
  municipio_id = public.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

CREATE POLICY "admin edita configuracoes do seu municipio"
ON public.configuracoes_municipio FOR UPDATE TO authenticated
USING (
  municipio_id = public.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
)
WITH CHECK (
  municipio_id = public.meu_municipio_id()
  AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = auth.uid() AND p.papel = 'admin')
);

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER configuracoes_municipio_atualizado_em
BEFORE UPDATE ON public.configuracoes_municipio
FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();

INSERT INTO public.configuracoes_municipio
  (municipio_id, nome_prefeitura, estado, secretaria, setor, endereco_rodape, cidade_data, texto_assinatura)
SELECT
  id,
  'PREFEITURA MUNICIPAL DE NANUQUE',
  'ESTADO DE MINAS GERAIS',
  'SECRETARIA MUNICIPAL DE FAZENDA',
  'SETOR DE TRIBUTAÇÃO E FISCALIZAÇÃO DE RENDAS',
  'Rua Francisco Romualdo de Aquino, 155 – Palmeiras',
  'Nanuque/MG',
  'Secretaria Municipal da Fazenda'
FROM public.municipios
WHERE nome = 'Nanuque'
ON CONFLICT (municipio_id) DO NOTHING;