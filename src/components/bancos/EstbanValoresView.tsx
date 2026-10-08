import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEstban, useInstituicoes } from "@/hooks/useBancos";
import { receitaMensalEstban } from "@/lib/bancos/conferencia";
import { montarCsv, baixarCsv } from "@/lib/csv";
import { formatarMoeda } from "@/lib/format";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const num = (v: unknown) => (v == null ? null : Number(v));

function Dica({ texto }: { texto: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 cursor-help text-muted-foreground">(?)</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{texto}</TooltipContent>
    </Tooltip>
  );
}

/** Valores que cada instituição informou ao Banco Central (ESTBAN), mês a mês. */
export function EstbanValoresView() {
  const { data: estban = [] } = useEstban();
  const { data: inst = [] } = useInstituicoes();

  const anos = useMemo(() => [...new Set(estban.map((e) => e.competencia_ano))].sort((a, b) => b - a), [estban]);
  const [ano, setAno] = useState<string>("");
  const anoSel = ano || String(anos[0] ?? "");
  const [raiz, setRaiz] = useState<string>("todas");

  const nomes = useMemo(() => {
    const m = new Map(inst.map((i) => [i.cnpj.slice(0, 8), i.nome]));
    for (const e of estban) if (!m.has(e.cnpj_raiz)) m.set(e.cnpj_raiz, e.nome);
    return m;
  }, [inst, estban]);

  const raizes = useMemo(
    () => [...new Set(estban.filter((e) => String(e.competencia_ano) === anoSel).map((e) => e.cnpj_raiz))].sort((a, b) =>
      (nomes.get(a) ?? a).localeCompare(nomes.get(b) ?? b, "pt-BR"),
    ),
    [estban, anoSel, nomes],
  );

  const mensal = useMemo(
    () =>
      receitaMensalEstban(
        estban.map((e) => ({
          competencia_ano: e.competencia_ano,
          competencia_mes: e.competencia_mes,
          cnpj_raiz: e.cnpj_raiz,
          nome: e.nome,
          verbete_711: num(e.verbete_711),
        })),
      ),
    [estban],
  );

  const linhas = useMemo(() => {
    return estban
      .filter((e) => String(e.competencia_ano) === anoSel && (raiz === "todas" || e.cnpj_raiz === raiz))
      .map((e) => ({
        ...e,
        nomeExib: nomes.get(e.cnpj_raiz) ?? e.nome,
        mensal711: mensal.get(`${e.cnpj_raiz}|${e.competencia_ano}|${e.competencia_mes}`) ?? null,
      }))
      .sort(
        (a, b) =>
          a.nomeExib.localeCompare(b.nomeExib, "pt-BR") || a.competencia_mes - b.competencia_mes,
      );
  }, [estban, anoSel, raiz, nomes, mensal]);

  const mesesPresentes = useMemo(() => new Set(linhas.map((l) => l.competencia_mes)), [linhas]);
  const faltantes = MESES.map((m, i) => i + 1).filter((m) => !mesPresentes.has(m));

  function exportar() {
    const csv = montarCsv(
      ["Instituição", "CNPJ raiz", "Competência", "710 Contas de resultado (acum.)", "711 Contas credoras (acum.)", "711 Receita do mês", "712 Contas devedoras (acum.)"],
      linhas.map((l) => [
        l.nomeExib,
        l.cnpj_raiz,
        `${String(l.competencia_mes).padStart(2, "0")}/${l.competencia_ano}`,
        num(l.verbete_710)?.toFixed(2).replace(".", ",") ?? "",
        num(l.verbete_711)?.toFixed(2).replace(".", ",") ?? "",
        l.mensal711?.toFixed(2).replace(".", ",") ?? "",
        num(l.verbete_712)?.toFixed(2).replace(".", ",") ?? "",
      ]),
    );
    baixarCsv(`estban_${anoSel}.csv`, csv);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Valores informados ao Banco Central (ESTBAN)</CardTitle>
            <p className="text-sm text-muted-foreground">
              O que cada instituição declarou ao Banco Central, mês a mês. Os verbetes 711/712 vêm acumulados dentro do
              semestre (zeram em janeiro e julho); a coluna "Receita do mês" já mostra o valor isolado do mês, que é o
              usado na Conferência.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
            <Download className="mr-2 size-4" />Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Select value={anoSel} onValueChange={setAno}>
            <SelectTrigger className="h-9 w-28"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={raiz} onValueChange={setRaiz}>
            <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as instituições</SelectItem>
              {raizes.map((r) => <SelectItem key={r} value={r}>{nomes.get(r) ?? r}</SelectItem>)}
            </SelectContent>
          </Select>
          {anoSel && faltantes.length < 12 && faltantes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Meses ainda não importados em {anoSel}: {faltantes.map((m) => MESES[m - 1]).join(", ")}.
            </p>
          )}
        </div>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instituição</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">
                  710 Contas de resultado
                  <Dica texto="Soma das contas de resultado (receitas e despesas). Inclui juros e outros rendimentos — não é base direta de ISS. Valor acumulado no semestre." />
                </TableHead>
                <TableHead className="text-right">
                  711 Contas credoras
                  <Dica texto="Contas credoras de resultado (receitas), acumuladas no semestre." />
                </TableHead>
                <TableHead className="text-right">
                  Receita do mês (711)
                  <Dica texto="Valor isolado do mês: diferença para o mês anterior do mesmo semestre. É este valor que a Conferência compara com a base declarada." />
                </TableHead>
                <TableHead className="text-right">
                  712 Contas devedoras
                  <Dica texto="Contas devedoras de resultado (despesas), acumuladas no semestre." />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nomeExib}</TableCell>
                  <TableCell>{MESES[l.competencia_mes - 1]}/{l.competencia_ano}</TableCell>
                  <TableCell className="text-right">{num(l.verbete_710) != null ? formatarMoeda(num(l.verbete_710)!) : "—"}</TableCell>
                  <TableCell className="text-right">{num(l.verbete_711) != null ? formatarMoeda(num(l.verbete_711)!) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">{l.mensal711 != null ? formatarMoeda(l.mensal711) : "—"}</TableCell>
                  <TableCell className="text-right">{num(l.verbete_712) != null ? formatarMoeda(num(l.verbete_712)!) : "—"}</TableCell>
                </TableRow>
              ))}
              {!linhas.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum valor do ESTBAN para o filtro escolhido. Use "Buscar ESTBAN" acima para importar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
