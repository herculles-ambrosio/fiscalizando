ALTER TABLE public.criterio_importacoes ADD COLUMN competencia text, ADD COLUMN identidade_fonte text, ADD COLUMN hash_arquivo text;
ALTER TABLE public.criterio_item_municipio ADD COLUMN identidade_fonte text;
CREATE INDEX criterio_importacoes_ambiente_fonte_idx ON public.criterio_importacoes (criterio, ano_base, fonte_relatorio, identidade_fonte);
CREATE INDEX criterio_item_ambiente_fonte_idx ON public.criterio_item_municipio (criterio, ano_base, fonte_relatorio, identidade_fonte);
COMMENT ON COLUMN public.criterio_importacoes.competencia IS 'Período ou natureza da publicação ambiental, separado do exercício e da versão.';
COMMENT ON COLUMN public.criterio_importacoes.identidade_fonte IS 'URL ou nome do arquivo normalizado para identificar recargas da mesma publicação.';
COMMENT ON COLUMN public.criterio_importacoes.hash_arquivo IS 'SHA-256 dos bytes do relatório para impedir importações idênticas.';
COMMENT ON COLUMN public.criterio_item_municipio.identidade_fonte IS 'Identidade da publicação que produziu este item para substituir recargas sem somar cópias.';