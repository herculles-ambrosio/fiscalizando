CREATE OR REPLACE FUNCTION public.educacao_outliers(
  p_exercicio integer,
  p_versao text,
  p_limite numeric DEFAULT 40
)
RETURNS TABLE (mun text, mun_nome text, fora integer, total integer, piores jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT d.municipio, d.municipio_nome, d.coluna_origem, d.valor_num
    FROM public.educacao_dados_constitutivos d
    WHERE d.exercicio = p_exercicio
      AND d.fonte_versao = p_versao
      AND d.valor_num IS NOT NULL
  ),
  med AS (
    SELECT b.coluna_origem, AVG(b.valor_num) AS m
    FROM base b
    GROUP BY b.coluna_origem
  ),
  dif AS (
    SELECT b.municipio, b.municipio_nome, b.coluna_origem, b.valor_num, med.m,
      CASE WHEN med.m IS NULL OR med.m = 0 THEN NULL
           ELSE (b.valor_num - med.m) / ABS(med.m) * 100 END AS d
    FROM base b
    JOIN med ON med.coluna_origem = b.coluna_origem
  ),
  marcado AS (
    SELECT dif.*,
      ROW_NUMBER() OVER (PARTITION BY dif.municipio ORDER BY ABS(dif.d) DESC NULLS LAST) AS rn
    FROM dif
  )
  SELECT
    marcado.municipio,
    MIN(marcado.municipio_nome),
    COUNT(*) FILTER (WHERE ABS(marcado.d) >= p_limite)::integer,
    COUNT(*)::integer,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'coluna', marcado.coluna_origem,
          'valor', marcado.valor_num,
          'media', ROUND(marcado.m::numeric, 4),
          'dif', ROUND(marcado.d::numeric, 1)
        ) ORDER BY ABS(marcado.d) DESC
      ) FILTER (WHERE marcado.rn <= 5 AND ABS(marcado.d) >= p_limite),
      '[]'::jsonb
    )
  FROM marcado
  GROUP BY marcado.municipio
$$;

GRANT EXECUTE ON FUNCTION public.educacao_outliers(integer, text, numeric) TO authenticated;
