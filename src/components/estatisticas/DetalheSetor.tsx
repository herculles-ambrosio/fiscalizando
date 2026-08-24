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
import { formatarCnpj, formatarMoeda, formatarCompacto, formatarValorGrid } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { descricaoCnae, formatarCodigoCnae } from "@/lib/vaf/cnae";
import {
  agregarPorContribuinte,
  periodoDaCarga,
  type CargaEstat,
  type LinhaEstat,
  vafComposto,
} from "@/lib/vaf/estatisticas";
import { estiloTooltip } from "./MaioresContribuintes";

const SEM_CNAE = "sem CNAE";

/** Agrega o setor (CNAE) informado: série por remessa e ranking de empresas. */
export function detalharSetor(
  cnae: string,
  cargas: CargaEstat[],
  linhas: LinhaEstat[],
  ano: number | null,
) {
  const periodos = cargas
    .map(periodoDaCarga)
    .filter((p) => ano == null || p.ano === ano)
    .sort((a, b) => a.ordem - b.ordem);
  const porCarga = new Map(periodos.map((p) => [p.cargaId, p]));

  const doEscopo = linhas.filter((l) => porCarga.has(l.carga_id));
  const doSetor = doEscopo.filter((l) => (l.cnae || SEM_CNAE) === cnae);

  const serie = periodos.map((p) => {
    const totalPeriodo = doEscopo
      .filter((l) => l.carga_id === p.cargaId)
      .reduce((s, l) => s + vafComposto(l), 0);
    const doPeriodo = doSetor.filter((l) => l.carga_id === p.cargaId);
    const vaf = doPeriodo.reduce((s, l) => s + vafComposto(l), 0);
    return {
      rotulo: p.rotulo,
      ano: p.ano,
      vaf,
      totalPeriodo,
      participacao: totalPeriodo > 0 ? (vaf / totalPeriodo) * 100 : 0,
      empresas: new Set(doPeriodo.map((l) => l.inscricao_estadual)).size,
    };
  });

  const empresas = agregarPorContribuinte(doSetor, porCarga);
  const total = empresas.reduce((s, c) => s + c.total, 0);
  const totalMunicipio = doEscopo.reduce((s, l) => s + vafComposto(l), 0);

  return {
    cnae,
    descricao: descricaoCnae(cnae) ?? "",
    serie,
    empresas,
    total,
    totalMunicipio,
    participacao: totalMunicipio > 0 ? (total / totalMunicipio) * 100 : 0,
    media: empresas.length ? total / empresas.length : 0,
  };
}

export function DetalheSetor({
  cnae,
  cargas,
  linhas,
  ano,
  onOpenChange,
  onSelecionarContribuinte,
}: {
  cnae: string | null;
  cargas: CargaEstat[];
  linhas: LinhaEstat[];
  ano?: number | null;
  onOpenChange: (aberto: boolean) => void;
  onSelecionarContribuinte?: (ie: string) => void;
}) {
  const dados = useMemo(
    () => (cnae ? detalharSetor(cnae, cargas, linhas, ano ?? null) : null),
    [cnae, cargas, linhas, ano],
  );

  function exportar() {
    if (!dados) return;
    const csv = montarCsv(
      ["IE", "CNPJ", "Contribuinte", "VAF do setor no período", "Participação no setor %"],
      dados.empresas.map((c) => [
        c.ie,
        c.cnpj ?? "",
        c.nome ?? "",
        c.total.toFixed(2),
        dados.total > 0 ? ((c.total / dados.total) * 100).toFixed(2) : "0.00",
      ]),
    );
    baixarCsv(`setor-${dados.cnae.replace(/\W+/g, "")}${ano ? `-${ano}` : ""}.csv`, csv);
  }

  const eixo = {
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    stroke: "var(--muted-foreground)",
  } as const;

  return (
    <Dialog open={!!cnae} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        {dados && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-lg">
                {dados.cnae === SEM_CNAE ? "Sem CNAE informado" : formatarCodigoCnae(dados.cnae)}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {dados.descricao && <span>{dados.descricao}</span>}
                {ano != null && <Badge variant="secondary">Ano {ano}</Badge>}
                <span>{dados.empresas.length} empresa(s)</span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi rotulo="VAF do setor" valor={formatarMoeda(dados.total)} />
              <Kpi
                rotulo="Participação no VAF"
                valor={`${dados.participacao.toFixed(2)}%`}
              />
              <Kpi rotulo="Empresas" valor={String(dados.empresas.length)} />
              <Kpi rotulo="VAF médio por empresa" valor={formatarMoeda(dados.media)} />
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.serie} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="rotulo" {...eixo} />
                  <YAxis {...eixo} tickFormatter={formatarCompacto} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    contentStyle={estiloTooltip}
                    formatter={(v: number) => [formatarMoeda(v), "VAF do setor"]}
                  />
                  <Bar dataKey="vaf" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ScrollArea className="max-h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="text-right">VAF</TableHead>
                    <TableHead className="text-right">% do setor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.empresas.map((c) => (
                    <TableRow
                      key={c.ie}
                      className="cursor-pointer"
                      onClick={() => onSelecionarContribuinte?.(c.ie)}
                    >
                      <TableCell className="font-medium">{c.nome ?? `IE ${c.ie}`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.cnpj ? formatarCnpj(c.cnpj) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatarValorGrid(c.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dados.total > 0 ? ((c.total / dados.total) * 100).toFixed(2) : "0.00"}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Total do setor</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatarValorGrid(dados.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollArea>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportar}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-display text-sm font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
