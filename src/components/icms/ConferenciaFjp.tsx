import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { montarDiagnostico } from "@/lib/icms/diagnostico";

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/**
 * Confere o índice lido no relatório oficial do critério com o repasse que o
 * município efetivamente recebeu no extrato da FJP.
 *
 * peso implícito = repasse recebido ÷ (índice do relatório × valor de 1 ponto)
 *
 * Quando esse peso implícito bate com o peso do Anexo I, o cálculo da meta está
 * calibrado; quando destoa muito, ou o índice publicado está em outra escala ou
 * o repasse do extrato inclui/exclui parcelas do critério.
 */
export function ConferenciaFjp({
  slug,
  nomeCriterio,
  pesoLegalPct,
  indiceRelatorio,
}: {
  slug: string;
  nomeCriterio: string;
  pesoLegalPct: number | null;
  indiceRelatorio: number | null;
}) {
  const { data: exercicios } = useIcmsExercicios();
  const exercicio = exercicios?.[0] ?? null;
  const { data: dados } = useIcmsDados(exercicio);

  const info = useMemo(() => {
    if (!dados || !exercicio) return null;
    const d = montarDiagnostico(dados, exercicio);
    const linha = d.linhas.find((l) => l.criterio.slug === slug) ?? null;
    const valorPonto = d.valorPorPontoIndice;
    const pesoImplicitoPct =
      linha && indiceRelatorio && valorPonto
        ? (linha.valorAno / (indiceRelatorio * valorPonto)) * 100
        : null;
    const metaRelatorio =
      indiceRelatorio != null && valorPonto != null && pesoLegalPct != null
        ? indiceRelatorio * (pesoLegalPct / 100) * valorPonto
        : null;
    return { linha, valorPonto, pesoImplicitoPct, metaRelatorio, exercicio };
  }, [dados, exercicio, slug, indiceRelatorio, pesoLegalPct]);

  if (!info?.linha) return null;
  const { linha, valorPonto, pesoImplicitoPct, metaRelatorio } = info;
  const divergente =
    pesoImplicitoPct != null &&
    pesoLegalPct != null &&
    Math.abs(pesoImplicitoPct - pesoLegalPct) / pesoLegalPct > 0.25;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Conferência com o repasse recebido ({info.exercicio})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Índice no relatório oficial</p>
            <p className="font-semibold">
              {indiceRelatorio != null
                ? indiceRelatorio.toLocaleString("pt-BR", { maximumFractionDigits: 6 })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recebido no critério</p>
            <p className="font-semibold">{moeda(linha.valorAno)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Meta pelo índice do relatório</p>
            <p className="font-semibold">{metaRelatorio != null ? moeda(metaRelatorio) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Peso implícito no repasse</p>
            <p className="font-semibold">
              {pesoImplicitoPct != null
                ? `${pesoImplicitoPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
                : "—"}
              {pesoLegalPct != null && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  legal {pesoLegalPct}%
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Valor de 1 ponto de índice no exercício: {valorPonto != null ? moeda(valorPonto) : "—"}.
          Cálculo: recebido ÷ (índice do relatório × valor do ponto) = peso implícito.
        </p>
        {divergente && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
            O peso implícito no repasse difere do peso legal do {nomeCriterio}. Confira se o
            relatório importado é do ano-base que gerou este repasse.
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
