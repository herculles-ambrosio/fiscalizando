import { useMemo, useState } from "react";
import { History, Trash2, TrendingDown, TrendingUp } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarMoeda } from "@/lib/format";
import { formatarIndice } from "@/lib/vaf/indice";
import { ordemExercicioRemessa, rotuloExercicioRemessa, rotuloRemessa } from "@/lib/vaf/tipoRetorno";
import { useExcluirIndice, useIndicesSalvos, type IndiceSalvo } from "@/hooks/useIndicesHistorico";
import { toast } from "sonner";

type Comparacao = {
  exercicio: number;
  provisorio: IndiceSalvo | null;
  definitivo: IndiceSalvo | null;
};

function Diferenca({ base, comparado }: { base: number; comparado: number }) {
  const delta = comparado - base;
  const pct = base ? (delta / base) * 100 : 0;
  const positivo = delta >= 0;
  return (
    <span
      className={
        positivo
          ? "inline-flex items-center gap-1 font-mono text-sm text-emerald-600"
          : "inline-flex items-center gap-1 font-mono text-sm text-destructive"
      }
    >
      {positivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {positivo ? "+" : "−"}
      {Math.abs(delta).toLocaleString("pt-BR", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
      })}{" "}
      ({positivo ? "+" : "−"}
      {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)
    </span>
  );
}

export function HistoricoIndices({ municipioId }: { municipioId: string | null }) {
  const { data: registros = [], isLoading } = useIndicesSalvos(municipioId);
  const excluir = useExcluirIndice(municipioId);
  const [aExcluir, setAExcluir] = useState<IndiceSalvo | null>(null);

  const comparacoes = useMemo<Comparacao[]>(() => {
    const porExercicio = new Map<number, Comparacao>();
    for (const r of registros) {
      const atual =
        porExercicio.get(r.exercicio) ??
        ({ exercicio: r.exercicio, provisorio: null, definitivo: null } as Comparacao);
      if (r.tipo_indice === "definitivo") {
        atual.definitivo = r;
      } else {
        const anterior = atual.provisorio;
        const mais_recente =
          !anterior ||
          ordemExercicioRemessa(r.exercicio, r.competencia_mes) >
            ordemExercicioRemessa(anterior.exercicio, anterior.competencia_mes);
        if (mais_recente) atual.provisorio = r;
      }
      porExercicio.set(r.exercicio, atual);
    }
    return [...porExercicio.values()].sort((a, b) => b.exercicio - a.exercicio);
  }, [registros]);

  const serie = useMemo(
    () =>
      registros
        .filter((r) => r.tipo_indice === "provisorio")
        .slice()
        .sort(
          (a, b) =>
            ordemExercicioRemessa(a.exercicio, a.competencia_mes) -
            ordemExercicioRemessa(b.exercicio, b.competencia_mes),
        )
        .map((r) => ({
          rotulo: rotuloExercicioRemessa(r.exercicio, r.competencia_mes),
          indice: Number(r.indice),
          liquido: Number(r.valor_liquido),
        })),

    [registros],
  );

  return (
    <Card className="no-print">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Histórico de índices ({registros.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}
        {!isLoading && registros.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum índice salvo ainda. Apure um arquivo e clique em "Salvar no histórico" para
            acompanhar a evolução do provisório e comparar com o definitivo.
          </p>
        )}

        {registros.length > 0 && (
          <Tabs defaultValue="comparacao">
            <TabsList>
              <TabsTrigger value="comparacao">Provisório × definitivo</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução mensal</TabsTrigger>
              <TabsTrigger value="registros">Registros</TabsTrigger>
            </TabsList>

            <TabsContent value="comparacao" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Exercício</TableHead>
                    <TableHead>Provisório (mais recente)</TableHead>
                    <TableHead>Definitivo</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead className="text-right">Líquido provisório</TableHead>
                    <TableHead className="text-right">Líquido definitivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparacoes.map((c) => (
                    <TableRow key={c.exercicio}>
                      <TableCell className="font-medium">{c.exercicio}</TableCell>
                      <TableCell>
                        {c.provisorio ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatarIndice(Number(c.provisorio.indice))}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {rotuloRemessa(c.provisorio.competencia_mes)}

                              {c.provisorio.estimado ? " · projeção" : ""}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">
                        {c.definitivo ? (
                          formatarIndice(Number(c.definitivo.indice))
                        ) : (
                          <span className="font-sans text-muted-foreground">Aguardando</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.provisorio && c.definitivo ? (
                          <Diferenca
                            base={Number(c.provisorio.indice)}
                            comparado={Number(c.definitivo.indice)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.provisorio ? formatarMoeda(Number(c.provisorio.valor_liquido)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {c.definitivo ? formatarMoeda(Number(c.definitivo.valor_liquido)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="evolucao" className="mt-4">
              {serie.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Salve pelo menos duas competências provisórias para ver a evolução.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) => v.toFixed(4).replace(".", ",")}
                        width={70}
                      />
                      <ChartTooltip
                        formatter={(v: number) => formatarIndice(Number(v))}
                        labelFormatter={(l: string) => `Competência ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="indice"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </TabsContent>

            <TabsContent value="registros" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Exercício</TableHead>
                    <TableHead className="w-28">Competência</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead className="text-right">Índice</TableHead>
                    <TableHead className="text-right">Valor líquido</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Crédito próprio</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.exercicio}</TableCell>
                      <TableCell>
                        {formatarCompetencia(r.competencia_mes, r.competencia_ano)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.tipo_indice === "definitivo" ? "default" : "secondary"}>
                          {r.tipo_indice === "definitivo"
                            ? "Definitivo"
                            : r.estimado
                              ? "Projeção"
                              : "Provisório"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarIndice(Number(r.indice))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatarMoeda(Number(r.valor_liquido))}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                        {r.arquivo_nome ?? "—"}
                        {r.carga_id ? " · vinculado à apuração" : ""}
                      </TableCell>
                      <TableCell className="max-w-[16rem] text-xs">
                        {r.origem_credito_proprio === "planilha" ? (
                          <>
                            <Badge variant="outline">Portal do VAF</Badge>
                            <span className="ml-2 block truncate font-mono text-muted-foreground">
                              {r.arquivo_credito_proprio ?? "planilha carregada"}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">
                            {Number(r.credito_proprio) > 0
                              ? "Arquivo de retorno"
                              : "Ausente no retorno"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAExcluir(r)}
                          aria-label="Excluir registro do histórico"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              O índice{" "}
              {aExcluir
                ? `${aExcluir.tipo_indice} de ${formatarCompetencia(aExcluir.competencia_mes, aExcluir.competencia_ano)}`
                : ""}{" "}
              será removido. A apuração de contribuintes não é afetada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!aExcluir) return;
                excluir.mutate(aExcluir.id, {
                  onSuccess: () => toast.success("Registro removido do histórico."),
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
                });
                setAExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Card>
  );
}
