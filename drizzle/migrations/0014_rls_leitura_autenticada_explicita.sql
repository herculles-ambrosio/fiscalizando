DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public' AND cmd='SELECT' AND qual='true'
      AND tablename IN ('esportes_atividades_referencia','criterio_item_municipio','educacao_metadados_indicador','repasses_estado','esportes_ranking_municipio','noticias_fontes','criterio_relatorios_encontrados','criterio_itens_referencia','criterio_ranking_municipio','educacao_dados_constitutivos','esportes_atividade_municipio','municipios_populacao','criterio_importacoes','educacao_calendario','indices_resolucao','educacao_recursos')
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (auth.uid() IS NOT NULL)', r.policyname, r.tablename);
  END LOOP;
END $$;