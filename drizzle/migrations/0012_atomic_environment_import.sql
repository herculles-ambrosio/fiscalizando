CREATE OR REPLACE FUNCTION public.gravar_publicacao_ambiental(p_ano integer, p_fonte text, p_identidade text, p_competencia text, p_hash text, p_origem text, p_url text, p_arquivo_nome text, p_paginas integer, p_itens jsonb, p_nao_mapeados jsonb, p_importado_por uuid, p_importado_por_nome text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_municipios integer; v_existente uuid;
BEGIN
 IF p_ano NOT BETWEEN 2000 AND 2100 OR p_fonte NOT IN ('preliminar','definitivo') OR length(p_identidade) < 3 OR length(p_hash) <> 64 OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) > 30000 THEN RAISE EXCEPTION 'Publicação inválida'; END IF;
 SELECT id INTO v_existente FROM public.criterio_importacoes WHERE criterio = 'meio_ambiente' AND ano_base = p_ano AND fonte_relatorio = p_fonte AND hash_arquivo = p_hash LIMIT 1;
 IF v_existente IS NOT NULL THEN RETURN 'duplicado'; END IF;
 DELETE FROM public.criterio_item_municipio WHERE criterio = 'meio_ambiente' AND ano_base = p_ano AND fonte_relatorio = p_fonte AND identidade_fonte = p_identidade;
 DELETE FROM public.criterio_importacoes WHERE criterio = 'meio_ambiente' AND ano_base = p_ano AND fonte_relatorio = p_fonte AND identidade_fonte = p_identidade;
 INSERT INTO public.criterio_item_municipio (criterio, ano_base, fonte_relatorio, municipio, municipio_nome, item_nome, item_codigo, peso, pontuacao, quantidade, observacao, identidade_fonte)
 SELECT 'meio_ambiente', p_ano, p_fonte, x.municipio, x.municipio_nome, x.item_nome, x.item_codigo, x.peso, x.pontuacao, x.quantidade, x.observacao, p_identidade FROM jsonb_to_recordset(p_itens) AS x(municipio text, municipio_nome text, item_nome text, item_codigo text, peso numeric, pontuacao numeric, quantidade numeric, observacao text);
 SELECT count(DISTINCT municipio) INTO v_municipios FROM jsonb_to_recordset(p_itens) AS x(municipio text);
 INSERT INTO public.criterio_importacoes (criterio, ano_base, fonte_relatorio, origem, url, arquivo_nome, paginas, registros_ranking, registros_itens, municipios, nao_mapeados, divergencias, importado_por, importado_por_nome, competencia, identidade_fonte, hash_arquivo)
 VALUES ('meio_ambiente',p_ano,p_fonte,p_origem,p_url,p_arquivo_nome,p_paginas,0,jsonb_array_length(p_itens),v_municipios,coalesce(p_nao_mapeados,'[]'::jsonb),'[]'::jsonb,p_importado_por,p_importado_por_nome,p_competencia,p_identidade,p_hash);
 -- A tabela de Fator de Qualidade não publica o índice consolidado do critério.
 IF p_competencia <> 'Fator de Qualidade' THEN
  INSERT INTO public.criterio_ranking_municipio (criterio,ano_base,fonte_relatorio,municipio,municipio_nome,posicao,nota_final,indice_percentual)
  SELECT 'meio_ambiente',p_ano,p_fonte,i.municipio,max(i.municipio_nome),null,max(i.pontuacao),0
  FROM public.criterio_item_municipio i JOIN public.criterio_importacoes h ON h.criterio=i.criterio AND h.ano_base=i.ano_base AND h.fonte_relatorio=i.fonte_relatorio AND h.identidade_fonte=i.identidade_fonte
  WHERE i.criterio='meio_ambiente' AND i.ano_base=p_ano AND i.fonte_relatorio=p_fonte AND i.item_codigo='indice_criterio' AND i.pontuacao IS NOT NULL AND h.competencia <> 'Fator de Qualidade'
  GROUP BY i.municipio
  ON CONFLICT (criterio,ano_base,fonte_relatorio,municipio) DO UPDATE SET municipio_nome=excluded.municipio_nome,nota_final=excluded.nota_final,indice_percentual=excluded.indice_percentual;
 END IF;
 RETURN 'gravado';
END $$;
REVOKE ALL ON FUNCTION public.gravar_publicacao_ambiental(integer,text,text,text,text,text,text,text,integer,jsonb,jsonb,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gravar_publicacao_ambiental(integer,text,text,text,text,text,text,text,integer,jsonb,jsonb,uuid,text) TO service_role;