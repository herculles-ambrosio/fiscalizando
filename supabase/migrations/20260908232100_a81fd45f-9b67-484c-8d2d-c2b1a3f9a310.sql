DELETE FROM public.criterio_itens_referencia
 WHERE criterio = 'turismo'
   AND codigo IN ('tur_nota','tur_rlpc','tur_irc','tur_nota_irc','tur_iit','tur_indice');

INSERT INTO public.criterio_itens_referencia (criterio, codigo, nome_oficial, sinonimos, peso, requisito, ordem)
VALUES
 ('turismo','tur_nota','Nota da habilitação', ARRAY['nota'], NULL, 'Nota obtida na habilitação anual junto à Secult-MG (documentação, conselho, fundo e plano de turismo).', 10),
 ('turismo','tur_rlpc','Receita líquida per capita (RLPC)', ARRAY['rlpc','receita liquida per capita'], NULL, 'Receita líquida por habitante usada no cálculo — quanto menor, maior o peso redistributivo.', 11),
 ('turismo','tur_irc','Índice de Receita e Circuito (IRC)', ARRAY['irc'], NULL, 'Faixa atribuída conforme a receita per capita e a participação em circuito turístico certificado.', 12),
 ('turismo','tur_nota_irc','Nota x IRC', ARRAY['nota x irc','nota x ir'], NULL, 'Produto da nota pela faixa IRC, base do Investimento em Turismo do Município.', 13),
 ('turismo','tur_iit','Investimento em Turismo do Município (IIT)', ARRAY['iit','investimento em turismo'], NULL, 'Resultado do município na fatia do critério antes da conversão em índice de participação.', 14),
 ('turismo','tur_indice','Índice de participação no critério', ARRAY['indice de participacao','indice definitivo de participacao','indice'], NULL, 'Índice definitivo publicado pela Secult-MG que gera o repasse do critério Turismo.', 15);
