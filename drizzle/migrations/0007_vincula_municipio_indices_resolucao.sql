CREATE OR REPLACE FUNCTION public.vincular_indices_resolucao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.indices_resolucao ir
     SET municipio_id = NEW.id
   WHERE ir.municipio_id IS DISTINCT FROM NEW.id
     AND lpad(regexp_replace(ir.codigo_mun, '\D', '', 'g'), 3, '0')
       = lpad(regexp_replace(NEW.codigo_sef, '\D', '', 'g'), 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS municipios_vincula_indices_resolucao ON public.municipios;
CREATE TRIGGER municipios_vincula_indices_resolucao
AFTER INSERT OR UPDATE OF codigo_sef ON public.municipios
FOR EACH ROW EXECUTE FUNCTION public.vincular_indices_resolucao();