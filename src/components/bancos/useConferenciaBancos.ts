import { useMemo } from "react";
import { useDeclaracoesBanco, useEstban, useIfdata, useInstituicoes, usePlanoContas } from "@/hooks/useBancos";
import { montarConferencia } from "@/lib/bancos/resumo";

export function useConferenciaBancos(ano: number) {
  const { data: decl = [] } = useDeclaracoesBanco();
  const { data: estban = [] } = useEstban();
  const { data: ifdata = [] } = useIfdata();
  const { data: inst = [] } = useInstituicoes();
  const { plano } = usePlanoContas();
  return useMemo(
    () =>
      montarConferencia({
        ano,
        plano,
        declaracoes: decl.map((d) => ({ ...d, valor: Number(d.valor), aliquota_declarada: d.aliquota_declarada == null ? null : Number(d.aliquota_declarada), iss_declarado: d.iss_declarado == null ? null : Number(d.iss_declarado) })),
        estban: estban.map((e) => ({ ...e, verbete_711: e.verbete_711 == null ? null : Number(e.verbete_711) })),
        ifdata: ifdata.map((f) => ({ ...f, rendas_servicos: Number(f.rendas_servicos), participacao_pct: Number(f.participacao_pct) })),
        nomes: new Map(inst.map((i) => [i.cnpj, i.nome])),
      }),
    [ano, decl, estban, ifdata, inst, plano],
  );
}
