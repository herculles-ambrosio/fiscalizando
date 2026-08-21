import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  agregarPorContribuinte,
  corSerie,
  nomeCurto,
  periodoDaCarga,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { DetalheContribuinte } from "./DetalheContribuinte";

const OPCOES_TOP = [5, 10, 20, 50];

export function MaioresContribuintes({
  cargas,
  linhas,
}: {
  cargas: CargaEstat[];
  linhas: LinhaEstat[];
}) {
  const anos = useMemo(
    () => [...new Set(cargas.map((c) => c.competencia_ano ?? c.exercicio))].sort((a, b) => b - a),
    [cargas],
  );
  const [ano, setAno] = useState<string>("");
  const [topN, setTopN] = useState<string>("10");
  const [ieDetalhe, setIeDetalhe] = useState<string | null>(null);

  const anoAtivo = ano && anos.includes(Number(ano)) ? Number(ano) : (anos[0] ?? null);
  const quantidade = Math.max(1, Math.min(200, Number(topN) || 10));

  const { ranking, totalPeriodo, periodos } = useMemo(() => {
    const doAno = cargas.filter((c) => (c.competencia_ano ?? c.exercicio) === anoAtivo);
    const periodos = doAno.map(periodoDaCarga).sort((a, b) => a.ordem - b.ordem);
    const mapa = new Map(periodos.map((p) => [p.cargaId, p]));
    const ranking = agregarPorContribuinte(
      linhas.filter((l) => mapa.has(l.carga_id)),
      mapa,
    );
    return {
      ranking,
      periodos,
      totalPeriodo: ranking.reduce((s, c) => s + c.total, 0),
    };
  }, [cargas, linhas, anoAtivo]);

  const top = ranking.slice(0, quantidade);

  const dadosBarras = top.map((c) => ({
    ie: c.ie,
    nome: nomeCurto(c.nome, c.ie, 22),
    vaf: c.total,
    participacao: totalPeriodo > 0 ? (c.total / totalPeriodo) * 100 : 0,
  }));

  const dadosMensais = periodos.map((p) => {
    const linha: Record<string, string | number> = { competencia: p.rotulo };
    top.forEach((c) => {
      linha[nomeCurto(c.nome, c.ie, 22)] = c.porPeriodo.get(p.rotulo) ?? 0;
    });
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="mb-1 block text-xs text-muted-foreground">Ano</label>
          <Select value={String(anoAtivo)} onValueChange={setAno}>
            <SelectTrigger aria-label="Ano">
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

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Empresas que mais contribuíram — {anoAtivo}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            VAF somado das competências apuradas no ano. Total do recorte:{" "}
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
          <CardTitle className="font-display text-base font-semibold">
            Valor contribuído mês a mês
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Uma linha por empresa do Top {quantidade}, por competência apurada. Clique no nome da
            empresa na legenda para abrir o detalhamento.
          </p>
        </CardHeader>
        <CardContent className="h-96 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosMensais} margin={{ left: -8, right: 16 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="competencia"
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
              <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => formatarMoeda(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {top.map((c, i) => (
                <Line
                  key={c.ie}
                  type="monotone"
                  dataKey={nomeCurto(c.nome, c.ie, 22)}
                  stroke={corSerie(i)}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">Ranking detalhado</CardTitle>
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
                <TableRow key={c.ie}>
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
