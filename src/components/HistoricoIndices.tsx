import { useMemo, useState } from "react";
import { Eye, History, Loader2, RefreshCw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarData, formatarMoeda } from "@/lib/format";
import { formatarIndice } from "@/lib/vaf/indice";
import { ordemExercicioRemessa, rotuloExercicioRemessa, rotuloRemessa } from "@/lib/vaf/tipoRetorno";
import {
  statusDetalhamento,
  useCargasComRetorno,
  useExcluirIndice,
  useIndicesSalvos,
  useRevalidarDetalhamento,
  type IndiceSalvo,
  type StatusDetalhamento,
} from "@/hooks/useIndicesHistorico";
import { IndiceAplicadoBase } from "@/components/vaf/IndiceAplicado";
import { toast } from "sonner";

type Comparacao = {
  exercicio: number;
  provisorio: IndiceSalvo | null;
  definitivo: IndiceSalvo | null;
};

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="font-mono text-sm">{valor}</span>
    </div>
  );
}

function DetalheIndice({
  registro,
  onOpenChange,
}: {
  registro: IndiceSalvo | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  return (
    <Dialog open={!!registro} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {registro && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                Índice {rotuloExercicioRemessa(registro.exercicio, registro.competencia_mes)}
                <Badge variant={registro.tipo_indice === "definitivo" ? "default" : "secondary"}>
                  {registro.tipo_indice === "definitivo"
                    ? "Definitivo"
                    : registro.estimado
                      ? "Projeção"
                      : "Provisório"}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {registro.arquivo_nome ?? "sem arquivo"} · salvo em{" "}
                {new Date(registro.criado_em).toLocaleString("pt-BR")}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              <Linha rotulo="Índice" valor={formatarIndice(Number(registro.indice))} />
              <Linha rotulo="Valor líquido" valor={formatarMoeda(Number(registro.valor_liquido))} />
              <Linha rotulo="VAF próprio" valor={formatarMoeda(Number(registro.vaf_proprio))} />
              <Linha rotulo="VAF estadual" valor={formatarMoeda(Number(registro.vaf_estadual))} />
              <Linha
                rotulo="Crédito externo"
                valor={formatarMoeda(Number(registro.credito_externo))}
              />
              <Linha
                rotulo="Crédito interno"
                valor={formatarMoeda(Number(registro.credito_interno))}
              />
              <Linha
                rotulo="Crédito próprio (AF/SIARE)"
                valor={formatarMoeda(Number(registro.credito_proprio))}
              />
              <Linha rotulo="Débito" valor={formatarMoeda(Number(registro.debito))} />
              <Linha
                rotulo="Acerto de crédito"
                valor={formatarMoeda(Number(registro.acerto_credito))}
              />
              <Linha
                rotulo="Acerto de débito"
                valor={formatarMoeda(Number(registro.acerto_debito))}
              />
              <Linha rotulo="Declarações" valor={registro.total_declaracoes} />
              <Linha rotulo="Remessa" valor={rotuloRemessa(registro.competencia_mes)} />
              <Linha rotulo="Entrega" valor={registro.competencia_ano ?? "—"} />
              <Linha
                rotulo="Período apurado"
                valor={
                  registro.periodo_inicio && registro.periodo_fim
                    ? `${formatarData(registro.periodo_inicio)} a ${formatarData(registro.periodo_fim)}`
                    : "—"
                }
              />
              <Linha
                rotulo="Origem do VAF estadual"
                valor={registro.origem_vaf_estadual ?? "—"}
              />
              <Linha
                rotulo="Fator de calibragem"
                valor={Number(registro.fator_calibragem).toLocaleString("pt-BR", {
                  maximumFractionDigits: 4,
                })}
              />
              <Linha
                rotulo="Origem do crédito próprio"
                valor={
                  registro.origem_credito_proprio === "planilha"
                    ? (registro.arquivo_credito_proprio ?? "Portal do VAF")
                    : "Arquivo de retorno"
                }
              />
              <Linha
                rotulo="Apuração vinculada"
                valor={registro.carga_id ? "Sim" : "—"}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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

export function HistoricoIndices({
  municipioId,
  onCarregar,
}: {
  municipioId: string | null;
  onCarregar?: (registro: IndiceSalvo) => void;
}) {
  const { data: registros = [], isLoading } = useIndicesSalvos(municipioId);
  const { data: cargasRetorno = [] } = useCargasComRetorno(municipioId);
  const revalidar = useRevalidarDetalhamento(municipioId);

  const situacoes = useMemo(() => {
    const mapa = new Map<string, StatusDetalhamento>();
    for (const r of registros) mapa.set(r.id, statusDetalhamento(r, cargasRetorno));
    return mapa;
  }, [registros, cargasRetorno]);

  const pendentes = useMemo(
    () => registros.filter((r) => situacoes.get(r.id) === "reconstruivel"),
    [registros, situacoes],
  );

  async function revalidarUm(r: IndiceSalvo) {
    try {
      await revalidar.um.mutateAsync({ registro: r, cargas: cargasRetorno });
      toast.success("Detalhamento reconstruído a partir do arquivo guardado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reconstruir o detalhamento.");
    }
  }

  async function revalidarTodos() {
    const { ok, falhas } = await revalidar.lote.mutateAsync({
      registros: pendentes,
      cargas: cargasRetorno,
    });
    if (ok) toast.success(`${ok} índice(s) com detalhamento reconstruído.`);
    if (falhas) toast.error(`${falhas} índice(s) não puderam ser reconstruídos.`);
  }
  const excluir = useExcluirIndice(municipioId);
  const [aExcluir, setAExcluir] = useState<IndiceSalvo | null>(null);
  const [detalhe, setDetalhe] = useState<IndiceSalvo | null>(null);

  // clique na linha: carrega o índice na tela (quando o pai suporta) ou abre o detalhe
  const abrir = (r: IndiceSalvo | null) => {
    if (!r) return;
    if (onCarregar) onCarregar(r);
    else setDetalhe(r);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de índices ({registros.length})
          </CardTitle>
          {pendentes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={revalidar.lote.isPending}
              onClick={revalidarTodos}
            >
              {revalidar.lote.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              Revalidar pendentes ({pendentes.length})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {comparacoes[0] && (
          <IndiceAplicadoBase
            className="mb-4"
            municipioId={municipioId}
            exercicioAplicacao={comparacoes[0].exercicio + 2}
            indiceApurado={Number(
              (comparacoes[0].definitivo ?? comparacoes[0].provisorio)?.indice ?? 0,
            )}
            rotuloApurado={`índice de ${comparacoes[0].exercicio}`}
          />
        )}
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
                    <TableRow
                      key={c.exercicio}
                      className="cursor-pointer"
                      title={onCarregar ? "Carregar este índice na tela" : "Abrir detalhes do índice"}
                      onClick={() => abrir(c.definitivo ?? c.provisorio)}
                    >
                      <TableCell className="font-medium">{c.exercicio}</TableCell>
                      <TableCell
                        onClick={(e) => {
                          if (!c.provisorio) return;
                          e.stopPropagation();
                          abrir(c.provisorio);
                        }}
                      >
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
                      <TableCell
                        className="font-mono"
                        onClick={(e) => {
                          if (!c.definitivo) return;
                          e.stopPropagation();
                          abrir(c.definitivo);
                        }}
                      >
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
                  Salve pelo menos duas remessas provisórias para ver a evolução.
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
                        labelFormatter={(l: string) => l}
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
                    <TableHead className="w-28">Remessa</TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead className="text-right">Índice</TableHead>
                    <TableHead className="text-right">Valor líquido</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Crédito próprio</TableHead>
                    <TableHead className="w-40">Detalhamento</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      title={onCarregar ? "Carregar este índice na tela" : "Abrir detalhes do índice"}
                      onClick={() => abrir(r)}
                    >
                      <TableCell>{r.exercicio}</TableCell>
                      <TableCell>
                        {rotuloRemessa(r.competencia_mes)}
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
                      <TableCell className="whitespace-nowrap text-xs">
                        {situacoes.get(r.id) === "pronto" && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600">Pronto</Badge>
                        )}
                        {situacoes.get(r.id) === "reconstruivel" && (
                          <div className="flex items-center gap-1">
                            <Badge className="bg-amber-500 hover:bg-amber-500">Reconstruível</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={revalidar.um.isPending || revalidar.lote.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                revalidarUm(r);
                              }}
                              aria-label="Revalidar detalhamento"
                              title="Revalidar detalhamento"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        )}
                        {situacoes.get(r.id) === "faltando" && (
                          <Badge variant="destructive" title="Recarregue o arquivo e salve de novo">
                            Faltando
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetalhe(r);
                          }}
                          aria-label="Ver detalhes do índice"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAExcluir(r);
                          }}
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

      <DetalheIndice registro={detalhe} onOpenChange={(o) => !o && setDetalhe(null)} />


      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              O índice{" "}
              {aExcluir
                ? `${aExcluir.tipo_indice} de ${rotuloExercicioRemessa(aExcluir.exercicio, aExcluir.competencia_mes)}`
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
