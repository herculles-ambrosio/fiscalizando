import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";

import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { montarDiagnostico, ROTULO_SITUACAO } from "@/lib/icms/diagnostico";
import { CRITERIOS, MESES } from "@/lib/icms/criterios";

import { formatarCompacto, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const CRITERIOS_DETALHADOS = new Set([
  "educacao",
  "patrimonio_cultural",
  "meio_ambiente",
  "esportes",
  "turismo",
]);

const ORDEM_PRINCIPAIS = [
  "educacao",
  "patrimonio_cultural",
  "meio_ambiente",
  "esportes",
  "turismo",
];

function ordenarCriterios<T extends { slug: string; nome: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const ia = ORDEM_PRINCIPAIS.indexOf(a.slug);
    const ib = ORDEM_PRINCIPAIS.indexOf(b.slug);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}


export const Route = createFileRoute("/_authenticated/icms/criterios")({
  validateSearch: (search: Record<string, unknown>) => ({
    criterio: typeof search["criterio"] === "string" ? (search["criterio"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Critérios do ICMS — base legal e desempenho" },
      {
        name: "description",
        content:
          "Base legal, órgão responsável, série mensal e ações de melhoria para cada critério da Lei Robin Hood.",
      },
      { property: "og:title", content: "Critérios do ICMS — base legal e desempenho" },
      {
        property: "og:description",
        content: "O que mede cada critério do ICMS e como o município pode melhorar a pontuação.",
      },
    ],
  }),
  component: CriteriosIcms,
});

function CriteriosIcms() {
  const { criterio: slugUrl } = Route.useSearch();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);
  const [slug, setSlug] = useState<string | null>(slugUrl || null);

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

  const linha = useMemo(() => {
    if (!diag) return null;
    return diag.linhas.find((l) => l.criterio.slug === slug) ?? diag.linhas[0] ?? null;
  }, [diag, slug]);

  const serie = useMemo(() => {
    if (!dados || !linha) return [];
    const s = dados.series.get(linha.criterio.slug);
    return MESES.map((m, i) => ({
      mes: m.slice(0, 3),
      valor: s?.valores[i] ?? null,
      indice: s?.indices[i] ?? null,
    }));
  }, [dados, linha]);

  const semDados = !isLoading && (!dados || !dados.series.size);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Critérios do ICMS</h1>
          <p className="text-sm text-muted-foreground">
            O que mede cada critério, quem apura e o que fazer para melhorar.
          </p>
        </div>
        <SeletorExercicio exercicios={exercicios ?? []} valor={exercicio} aoTrocar={setExercicio} />
      </header>

      {semDados && (
        <Card className="border-gold/40 bg-gold/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Ainda não há extrato do Robin Hood importado para esta prefeitura, então os valores
            recebidos aparecem vazios. Você já pode abrir cada critério abaixo para ver o que ele
            mede e como pontuar.
            <div className="pt-3">
              <Button asChild size="sm" variant="outline">
                <Link to="/icms/cargas">Importar extratos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Todos os critérios — abra o detalhamento de cada um
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(diag
            ? diag.linhas.map((l) => ({ criterio: l.criterio, valorAno: l.valorAno as number | null }))
            : CRITERIOS.map((criterio) => ({ criterio, valorAno: null }))
          ).map(({ criterio, valorAno }) => (
            <Card
              key={`card-${criterio.slug}`}
              className={cn(
                "flex min-h-44 flex-col justify-between",
                CRITERIOS_DETALHADOS.has(criterio.slug) &&
                  "border-emerald-500/40 bg-emerald-500/5",
              )}
            >
              <CardContent className="space-y-1 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{criterio.nome}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {CRITERIOS_DETALHADOS.has(criterio.slug) && (
                      <Badge className="bg-emerald-600 text-primary-foreground">Dados detalhados</Badge>
                    )}
                    {criterio.percentual != null && (
                      <Badge variant="secondary">{criterio.percentual}%</Badge>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{criterio.oQueMede}</p>
                <p className="text-xs text-muted-foreground">
                  Recebido no exercício: {valorAno != null ? formatarMoeda(valorAno) : "—"}
                </p>
                <div className="pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/icms/criterio/$slug" params={{ slug: criterio.slug }}>
                      Abrir detalhamento
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>



      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardContent className="max-h-[70vh] space-y-1 overflow-auto p-2">
            {diag?.linhas.map((l) => (
              <button
                key={l.criterio.slug}
                onClick={() => setSlug(l.criterio.slug)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  l.criterio.slug === linha?.criterio.slug
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-muted",
                )}
              >
                <span className="block truncate">{l.criterio.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {formatarMoeda(l.valorAno)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {linha && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{linha.criterio.nome}</CardTitle>
                  <Badge variant="outline">{ROTULO_SITUACAO[linha.situacao]}</Badge>
                  {linha.criterio.percentual != null && (
                    <Badge variant="secondary">
                      {linha.criterio.percentual.toLocaleString("pt-BR")}% do total distribuído
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{linha.criterio.oQueMede}</p>
                <dl className="grid gap-2 sm:grid-cols-3">
                  <Info rotulo="Base legal" valor={linha.criterio.baseLegal} />
                  <Info rotulo="Quem apura" valor={linha.criterio.orgao} />
                  <Info rotulo="Periodicidade" valor={linha.criterio.periodicidade} />
                </dl>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Info rotulo="Recebido no exercício" valor={formatarMoeda(linha.valorAno)} />
                  <Info
                    rotulo="Índice do último mês"
                    valor={
                      linha.indiceAtual != null
                        ? linha.indiceAtual.toLocaleString("pt-BR", { maximumFractionDigits: 7 })
                        : "—"
                    }
                  />
                  <Info
                    rotulo="Variação sobre o mês anterior"
                    valor={
                      linha.variacaoPct != null
                        ? `${linha.variacaoPct > 0 ? "+" : ""}${linha.variacaoPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                        : "—"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Série mensal do exercício</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" fontSize={11} />
                    <YAxis tickFormatter={(v) => formatarCompacto(v)} fontSize={11} />
                    <ChartTooltip formatter={(v: number) => formatarMoeda(v)} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      connectNulls
                      dot={false}
                      name="Repasse"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Como melhorar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm">
                  {linha.criterio.comoMelhorar.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm">{valor}</dd>
    </div>
  );
}
