import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
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
] as const;

function Dashboard() {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();

  const { data: carga, isLoading } = useQuery({
    queryKey: ["ultima-carga", perfil?.municipio_id],
    enabled: !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
          <CardContent className="py-14 text-center">
            <p className="text-sm text-muted-foreground">
              Envie o arquivo de contribuintes ativos e o arquivo de retorno VAF/DAMEF para começar.
            </p>
            <Button className="mt-4" onClick={() => navigate({ to: "/nova-apuracao" })}>
              Iniciar primeira apuração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CARDS.map((c) => (
              <Card key={c.chave}>
                <CardContent className="p-5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.cor}`}
                  >
                    {c.rotulo}
                  </span>
                  <p className="mt-3 font-display text-3xl font-semibold">
                    {carga[c.chave] ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    de {carga.total_ativos ?? 0} ativos
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                CNAEs com mais contribuintes em situação irregular
              </CardTitle>
              <Link
                to="/cargas/$cargaId"
                params={{ cargaId: carga.id }}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Ver contribuintes
              </Link>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ left: -16, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="cnae"
                    fontSize={11}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v, "Irregulares"]}
                  />
                  <Bar dataKey="irregulares" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
