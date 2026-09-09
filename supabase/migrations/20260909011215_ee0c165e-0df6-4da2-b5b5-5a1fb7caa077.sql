update public.criterio_itens_referencia set peso = v.peso
from (values
 ('ma_aterro', 20.0),
 ('ma_utc', 10.0),
 ('ma_ete', 10.0),
 ('ma_coleta', 5.45),
 ('ma_uc', 45.45),
 ('ma_mata_seca', 9.10)
) as v(codigo, peso)
where criterio_itens_referencia.criterio = 'meio_ambiente'
  and criterio_itens_referencia.codigo = v.codigo;