/**
 * Painel de prazos de recurso do critério Educação.
 *
 * Reúne, num lugar só, todas as janelas de contestação cadastradas e mostra
 * quais municípios têm números brutos muito distantes da média estadual —
 * são esses os casos em que o recurso costuma mudar o índice.
 */

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Download, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import {
  useCalendariosEducacao,
  useOutliersEducacao,
  useVersoesEducacao,
  type VersaoEducacao,
} from "@/hooks/useEducacao";

export const Route = createFileRoute("/_authenticated/icms/prazos")({
  head: () => ({
    meta: [
      { title: "Prazos de recurso da Educação — ICMS Robin Hood" },
      {
        name: "description",
        content:
          "Todas as janelas de recurso do índice de Educação em aberto e os municípios com dados fora da média estadual.",
      },
      { property: "og:title", content: "Prazos de recurso da Educação" },
      {
        property: "og:description",
        content: "Janelas de contestação abertas e municípios com dados constitutivos fora da média.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PainelPrazos,
});

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - hoje.getTime()) / 86400000);
}

function PainelPrazos() {
  const { municipio } = useMunicipioAtivo();
  const chaveMunicipio = municipio ? normalizarMunicipio(municipio.nome) : null;

  const { data: calendarios, isLoading: carregandoCal } = useCalendariosEducacao();
  const [exercicio, setExercicio] = useState<number | null>(null);
  const [versao, setVersao] = useState<VersaoEducacao>("provisorio");
  const [limite, setLimite] = useState(40);
  const [busca, setBusca] = useState("");

  const janelas = useMemo(
    () =>
      (calendarios ?? []).map((c) => {
        const dias = c.data_limite_recurso ? diasAte(c.data_limite_recurso) : null;
        return { ...c, dias, aberta: dias != null && dias >= 0 };
      }),
    [calendarios],
  );
  const abertas = janelas.filter((j) => j.aberta);

  useEffect(() => {
    if (exercicio == null && janelas.length) {
      setExercicio((abertas[0] ?? janelas[0])!.exercicio);
    }
  }, [janelas, abertas, exercicio]);

  const { data: outliers, isLoading: carregandoOut } = useOutliersEducacao(
    exercicio,
    versao,
    limite,
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = (outliers ?? []).filter((o) => o.fora > 0);
    return termo ? base.filter((o) => o.municipioNome.toLowerCase().includes(termo)) : base;
  }, [outliers, busca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Prazos de recurso da Educação</h1>
          <p className="text-sm text-muted-foreground">
            Janelas de contestação do índice provisório e municípios com números fora da média do
            Estado.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/icms/criterio/$slug" params={{ slug: "educacao" }}>
            Abrir critério Educação
          </Link>
        </Button>
      </div>

      {carregandoCal ? (
        <p className="text-sm text-muted-foreground">Carregando calendários…</p>
      ) : !janelas.length ? (
        <Alert>
          <CalendarClock className="size-4" />
          <AlertTitle>Nenhum calendário cadastrado</AlertTitle>
          <AlertDescription>
            Importe a planilha da Educação e informe as datas na aba “Prazo de recurso” do critério.
          </AlertDescription>
        </Alert>
      ) : abertas.length ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertTitle>
            {abertas.length === 1
              ? `Janela aberta para o exercício ${abertas[0]!.exercicio}`
              : `${abertas.length} janelas de recurso abertas`}
          </AlertTitle>
          <AlertDescription>
            {abertas
              .map(
                (j) =>
                  `${j.exercicio}: até ${formatarData(j.data_limite_recurso)} (faltam ${j.dias} ${
                    j.dias === 1 ? "dia" : "dias"
                  })`,
              )
              .join(" · ")}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CalendarClock className="size-4" />
          <AlertTitle>Nenhuma janela de recurso aberta hoje</AlertTitle>
          <AlertDescription>
            A próxima costuma abrir no fim de agosto, com a publicação do índice provisório.
          </AlertDescription>
        </Alert>
      )}

      {!!janelas.length && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calendários cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Exercício</th>
                  <th className="py-2">Provisório</th>
                  <th className="py-2">Prazo de recurso</th>
                  <th className="py-2">Definitivo</th>
                  <th className="py-2">E-mail</th>
                  <th className="py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {janelas.map((j) => (
                  <tr key={j.exercicio} className="border-b last:border-0">
                    <td className="py-2 font-medium">{j.exercicio}</td>
                    <td className="py-2">{formatarData(j.data_publicacao_provisorio)}</td>
                    <td className="py-2">{formatarData(j.data_limite_recurso)}</td>
                    <td className="py-2">{formatarData(j.data_publicacao_definitivo)}</td>
                    <td className="py-2 text-muted-foreground">{j.email_recurso}</td>
                    <td className="py-2">
                      {j.aberta ? (
                        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                          Aberta — faltam {j.dias} {j.dias === 1 ? "dia" : "dias"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Encerrada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Municípios com dados fora da média estadual</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={exercicio ? String(exercicio) : ""}
              onValueChange={(v) => setExercicio(Number(v))}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue placeholder="Exercício" />
              </SelectTrigger>
              <SelectContent>
                {janelas.map((j) => (
                  <SelectItem key={j.exercicio} value={String(j.exercicio)}>
                    {j.exercicio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={versao} onValueChange={(v) => setVersao(v as VersaoEducacao)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provisorio">Provisório</SelectItem>
                <SelectItem value="definitivo">Definitivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(limite)} onValueChange={(v) => setLimite(Number(v))}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Diferença acima de 25%</SelectItem>
                <SelectItem value="40">Diferença acima de 40%</SelectItem>
                <SelectItem value="70">Diferença acima de 70%</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Procurar município"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              disabled={!lista.length}
              onClick={() =>
                baixarCsv(
                  `educacao-fora-da-media-${exercicio}-${versao}.csv`,
                  montarCsv(
                    ["Município", "Indicadores fora da média", "Indicadores avaliados", "Casos mais extremos"],
                    lista.map((o) => [
                      o.municipioNome,
                      o.fora,
                      o.total,
                      o.piores
                        .map(
                          (p) =>
                            `${p.coluna} (${p.dif != null ? `${p.dif > 0 ? "+" : ""}${p.dif}%` : "—"})`,
                        )
                        .join(" | "),
                    ]),
                  ),
                )
              }
            >
              <Download className="mr-2 size-4" />
              Baixar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {carregandoOut ? (
            <p className="text-sm text-muted-foreground">Comparando com a média do Estado…</p>
          ) : !lista.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum município com dados fora da média nesse exercício. Se a planilha ainda não foi
              importada, faça a importação na tela do critério Educação.
            </p>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="p-2">Município</th>
                    <th className="p-2 text-right">Fora da média</th>
                    <th className="p-2">Casos mais extremos</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((o) => (
                    <tr
                      key={o.municipio}
                      className={`border-b last:border-0 ${
                        o.municipio === chaveMunicipio ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="p-2 font-medium">{o.municipioNome}</td>
                      <td className="p-2 text-right">
                        <Badge
                          className={
                            o.fora >= 5
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                              : "border-muted bg-muted text-muted-foreground"
                          }
                        >
                          {o.fora} de {o.total}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {o.piores
                          .slice(0, 3)
                          .map(
                            (p) =>
                              `${p.coluna} (${
                                p.dif != null ? `${p.dif > 0 ? "+" : ""}${p.dif}%` : "—"
                              })`,
                          )
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
