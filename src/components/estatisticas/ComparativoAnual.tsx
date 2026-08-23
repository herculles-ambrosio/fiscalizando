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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarMoeda, formatarPercentual, formatarCompacto } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import {
  agregarPorContribuinte,
  anoDaCarga,
  cargasDoExercicio,
  corSerie,
  nomeCurto,
  periodoDaCarga,
  variacaoPct,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { estiloTooltip } from "./MaioresContribuintes";
import { DetalheContribuinte } from "./DetalheContribuinte";
import { CriterioBase } from "@/components/estatisticas/CriterioBase";

const OPCOES_TOP = [5, 10, 20];
type Modo = "agrupado" | "empilhado" | "linha";

export function ComparativoAnual({
  cargas,
  linhas,
}: {
  cargas: CargaEstat[];
  linhas: LinhaEstat[];
}) {
  const [topN, setTopN] = useState("10");
  const [modo, setModo] = useState<Modo>("agrupado");
  const [ieDetalhe, setIeDetalhe] = useState<string | null>(null);
  const quantidade = Number(topN) || 10;

  const { anos, porAno, top } = useMemo(() => {
    const anos = [...new Set(cargas.map(anoDaCarga))].sort(
      (a, b) => a - b,
    );
    const porAno = new Map<number, ReturnType<typeof agregarPorContribuinte>>();
    for (const ano of anos) {
      const doAno = cargasDoExercicio(cargas, ano);
      const mapa = new Map(doAno.map((c) => [c.id, periodoDaCarga(c)]));
      porAno.set(
        ano,
        agregarPorContribuinte(
          linhas.filter((l) => mapa.has(l.carga_id)),
          mapa,
        ),
      );
    }
    const recente = anos.length ? (porAno.get(anos[anos.length - 1]!) ?? []) : [];
    return { anos, porAno, top: recente.slice(0, quantidade) };
  }, [cargas, linhas, quantidade]);

  const totalPorAnoEmpresa = useMemo(() => {
    const mapa = new Map<string, Map<number, number>>();
    for (const [ano, lista] of porAno) {
      for (const c of lista) {
        const atual = mapa.get(c.ie) ?? new Map<number, number>();
        atual.set(ano, c.total);
        mapa.set(c.ie, atual);
      }
    }
    return mapa;
  }, [porAno]);

  const dados = anos.map((ano) => {
    const linha: Record<string, string | number> = { ano: String(ano) };
    for (const c of top) {
      linha[`empresa:${c.ie}`] = totalPorAnoEmpresa.get(c.ie)?.get(ano) ?? 0;
    }
    return linha;
  });

  const ultimo = anos[anos.length - 1];
  const penultimo = anos[anos.length - 2];

  function exportar() {
    const csv = montarCsv(
      ["IE", "Contribuinte", ...anos.map(String), "Variação último ano %"],
      top.map((c) => {
        const valores = anos.map((a) => (totalPorAnoEmpresa.get(c.ie)?.get(a) ?? 0).toFixed(2));
        const v =
          ultimo != null && penultimo != null
            ? variacaoPct(
                totalPorAnoEmpresa.get(c.ie)?.get(ultimo) ?? 0,
                totalPorAnoEmpresa.get(c.ie)?.get(penultimo) ?? 0,
              )
            : null;
        return [c.ie, c.nome ?? "", ...valores, v == null ? "" : v.toFixed(1)];
      }),
    );
    baixarCsv("comparativo-anual-contribuintes.csv", csv);
  }

  if (anos.length < 2) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          É preciso ter apurações de pelo menos dois anos para comparar. Conforme novas apurações
          anuais forem carregadas, o comparativo é montado automaticamente.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CriterioBase
        cargas={cargas}
        contexto="cada barra/linha é um exercício, somando todas as remessas apuradas naquele exercício."
        linhas={linhas}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="mb-1 block text-xs text-muted-foreground">Empresas comparadas</label>
          <Select value={topN} onValueChange={setTopN}>
            <SelectTrigger aria-label="Empresas comparadas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_TOP.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Top {n} do último ano
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <label className="mb-1 block text-xs text-muted-foreground">Visualização</label>
          <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
            <SelectTrigger aria-label="Visualização">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agrupado">Barras agrupadas</SelectItem>
              <SelectItem value="empilhado">Barras empilhadas</SelectItem>
              <SelectItem value="linha">Linhas (tendência)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportar}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Evolução ano a ano por empresa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Exercício no eixo horizontal, uma série por empresa, valor = VAF contribuído no exercício. Clique
            em uma série ou na legenda para abrir o detalhamento da empresa.
          </p>
        </CardHeader>
        <CardContent className="h-96 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {modo === "linha" ? (
              <LineChart data={dados} margin={{ left: -8, right: 16 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  tickFormatter={formatarCompacto}
                />
                <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => formatarMoeda(v)} />
                <Legend
                  wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                  onClick={(e: { dataKey?: unknown; value?: unknown }) => {
                    const alvo = String(e?.dataKey ?? "").replace(/^empresa:/, "");
                    const achado = top.find((c) => c.ie === alvo);
                    if (achado) setIeDetalhe(achado.ie);
                  }}
                />
                {top.map((c, i) => (
                  <Line
                    key={c.ie}
                    type="monotone"
                    dataKey={`empresa:${c.ie}`}
                    name={nomeCurto(c.nome, c.ie, 22)}
                    stroke={corSerie(i)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    className="cursor-pointer"
                    onClick={() => setIeDetalhe(c.ie)}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart data={dados} margin={{ left: -8, right: 16 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ano" fontSize={11} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" />
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
                  formatter={(v: number) => formatarMoeda(v)}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                  onClick={(e: { dataKey?: unknown; value?: unknown }) => {
                    const alvo = String(e?.dataKey ?? "").replace(/^empresa:/, "");
                    const achado = top.find((c) => c.ie === alvo);
                    if (achado) setIeDetalhe(achado.ie);
                  }}
                />
                {top.map((c, i) => (
                  <Bar
                    key={c.ie}
                    dataKey={`empresa:${c.ie}`}
                    name={nomeCurto(c.nome, c.ie, 22)}
                    {...(modo === "empilhado" ? { stackId: "vaf" } : {})}
                    fill={corSerie(i)}
                    radius={modo === "empilhado" ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    className="cursor-pointer"
                    onClick={() => setIeDetalhe(c.ie)}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Comparativo ano × empresa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clique em uma empresa para abrir a série mensal completa e o detalhamento.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribuinte</TableHead>
                {anos.map((a) => (
                  <TableHead key={a} className="text-right">
                    {a}
                  </TableHead>
                ))}
                <TableHead className="text-right">Variação último ano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((c) => {
                const anterior =
                  penultimo != null ? (totalPorAnoEmpresa.get(c.ie)?.get(penultimo) ?? 0) : 0;
                const atual = ultimo != null ? (totalPorAnoEmpresa.get(c.ie)?.get(ultimo) ?? 0) : 0;
                const v = variacaoPct(atual, anterior);
                const novo = anterior === 0 && atual > 0;
                return (
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
                    <TableCell className="font-medium">
                      {c.nome ?? `IE ${c.ie}`}
                      {novo && (
                        <span className="ml-2 rounded-full bg-normal px-2 py-0.5 text-[10px] font-medium text-normal-foreground">
                          nova no ranking
                        </span>
                      )}
                    </TableCell>
                    {anos.map((a) => (
                      <TableCell key={a} className="text-right tabular-nums">
                        {formatarMoeda(totalPorAnoEmpresa.get(c.ie)?.get(a) ?? 0)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right tabular-nums ${
                        (v ?? 0) < 0 ? "text-omisso-foreground" : "text-normal-foreground"
                      }`}
                    >
                      {formatarPercentual(v)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DetalheContribuinte
        ie={ieDetalhe}
        cargas={cargas}
        linhas={linhas}
        onOpenChange={(aberto) => !aberto && setIeDetalhe(null)}
      />
    </div>
  );
}
