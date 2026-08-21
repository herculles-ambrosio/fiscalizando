import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarCnpj, formatarMoeda, formatarPercentual, formatarCompacto } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { formatarCodigoCnae } from "@/lib/vaf/cnae";
import {
  anoDaCarga,
  periodoDaCarga,
  variacaoPct,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { estiloTooltip } from "./MaioresContribuintes";

export type SerieDetalhe = {
  rotulo: string;
  ano: number;
  ordem: number;
  vaf: number;
  totalPeriodo: number;
  participacao: number;
  posicao: number | null;
  declarantes: number;
  situacoes: string[];
};

/** Série mensal completa de um contribuinte, com participação e posição em cada competência. */
export function detalharContribuinte(ie: string, cargas: CargaEstat[], linhas: LinhaEstat[]) {
  const periodos = cargas.map(periodoDaCarga).sort((a, b) => a.ordem - b.ordem);
  const porCarga = new Map(periodos.map((p) => [p.cargaId, p]));

  const agrupado = new Map<string, LinhaEstat[]>();
  for (const l of linhas) {
    if (!porCarga.has(l.carga_id)) continue;
    const lista = agrupado.get(l.carga_id) ?? [];
    lista.push(l);
    agrupado.set(l.carga_id, lista);
  }

  let nome: string | null = null;
  let cnpj: string | null = null;
  let cnae: string | null = null;

  const serie: SerieDetalhe[] = [];
  for (const p of periodos) {
    const doPeriodo = agrupado.get(p.cargaId) ?? [];
    const ordenado = [...doPeriodo].sort(
      (a, b) => Number(b.vaf_atual ?? 0) - Number(a.vaf_atual ?? 0),
    );
    const idx = ordenado.findIndex((l) => l.inscricao_estadual === ie);
    const alvo = idx >= 0 ? ordenado[idx]! : null;
    if (alvo) {
      nome = nome ?? alvo.nome;
      cnpj = cnpj ?? alvo.cnpj;
      cnae = cnae ?? alvo.cnae;
    }
    const totalPeriodo = doPeriodo.reduce((s, l) => s + Number(l.vaf_atual ?? 0), 0);
    const vaf = Number(alvo?.vaf_atual ?? 0);
    serie.push({
      rotulo: p.rotulo,
      ano: p.ano,
      ordem: p.ordem,
      vaf,
      totalPeriodo,
      participacao: totalPeriodo > 0 ? (vaf / totalPeriodo) * 100 : 0,
      posicao: idx >= 0 ? idx + 1 : null,
      declarantes: doPeriodo.length,
      situacoes: alvo?.situacoes ?? [],
    });
  }

  const porAno = new Map<number, { vaf: number; total: number }>();
  for (const s of serie) {
    const atual = porAno.get(s.ano) ?? { vaf: 0, total: 0 };
    atual.vaf += s.vaf;
    atual.total += s.totalPeriodo;
    porAno.set(s.ano, atual);
  }

  const total = serie.reduce((s, x) => s + x.vaf, 0);
  const comValor = serie.filter((s) => s.vaf !== 0);

  return {
    ie,
    nome,
    cnpj,
    cnae,
    serie,
    porAno: [...porAno.entries()].sort((a, b) => a[0] - b[0]),
    total,
    competenciasComValor: comValor.length,
    media: comValor.length ? total / comValor.length : 0,
    maior: comValor.reduce<SerieDetalhe | null>(
      (m, s) => (!m || s.vaf > m.vaf ? s : m),
      null,
    ),
    menor: comValor.reduce<SerieDetalhe | null>(
      (m, s) => (!m || s.vaf < m.vaf ? s : m),
      null,
    ),
  };
}

export function DetalheContribuinte({
  ie,
  cargas,
  linhas,
  ano,
  onOpenChange,
}: {
  ie: string | null;
  cargas: CargaEstat[];
  linhas: LinhaEstat[];
  /** Quando informado, a série abre restrita a esse ano; o resumo anual sempre mostra tudo. */
  ano?: number | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const dados = useMemo(
    () => (ie ? detalharContribuinte(ie, cargas, linhas) : null),
    [ie, cargas, linhas],
  );

  const serieVisivel = useMemo(() => {
    if (!dados) return [];
    return ano == null ? dados.serie : dados.serie.filter((s) => s.ano === ano);
  }, [dados, ano]);

  const totalVisivel = serieVisivel.reduce((s, x) => s + x.vaf, 0);
  const totalGeralVisivel = serieVisivel.reduce((s, x) => s + x.totalPeriodo, 0);

  function exportar() {
    if (!dados) return;
    const csv = montarCsv(
      [
        "Arquivo / exercício",
        "VAF do contribuinte",
        "VAF total do arquivo",
        "Participação %",
        "Posição no ranking",
        "Declarantes",
        "Situações",
      ],
      serieVisivel.map((s) => [
        s.rotulo,
        s.vaf.toFixed(2),
        s.totalPeriodo.toFixed(2),
        s.participacao.toFixed(2),
        s.posicao ?? "",
        s.declarantes,
        s.situacoes.join(" / "),
      ]),
    );
    baixarCsv(`detalhe-${dados.ie}${ano ? `-${ano}` : ""}.csv`, csv);
  }

  return (
    <Dialog open={!!ie} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        {dados && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">
                {dados.nome ?? `IE ${dados.ie}`}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>IE {dados.ie}</span>
                {dados.cnpj && <span>CNPJ {formatarCnpj(dados.cnpj)}</span>}
                {dados.cnae && <span>CNAE {formatarCodigoCnae(dados.cnae)}</span>}
                {ano != null && <Badge variant="secondary">Série de {ano}</Badge>}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Resumo rotulo="VAF no recorte" valor={formatarMoeda(totalVisivel)} />
                  <Resumo
                    rotulo="Participação no recorte"
                    valor={
                      totalGeralVisivel > 0
                        ? `${((totalVisivel / totalGeralVisivel) * 100).toFixed(2)}%`
                        : "—"
                    }
                  />
                  <Resumo
                    rotulo="Média por arquivo"
                    valor={formatarMoeda(
                      serieVisivel.filter((s) => s.vaf !== 0).length
                        ? totalVisivel / serieVisivel.filter((s) => s.vaf !== 0).length
                        : 0,
                    )}
                  />
                  <Resumo
                    rotulo="Melhor arquivo"
                    valor={
                      dados.maior ? `${dados.maior.rotulo} · ${formatarMoeda(dados.maior.vaf)}` : "—"
                    }
                  />
                </div>

                <div className="h-64 rounded-xl border p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serieVisivel} margin={{ left: -8, right: 8 }}>
                      <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="rotulo"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="var(--muted-foreground)"
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="var(--muted-foreground)"
                        tickFormatter={formatarCompacto}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                        contentStyle={estiloTooltip}
                        formatter={(v: number, _n, item) => [
                          `${formatarMoeda(v)} · ${(item?.payload?.participacao ?? 0).toFixed(2)}% do VAF`,
                          "VAF",
                        ]}
                      />
                      <Bar dataKey="vaf" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo / exercício</TableHead>
                        <TableHead className="text-right">VAF do contribuinte</TableHead>
                        <TableHead className="text-right">VAF do arquivo</TableHead>
                        <TableHead className="text-right">Participação</TableHead>
                        <TableHead className="text-right">Posição</TableHead>
                        <TableHead>Situações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serieVisivel.map((s) => (
                        <TableRow key={s.rotulo}>
                          <TableCell className="font-medium">{s.rotulo}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatarMoeda(s.vaf)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {formatarMoeda(s.totalPeriodo)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.totalPeriodo > 0 ? `${s.participacao.toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.posicao ? `${s.posicao}º de ${s.declarantes}` : "—"}
                          </TableCell>
                          <TableCell className="space-x-1">
                            {s.situacoes.length ? (
                              s.situacoes.map((x) => (
                                <Badge key={x} variant="outline" className="text-[10px]">
                                  {x}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total do recorte</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarMoeda(totalVisivel)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarMoeda(totalGeralVisivel)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {totalGeralVisivel > 0
                            ? `${((totalVisivel / totalGeralVisivel) * 100).toFixed(2)}%`
                            : "—"}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>

                {dados.porAno.length > 1 && (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ano</TableHead>
                          <TableHead className="text-right">VAF do contribuinte</TableHead>
                          <TableHead className="text-right">Participação no ano</TableHead>
                          <TableHead className="text-right">Variação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dados.porAno.map(([a, v], i) => {
                          const anterior = i > 0 ? dados.porAno[i - 1]![1].vaf : 0;
                          const varia = variacaoPct(v.vaf, anterior);
                          return (
                            <TableRow key={a}>
                              <TableCell className="font-medium">{a}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatarMoeda(v.vaf)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {v.total > 0 ? `${((v.vaf / v.total) * 100).toFixed(2)}%` : "—"}
                              </TableCell>
                              <TableCell
                                className={`text-right tabular-nums ${
                                  (varia ?? 0) < 0
                                    ? "text-omisso-foreground"
                                    : "text-normal-foreground"
                                }`}
                              >
                                {i === 0 ? "—" : formatarPercentual(varia)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" onClick={exportar}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar série CSV
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{rotulo}</p>
      <p className="mt-1 font-display text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

/** Anos disponíveis nas cargas (útil para restringir a série). */
export function anosDisponiveis(cargas: CargaEstat[]): number[] {
  return [...new Set(cargas.map(anoDaCarga))].sort((a, b) => b - a);
}
