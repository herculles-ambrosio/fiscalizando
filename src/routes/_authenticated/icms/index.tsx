import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { VazioIcms } from "@/components/icms/VazioIcms";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { montarDiagnostico, ROTULO_SITUACAO } from "@/lib/icms/diagnostico";
import { MESES } from "@/lib/icms/criterios";
import { formatarCompacto, formatarMoeda } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/icms/")({
  head: () => ({
    meta: [
      { title: "Painel do ICMS — Lei Robin Hood" },
      {
        name: "description",
        content:
          "Índice de participação, repasse do ano e desempenho do município em cada critério da Lei 18.030/2009.",
      },
      { property: "og:title", content: "Painel do ICMS — Lei Robin Hood" },
      {
        property: "og:description",
        content: "Acompanhe os 18 critérios de distribuição do ICMS aos municípios de Minas Gerais.",
      },
    ],
  }),
  component: PainelIcms,
});

function PainelIcms() {
  const { municipio } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0] ?? null);
    }
  }, [exercicios, exercicio]);

  const { data: dados, isLoading } = useIcmsDados(exercicio);
  const diag = useMemo(
    () => (dados && exercicio ? montarDiagnostico(dados, exercicio) : null),
    [dados, exercicio],
  );

  const grafico = useMemo(() => {
    if (!diag) return [];
    return diag.linhas
      .filter((l) => l.valorAno > 0)
      .slice(0, 10)
      .map((l) => ({ nome: l.criterio.nome, valor: l.valorAno }));
  }, [diag]);

  if (!isLoading && (!dados || !dados.series.size)) return <VazioIcms />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Painel do ICMS</h1>
          <p className="text-sm text-muted-foreground">
            {municipio ? `${municipio.nome}/${municipio.uf} — ` : ""}critérios da Lei 18.030/2009
            (Lei Robin Hood).
          </p>
        </div>
        <SeletorExercicio
          exercicios={exercicios ?? []}
          valor={exercicio}
          aoTrocar={setExercicio}
        />
      </header>

      {diag && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              titulo="Índice de participação"
              valor={
                diag.indiceParticipacao != null
                  ? `${diag.indiceParticipacao.toLocaleString("pt-BR", { maximumFractionDigits: 7 })}%`
                  : "—"
              }
              nota={
                dados?.ultimoMes ? `Último mês apurado: ${MESES[dados.ultimoMes - 1]}` : undefined
              }
            />
            <Kpi
              titulo="Repasse no exercício"
              valor={formatarMoeda(diag.totalAno)}
              nota={`${dados?.meses.length ?? 0} meses com dados`}
            />
            <Kpi
              titulo="Valor por ponto de índice"
              valor={
                diag.valorPorPontoIndice ? formatarMoeda(diag.valorPorPontoIndice) : "—"
              }
              nota="Quanto o município recebe no ano por 1% de índice"
            />
            <Kpi
              titulo="Critérios zerados com potencial"
              valor={String(diag.oportunidades.length)}
              nota="Onde há dinheiro deixado na mesa"
              alerta={diag.oportunidades.length > 0}
            />
          </div>

          {diag.oportunidades.length > 0 && (
            <Card className="border-gold/40 bg-gold/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-gold" />
                  Oportunidades imediatas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Estes critérios estão zerados e dependem de cadastro, inscrição ou prazo — ou seja,
                  são recuperáveis:
                </p>
                <div className="flex flex-wrap gap-2">
                  {diag.oportunidades.map((o) => (
                    <Badge key={o.criterio.slug} variant="outline">
                      {o.criterio.nome}
                    </Badge>
                  ))}
                </div>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/icms/criterios">Ver o que fazer em cada critério</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maiores critérios do exercício</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} layout="vertical" margin={{ left: 24, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatarCompacto(v)} fontSize={11} />
                  <YAxis type="category" dataKey="nome" width={150} fontSize={11} />
                  <ChartTooltip
                    formatter={(v: number) => formatarMoeda(v)}
                    labelFormatter={(l) => String(l)}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {grafico.map((g) => (
                      <Cell key={g.nome} fill="var(--color-primary)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todos os critérios</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {diag.linhas.map((l) => (
                <Link
                  key={l.criterio.slug}
                  to="/icms/criterios"
                  search={{ criterio: l.criterio.slug }}
                  className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{l.criterio.nome}</p>
                    <SituacaoIcone situacao={l.situacao} />
                  </div>
                  <p className="mt-1 font-display text-lg font-semibold">
                    {formatarMoeda(l.valorAno)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.participacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do
                    repasse · {ROTULO_SITUACAO[l.situacao]}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  nota,
  alerta,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <Card className={alerta ? "border-gold/50" : undefined}>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="break-words font-display text-xl font-semibold">{valor}</p>
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}

function SituacaoIcone({ situacao }: { situacao: string }) {
  if (situacao === "queda") return <ArrowDownRight className="h-4 w-4 text-destructive" />;
  if (situacao === "alta") return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (situacao === "zerado_oportunidade")
    return <AlertTriangle className="h-4 w-4 text-gold" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}
