import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel da apuração VAF" },
      {
        name: "description",
        content: "Resumo da última apuração VAF do município: omissos, zerados e discrepantes.",
      },
      { property: "og:title", content: "Painel da apuração VAF" },
      {
        property: "og:description",
        content: "Resumo da última apuração VAF do município com totais por situação e por CNAE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const CARDS = [
  { chave: "total_omissos", rotulo: "Omissos", cor: "bg-omisso text-omisso-foreground" },
  { chave: "total_zerados", rotulo: "Zerados", cor: "bg-zerado text-zerado-foreground" },
  { chave: "total_fora_prazo", rotulo: "Fora do prazo", cor: "bg-prazo text-prazo-foreground" },
  {
    chave: "total_discrepantes",
    rotulo: "Discrepantes",
    cor: "bg-discrepante text-discrepante-foreground",
  },
  { chave: "total_normais", rotulo: "Normais", cor: "bg-normal text-normal-foreground" },
  {
    chave: "total_simples_nacional",
    rotulo: "Simples Nacional",
    cor: "bg-secondary text-secondary-foreground",
  },
  { chave: "total_simei", rotulo: "SIMEI (MEI)", cor: "bg-accent text-accent-foreground" },
] as const;

function Dashboard() {
  const { municipioId } = useMunicipioAtivo();
  const navigate = useNavigate();

  const { data: carga, isLoading } = useQuery({
    queryKey: ["ultima-carga", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
        .eq("municipio_id", municipioId!)
        .eq("status", "concluida")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: porCnae } = useQuery({
    queryKey: ["cnae", carga?.id],
    enabled: !!carga?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("cnae, situacoes")
        .eq("carga_id", carga!.id)
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });

  const grafico = useMemo(() => {
    if (!porCnae) return [];
    const mapa = new Map<string, { cnae: string; irregulares: number; total: number }>();
    for (const linha of porCnae) {
      const cnae = linha.cnae || "sem CNAE";
      const atual = mapa.get(cnae) ?? { cnae, irregulares: 0, total: 0 };
      atual.total += 1;
      if (!(linha.situacoes as string[]).includes("NORMAL")) atual.irregulares += 1;
      mapa.set(cnae, atual);
    }
    return [...mapa.values()].sort((a, b) => b.irregulares - a.irregulares).slice(0, 10);
  }, [porCnae]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Painel</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {carga
              ? `Exercício ${carga.exercicio} · apurado em ${formatarDataHora(carga.concluida_em)}`
              : "Nenhuma apuração concluída ainda."}
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/nova-apuracao" })}>
          <FileUp className="mr-2 h-4 w-4" />
          Nova apuração
        </Button>
      </div>

      {!carga ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Envie o arquivo de contribuintes ativos e o arquivo de retorno VAF/DAMEF para começar.
            </p>
            <Button className="mt-5" onClick={() => navigate({ to: "/nova-apuracao" })}>
              Iniciar primeira apuração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {CARDS.map((c) => (
              <Card key={c.chave} className="transition-shadow hover:shadow-elevated">
                <CardContent className="p-6">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${c.cor}`}
                  >
                    {c.rotulo}
                  </span>
                  <p className="mt-4 font-display text-4xl font-extrabold tracking-tight tabular-nums">
                    {carga[c.chave] ?? 0}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/80">
                    de {carga.total_ativos ?? 0} ativos
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 p-6 pb-2">
              <CardTitle className="font-display text-base font-semibold">
                CNAEs com mais contribuintes em situação irregular
              </CardTitle>
              <Link
                to="/cargas/$cargaId"
                params={{ cargaId: carga.id }}
                className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver contribuintes
              </Link>
            </CardHeader>
            <CardContent className="h-80 p-6 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ left: -16, bottom: 24 }}>
                  <defs>
                    <linearGradient id="grad-irregulares" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="2 6"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="cnae"
                    fontSize={11}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      boxShadow: "var(--shadow-elevated)",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v, "Irregulares"]}
                  />
                  <Bar dataKey="irregulares" fill="url(#grad-irregulares)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
