import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  pontuacaoRelatorio,
  anoBase,
}: {
  slug: string;
  nomeCriterio: string;
  pesoLegalPct: number | null;
  indiceRelatorio: number | null;
  pontuacaoRelatorio?: number | null;
  anoBase?: number | null;
}) {
  const { data: exercicios } = useIcmsExercicios();
  // A conferência só vale se o extrato e a publicação tratarem do mesmo exercício.
  const exercicio = anoBase != null && exercicios?.includes(anoBase) ? anoBase : null;
  const { data: dados } = useIcmsDados(exercicio);
  const linha = dados && exercicio ? montarDiagnostico(dados, exercicio).linhas.find((l) => l.criterio.slug === slug) : null;
  // IEPHA publica pontos e uma razão calculada sobre o maior município, não o índice de repasse FJP.
  // Para Turismo, a escala do índice extraído ainda não foi conciliada com a do extrato.
  const escalaComparavel = slug !== "patrimonio_cultural" && slug !== "turismo";
  if (anoBase == null || indiceRelatorio == null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {escalaComparavel && linha ? `Conferência com o repasse recebido (${exercicio})` : `Relatório do exercício ${anoBase}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">
              {slug === "patrimonio_cultural" ? "Pontuação publicada pelo IEPHA" : slug === "turismo" ? "Índice lido na publicação da Secult" : "Índice no relatório"}
            </p>
            <p className="font-semibold">
              {(slug === "patrimonio_cultural" ? pontuacaoRelatorio : indiceRelatorio)?.toLocaleString("pt-BR", { maximumFractionDigits: 8 }) ?? "—"}
            </p>
          </div>
          {escalaComparavel && linha && <div>
            <p className="text-xs text-muted-foreground">Recebido no critério em {exercicio}</p>
            <p className="font-semibold">{moeda(linha.valorAno)}</p>
          </div>}
        </div>
        {slug === "patrimonio_cultural" ? (
          <p className="text-xs text-muted-foreground">
            A pontuação acima é a nota do relatório de {anoBase}. O valor {indiceRelatorio.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% exibido no ranking é uma proporção calculada sobre a maior nota importada, não o índice oficial da FJP. Não é possível calcular o repasse com essa proporção.
          </p>
        ) : slug === "turismo" ? (
          <p className="text-xs text-muted-foreground">
            O índice do relatório de {anoBase} ainda não foi conciliado com a escala do extrato da FJP. A previsão monetária e o peso implícito não são exibidos até essa conferência.
          </p>
        ) : !linha ? (
          <p className="text-xs text-muted-foreground">Não há repasse do mesmo exercício ({anoBase}) para comparar com este relatório.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
