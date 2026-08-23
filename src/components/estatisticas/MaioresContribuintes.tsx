import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Download, ImageDown, LineChart as LineChartIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { baixarGraficoPng, baixarGraficoSvg } from "@/lib/chartExport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ROTULO_SITUACAO, type Situacao } from "@/lib/vaf/apurar";
import {
  agregarPorContribuinte,
  anoDaCarga,
  corSerie,
  nomeCurto,
  periodoDaCarga,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { DetalheContribuinte } from "./DetalheContribuinte";
import { CriterioBase } from "@/components/estatisticas/CriterioBase";

const OPCOES_TOP = [5, 10, 20, 50];

const SITUACOES_RAPIDAS: Situacao[] = [
  "NORMAL",
  "DISCREPANTE",
  "OMISSO",
  "ZERADO",
  "FORA_DO_PRAZO",
];


export function MaioresContribuintes({
  cargas,
  linhas,
}: {
  cargas: CargaEstat[];
  linhas: LinhaEstat[];
}) {
  const anos = useMemo(
    () => [...new Set(cargas.map(anoDaCarga))].sort((a, b) => b - a),
    [cargas],
  );
  const [ano, setAno] = useState<string>("");
  const [topN, setTopN] = useState<string>("10");
  const [ieDetalhe, setIeDetalhe] = useState<string | null>(null);
  const [situacoes, setSituacoes] = useState<Situacao[]>([]);
  const [tipoGrafico, setTipoGrafico] = useState<"barras" | "linha">("barras");
  const refRanking = useRef<HTMLDivElement>(null);
  const refComposicao = useRef<HTMLDivElement>(null);

  const anoAtivo = ano && anos.includes(Number(ano)) ? Number(ano) : (anos[0] ?? null);
  const quantidade = Math.max(1, Math.min(200, Number(topN) || 10));

  function alternarSituacao(s: Situacao) {
    setSituacoes((atual) =>
      atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s],
    );
  }

  const linhasFiltradas = useMemo(
    () =>
      situacoes.length
        ? linhas.filter((l) => l.situacoes?.some((s) => situacoes.includes(s as Situacao)))
        : linhas,
    [linhas, situacoes],
  );

  const { ranking, totalPeriodo, periodos, contagemPorPeriodo } = useMemo(() => {
    const doAno = cargas.filter((c) => anoDaCarga(c) === anoAtivo);
    const periodos = doAno.map(periodoDaCarga).sort((a, b) => a.ordem - b.ordem);
    const mapa = new Map(periodos.map((p) => [p.cargaId, p]));
    const doRecorte = linhasFiltradas.filter((l) => mapa.has(l.carga_id));
    const ranking = agregarPorContribuinte(doRecorte, mapa);
    const contagemPorPeriodo = new Map<string, number>();
    for (const l of doRecorte) {
      const p = mapa.get(l.carga_id)!;
      contagemPorPeriodo.set(p.rotulo, (contagemPorPeriodo.get(p.rotulo) ?? 0) + 1);
    }
    return {
      ranking,
      periodos,
      contagemPorPeriodo,
      totalPeriodo: ranking.reduce((s, c) => s + c.total, 0),
    };
  }, [cargas, linhasFiltradas, anoAtivo]);

  const top = ranking.slice(0, quantidade);

  const dadosBarras = top.map((c) => ({
    ie: c.ie,
    nome: nomeCurto(c.nome, c.ie, 22),
    vaf: c.total,
    participacao: totalPeriodo > 0 ? (c.total / totalPeriodo) * 100 : 0,
  }));

  const rotuloFiltro = situacoes.length
    ? situacoes.map((s) => ROTULO_SITUACAO[s]).join(", ")
    : "Todas as situações";

  const dadosMensais = periodos.map((p) => {
    const linha: Record<string, string | number> = {
      competencia: p.rotulo,
      __arquivo: p.mes ? `Arquivo ${p.mes}` : "Definitivo",
      __qtd: contagemPorPeriodo.get(p.rotulo) ?? 0,
    };
    let totalArquivo = 0;
    top.forEach((c) => {
      const v = c.porPeriodo.get(p.rotulo) ?? 0;
      linha[nomeCurto(c.nome, c.ie, 22)] = v;
      totalArquivo += v;
    });
    linha["__total"] = totalArquivo;
    return linha;
  });


  function exportar() {
    const csv = montarCsv(
      ["Posição", "IE", "CNPJ", "Contribuinte", "CNAE", "VAF no período", "Participação %"],
      top.map((c, i) => [
        i + 1,
        c.ie,
        c.cnpj ?? "",
        c.nome ?? "",
        formatarCodigoCnae(c.cnae),
        c.total.toFixed(2),
        totalPeriodo > 0 ? ((c.total / totalPeriodo) * 100).toFixed(2) : "0",
      ]),
    );
    baixarCsv(`maiores-contribuintes-${anoAtivo ?? "periodo"}.csv`, csv);
  }

  if (!anoAtivo) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma apuração concluída para gerar o ranking.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CriterioBase
        cargas={cargas}
        anoSelecionado={anoAtivo}
        contexto="o ranking soma o VAF de todas as remessas apuradas do exercício selecionado."
        linhas={linhas}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="mb-1 block text-xs text-muted-foreground">Exercício</label>
          <Select value={String(anoAtivo)} onValueChange={setAno}>
            <SelectTrigger aria-label="Exercício">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs text-muted-foreground">Quantidade de empresas</label>
          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger aria-label="Quantidade de empresas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_TOP.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportar} disabled={!top.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Situações:</span>
        {SITUACOES_RAPIDAS.map((s) => {
          const ativo = situacoes.includes(s);
          return (
            <Badge
              key={s}
              role="button"
              tabIndex={0}
              aria-pressed={ativo}
              variant={ativo ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => alternarSituacao(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  alternarSituacao(s);
                }
              }}
            >
              {ROTULO_SITUACAO[s]}
            </Badge>
          );
        })}
        {situacoes.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSituacoes([])}>
            Limpar filtros
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          Exibindo: {rotuloFiltro}
        </span>
      </div>


      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Empresas que mais contribuíram — {anoAtivo}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            VAF somado dos arquivos apurados no exercício. Total do recorte:{" "}
            {formatarMoeda(totalPeriodo)}.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-4" style={{ height: Math.max(320, top.length * 30 + 60) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosBarras} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
                tickFormatter={formatarCompacto}
              />
              <YAxis
                type="category"
                dataKey="nome"
                width={180}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={estiloTooltip}
                formatter={(v: number, _n, item) => [
                  `${formatarMoeda(v)} · ${(item?.payload?.participacao ?? 0).toFixed(1)}%`,
                  "VAF",
                ]}
              />
              <Bar
                dataKey="vaf"
                fill="var(--primary)"
                radius={[0, 6, 6, 0]}
                className="cursor-pointer"
                onClick={(d: { ie?: string } & Record<string, unknown>) => {
                  const ie = (d?.ie ?? (d as { payload?: { ie?: string } })?.payload?.ie) as
                    | string
                    | undefined;
                  if (ie) setIeDetalhe(ie);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="font-display text-base font-semibold">
                Composição por arquivo apurado
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {periodos.length > 1
                  ? `Arquivos do exercício ${anoAtivo} em ordem de remessa; cada série é uma empresa do Top ${quantidade} (${rotuloFiltro}). Clique na legenda ou na série para abrir o detalhamento.`
                  : `O exercício ${anoAtivo} tem só um arquivo apurado (${periodos[0]?.rotulo ?? "—"}), então não há série ao longo do ano para comparar.`}
              </p>
            </div>
            {periodos.length > 1 && (
              <div className="flex items-center gap-1 rounded-md border border-border p-1">
                <Button
                  size="sm"
                  variant={tipoGrafico === "barras" ? "secondary" : "ghost"}
                  onClick={() => setTipoGrafico("barras")}
                >
                  <BarChart3 className="mr-1.5 h-4 w-4" />
                  Barras empilhadas
                </Button>
                <Button
                  size="sm"
                  variant={tipoGrafico === "linha" ? "secondary" : "ghost"}
                  onClick={() => setTipoGrafico("linha")}
                >
                  <LineChartIcon className="mr-1.5 h-4 w-4" />
                  Linha
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={periodos.length > 1 ? "h-[26rem] p-6 pt-4" : "p-6 pt-2"}>
          {periodos.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosMensais} margin={{ left: -8, right: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="__arquivo"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
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
                  wrapperStyle={{ outline: "none" }}
                  content={<TooltipComposicao rotuloFiltro={rotuloFiltro} />}
                />
                <Legend
                  verticalAlign="bottom"
                  align="left"
                  wrapperStyle={{ fontSize: 11, cursor: "pointer", paddingTop: 8 }}
                  onClick={(e: { dataKey?: unknown; value?: unknown }) => {
                    const alvo = String(e?.dataKey ?? e?.value ?? "");
                    const achado = top.find((c) => nomeCurto(c.nome, c.ie, 22) === alvo);
                    if (achado) setIeDetalhe(achado.ie);
                  }}
                />
                {top.map((c, i) =>
                  tipoGrafico === "barras" ? (
                    <Bar
                      key={c.ie}
                      stackId="vaf"
                      dataKey={nomeCurto(c.nome, c.ie, 22)}
                      fill={corSerie(i)}
                      className="cursor-pointer"
                      onClick={() => setIeDetalhe(c.ie)}
                    />
                  ) : (
                    <Line
                      key={c.ie}
                      type="monotone"
                      dataKey={nomeCurto(c.nome, c.ie, 22)}
                      stroke={corSerie(i)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5, onClick: () => setIeDetalhe(c.ie) }}
                    />
                  ),
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Assim que uma segunda remessa do exercício {anoAtivo} for apurada, este bloco passa a
              mostrar a evolução arquivo a arquivo. Por enquanto, use o ranking acima — ele já traz
              todo o valor apurado em {periodos[0]?.rotulo ?? "—"}.
            </p>
          )}
        </CardContent>
      </Card>



      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">Ranking detalhado</CardTitle>
          <p className="text-xs text-muted-foreground">
            Clique em uma empresa para ver a série mensal completa e o detalhamento da participação.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Contribuinte</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>CNAE</TableHead>
                <TableHead className="text-right">VAF</TableHead>
                <TableHead className="text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((c, i) => (
                <TableRow
                  key={c.ie}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setIeDetalhe(c.ie)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIeDetalhe(c.ie);
                    }
                  }}
                >
                  <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.nome ?? `IE ${c.ie}`}</TableCell>
                  <TableCell className="tabular-nums">{formatarCnpj(c.cnpj)}</TableCell>
                  <TableCell>{formatarCodigoCnae(c.cnae)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarMoeda(c.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totalPeriodo > 0 ? `${((c.total / totalPeriodo) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Soma do Top {top.length}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarMoeda(top.reduce((s, c) => s + c.total, 0))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totalPeriodo > 0
                    ? formatarPercentual(
                        (top.reduce((s, c) => s + c.total, 0) / totalPeriodo) * 100,
                      ).replace("+", "")
                    : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <DetalheContribuinte
        ie={ieDetalhe}
        cargas={cargas}
        linhas={linhas}
        ano={anoAtivo}
        onOpenChange={(aberto) => !aberto && setIeDetalhe(null)}
      />
    </div>
  );
}

type ItemTooltip = { name?: string; value?: number; color?: string };

function TooltipComposicao({
  active,
  payload,
  label,
  rotuloFiltro,
}: {
  active?: boolean;
  payload?: ItemTooltip[];
  label?: string;
  rotuloFiltro: string;
}) {
  if (!active || !payload?.length) return null;
  const itens = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const meta = (payload[0] as unknown as { payload?: Record<string, unknown> })?.payload ?? {};
  const totalArquivo = Number(meta["__total"] ?? 0);
  const qtd = Number(meta["__qtd"] ?? 0);
  const competencia = String(meta["competencia"] ?? label ?? "");

  return (
    <div style={estiloTooltip} className="px-3 py-2">
      <p className="font-medium">{competencia}</p>
      <p className="text-muted-foreground">
        {rotuloFiltro} · {qtd.toLocaleString("pt-BR")} contribuinte(s) no arquivo
      </p>
      <div className="mt-2 space-y-0.5">
        {itens.map((i) => (
          <div key={i.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: i.color }}
            />
            <span className="flex-1 truncate">{i.name}</span>
            <span className="tabular-nums">
              {formatarMoeda(i.value ?? 0)}
              {totalArquivo > 0
                ? ` · ${(((i.value ?? 0) / totalArquivo) * 100).toFixed(1)}%`
                : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-border pt-1 tabular-nums">
        Total exibido no arquivo: {formatarMoeda(totalArquivo)}
      </p>
    </div>
  );
}



export const estiloTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "var(--shadow-elevated)",
  fontSize: 12,
  maxWidth: 320,
  whiteSpace: "normal" as const,
};
