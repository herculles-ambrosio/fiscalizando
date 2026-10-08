import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConferenciaBancos } from "./useConferenciaBancos";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { formatarCompacto, formatarMoeda } from "@/lib/format";
import { cn } from "@/lib/utils";

const anoAtual = new Date().getFullYear();
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function ConferenciaView() {
  const [ano, setAno] = useState(anoAtual - 1);
  const { contas, tend, rateio, resumo } = useConferenciaBancos(ano);
  const raizes = [...new Set(tend.map((t) => t.raiz))];
  const [raizSel, setRaizSel] = useState("");
  const raiz = raizSel || raizes[0] || "";
  const grafico = tend.filter((t) => t.raiz === raiz).map((t) => ({ mes: MESES[t.mesNum - 1], receita: t.receita, base: t.base }));
  const indicios = contas.filter((c) => c.r.motivos.length);
  const total = useMemo(() => ({
    base: resumo.reduce((s, r) => s + r.base, 0),
    dif: resumo.reduce((s, r) => s + r.issDiferenca, 0),
    alertas: resumo.filter((r) => r.alertas.length).length,
  }), [resumo]);

  function exportar() {
    baixarCsv(`conferencia_bancos_${ano}.csv`, montarCsv(
      ["Instituição", "CNPJ", "Base declarada", "ISS declarado", "ISS a menor (COSIF)", "Receita no Banco Central", "Indícios"],
      resumo.map((r) => [r.nome, r.cnpj, r.base.toFixed(2), r.issDeclarado.toFixed(2), r.issDiferenca.toFixed(2), r.receitaBc.toFixed(2), r.alertas.join(" | ")]),
    ));
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: 6 }, (_, i) => anoAtual - i).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={exportar}><Download className="mr-2 size-4" />CSV</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />PDF / imprimir</Button>
      </div>
      <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Os resultados abaixo são <strong>indícios para fiscalizar, não prova</strong>. O ESTBAN mostra a receita total das agências (juros, tarifas etc.), por isso serve como referência de tamanho e tendência, não como base do ISS.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Base tributável declarada</p><p className="text-xl font-semibold">{formatarMoeda(total.base)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">ISS a menor nas contas COSIF</p><p className="text-xl font-semibold text-destructive">{formatarMoeda(total.dif)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Instituições com indício</p><p className="text-xl font-semibold">{total.alertas} de {resumo.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo por instituição</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Instituição</TableHead><TableHead className="text-right">Base declarada</TableHead><TableHead className="text-right">ISS declarado</TableHead><TableHead className="text-right">ISS a menor</TableHead><TableHead className="text-right">Receita (BC)</TableHead><TableHead>Indícios</TableHead></TableRow></TableHeader>
            <TableBody>
              {resumo.map((r) => (
                <TableRow key={r.cnpj}>
                  <TableCell><div className="font-medium">{r.nome}</div><div className="text-xs text-muted-foreground">{r.cnpj}</div></TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.base)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.issDeclarado)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", r.issDiferenca > 0.5 && "text-destructive")}>{formatarMoeda(r.issDiferenca)}</TableCell>
                  <TableCell className="text-right">{r.receitaBc ? formatarMoeda(r.receitaBc) : "—"}</TableCell>
                  <TableCell className="space-x-1 space-y-1">{r.alertas.length ? r.alertas.map((a) => <Badge key={a} variant="destructive" className="font-normal">{a}</Badge>) : <Badge variant="secondary">Sem indício</Badge>}</TableCell>
                </TableRow>
              ))}
              {!resumo.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Sem dados neste ano. Busque o ESTBAN em Instituições e importe as declarações.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Contas COSIF com indício</CardTitle>
          <p className="text-sm text-muted-foreground">Contas de rendas de serviços (7.1.7) declaradas como não tributáveis, com alíquota menor que a do item ou com ISS abaixo do devido.</p></CardHeader>
        <CardContent className="max-h-[28rem] overflow-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>Instituição</TableHead><TableHead>Conta</TableHead><TableHead>Item / alíquota</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">ISS devido</TableHead><TableHead className="text-right">Declarado</TableHead><TableHead className="text-right">Diferença</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
            <TableBody>
              {indicios.map((c, i) => (
                <TableRow key={c.id ?? i}>
                  <TableCell>{MESES[c.competencia_mes - 1]}</TableCell>
                  <TableCell className="text-xs">{c.instituicao_nome ?? c.cnpj}</TableCell>
                  <TableCell className="text-xs"><div className="font-mono">{c.conta}</div><div className="text-muted-foreground">{c.descricao}</div></TableCell>
                  <TableCell className="text-xs">{c.r.itemLc116 ?? "—"} · {String(c.r.aliquota).replace(".", ",")}%</TableCell>
                  <TableCell className="text-right">{formatarMoeda(Number(c.valor))}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(c.r.issEsperado)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(c.r.issDeclarado)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{formatarMoeda(c.r.diferenca)}</TableCell>
                  <TableCell className="text-xs">{c.r.motivos.join("; ")}</TableCell>
                </TableRow>
              ))}
              {!indicios.length && <TableRow><TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">Nenhuma conta com indício.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div><CardTitle className="text-base">2. ESTBAN × base declarada (mês a mês)</CardTitle>
            <p className="text-sm text-muted-foreground">Receita do mês nas contas credoras (verbete 711, desacumulada do semestre) comparada com a base tributável declarada.</p></div>
          {raizes.length > 0 && (
            <Select value={raiz} onValueChange={setRaizSel}><SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
              <SelectContent>{raizes.map((r) => <SelectItem key={r} value={r}>{tend.find((t) => t.raiz === r)?.nome}</SelectItem>)}</SelectContent></Select>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {grafico.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v: number) => formatarCompacto(v)} width={70} />
                  <Tooltip formatter={(v: number) => formatarMoeda(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" name="Receita no Banco Central" stroke="var(--primary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="base" name="Base declarada" stroke="var(--destructive)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-muted-foreground">Sem ESTBAN neste ano.</p>}
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Receita (BC)</TableHead><TableHead className="text-right">Base declarada</TableHead><TableHead className="text-right">Base ÷ receita</TableHead><TableHead>Alerta</TableHead></TableRow></TableHeader>
            <TableBody>
              {tend.filter((t) => t.raiz === raiz).map((t) => (
                <TableRow key={t.mes}>
                  <TableCell>{t.mes}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(t.receita)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(t.base)}</TableCell>
                  <TableCell className="text-right">{t.razao == null ? "—" : `${(t.razao * 100).toFixed(1).replace(".", ",")}%`}</TableCell>
                  <TableCell>{t.alerta ? <Badge variant="destructive" className="font-normal">{t.alerta}</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">3. Cooperativas e rateio (IF.data)</CardTitle>
          <p className="text-sm text-muted-foreground">Estimativa = rendas de serviços do trimestre × participação do município. Alerta quando a base declarada fica abaixo de 70% da estimativa.</p></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Instituição</TableHead><TableHead>Trimestre</TableHead><TableHead className="text-right">Rendas</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Estimativa</TableHead><TableHead className="text-right">Base declarada</TableHead><TableHead>Alerta</TableHead></TableRow></TableHeader>
            <TableBody>
              {rateio.map((f) => (
                <TableRow key={`${f.cnpj}-${f.trimestre}`}>
                  <TableCell>{f.nome}</TableCell>
                  <TableCell>{f.trimestre}º</TableCell>
                  <TableCell className="text-right">{formatarMoeda(f.rendas)}</TableCell>
                  <TableCell className="text-right">{String(f.participacao).replace(".", ",")}%</TableCell>
                  <TableCell className="text-right">{formatarMoeda(f.estimativa)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(f.base)}</TableCell>
                  <TableCell>{f.alerta ? <Badge variant="destructive" className="font-normal">{f.alerta}</Badge> : "—"}</TableCell>
                </TableRow>
              ))}
              {!rateio.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Nenhum trimestre do IF.data informado em Instituições.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
