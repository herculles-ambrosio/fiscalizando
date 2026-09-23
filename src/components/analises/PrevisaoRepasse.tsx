import { useEffect, useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { useIndicesSalvos } from "@/hooks/useIndicesHistorico";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { formatarMoeda, formatarPercentual } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import {
  calcularPrevisao,
  type BaseReceita,
  type MesRepasse,
} from "@/lib/vaf/previsaoRepasse";

const NOME_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const indiceTexto = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 9, maximumFractionDigits: 9 });

/** Converte texto digitado em pt-BR para número. */
function paraNumero(texto: string): number | null {
  const limpo = texto.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!limpo) return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export default function PrevisaoRepasse() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);
  useEffect(() => {
    if (exercicios?.length && exercicio == null) setExercicio(exercicios[0] as number);
  }, [exercicios, exercicio]);

  const { data: dados, isLoading } = useIcmsDados(exercicio);
  const { data: indicesSalvos } = useIndicesSalvos(municipioId);

  const serie: MesRepasse[] = useMemo(() => {
    const s = dados?.series.get("vaf");
    return Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      indice: s?.indices[i] ?? null,
      valor: s?.valores[i] ?? null,
    }));
  }, [dados]);

  const indiceAtual = useMemo(() => {
    const comIndice = serie.filter((m) => m.indice != null && m.indice > 0);
    return comIndice.at(-1)?.indice ?? null;
  }, [serie]);

  /** média dos dois índices apurados mais recentes — a mesma lógica da Evolução */
  const mediaApurada = useMemo(() => {
    const lista = (indicesSalvos ?? []).map((i) => i.indice).filter((v) => v != null && v > 0);
    if (!lista.length) return null;
    const dois = lista.slice(0, 2) as number[];
    return dois.reduce((a, b) => a + b, 0) / dois.length;
  }, [indicesSalvos]);

  const [indiceTextoCampo, setIndiceTextoCampo] = useState("");
  useEffect(() => {
    if (mediaApurada != null && !indiceTextoCampo) {
      setIndiceTextoCampo(mediaApurada.toFixed(9).replace(".", ","));
    }
  }, [mediaApurada, indiceTextoCampo]);
  const indiceProjetado = paraNumero(indiceTextoCampo);

  const [base, setBase] = useState<BaseReceita>("ano_anterior");
  const [crescimento, setCrescimento] = useState("0");
  const [receitaManual, setReceitaManual] = useState("");

  const previsao = useMemo(
    () =>
      calcularPrevisao({
        serie,
        indiceProjetado,
        indiceAtual,
        base,
        crescimentoPct: paraNumero(crescimento) ?? 0,
        receitaManual: paraNumero(receitaManual),
      }),
    [serie, indiceProjetado, indiceAtual, base, crescimento, receitaManual],
  );

  const exercicioPrevisto = (exercicio ?? new Date().getFullYear()) + 1;
  const subiu = previsao.diferenca != null && previsao.diferenca > 0;
  const caiu = previsao.diferenca != null && previsao.diferenca < 0;
  const corCartao = subiu
    ? "border-normal-foreground/40 bg-normal"
    : caiu
      ? "border-destructive/40 bg-omisso"
      : "";

  const grafico = previsao.meses.map((m) => ({
    mes: NOME_MES[m.mes - 1]?.slice(0, 3),
    [`Recebido ${exercicio ?? ""}`]: m.recebido ?? 0,
    [`Previsto ${exercicioPrevisto}`]: m.previsto ?? 0,
  }));

  function exportar() {
    const csv = montarCsv(
      ["Mês", `Recebido ${exercicio ?? ""}`, `Previsto ${exercicioPrevisto}`, "Diferença"],
      previsao.meses.map((m) => [
        NOME_MES[m.mes - 1],
        m.recebido ?? "",
        m.previsto ?? "",
        m.previsto != null && m.recebido != null ? m.previsto - m.recebido : "",
      ]),
    );
    baixarCsv(`previsao-vaf-${municipio?.nome ?? "municipio"}-${exercicioPrevisto}.csv`, csv);
  }

  const semDados = !isLoading && previsao.atual.mesesComValor.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Premissas da previsão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Exercício recebido</Label>
            <Select
              value={exercicio ? String(exercicio) : ""}
              onValueChange={(v) => setExercicio(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(exercicios ?? []).map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A previsão é feita para {exercicioPrevisto}.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Índice projetado</Label>
            <Input
              value={indiceTextoCampo}
              onChange={(e) => setIndiceTextoCampo(e.target.value)}
              placeholder="0,006691978"
            />
            <p className="text-xs text-muted-foreground">
              Média das apurações: {indiceTexto(mediaApurada)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Base de receita</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseReceita)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ano_anterior">Repetir o ano anterior</SelectItem>
                <SelectItem value="crescimento">Acompanhar o ritmo do Estado</SelectItem>
                <SelectItem value="manual">Digitar a receita</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Índice aplicado hoje: {indiceTexto(indiceAtual)}
            </p>
          </div>

          <div className="space-y-1.5">
            {base === "crescimento" && (
              <>
                <Label>Crescimento da arrecadação (%)</Label>
                <Input value={crescimento} onChange={(e) => setCrescimento(e.target.value)} />
              </>
            )}
            {base === "manual" && (
              <>
                <Label>Receita anual do VAF (R$)</Label>
                <Input
                  value={receitaManual}
                  onChange={(e) => setReceitaManual(e.target.value)}
                  placeholder="880.000,00"
                />
                <p className="text-xs text-muted-foreground">
                  Total que o município receberia no ano com o índice aplicado hoje.
                </p>
              </>
            )}
            {base === "ano_anterior" && (
              <p className="pt-6 text-xs text-muted-foreground">
                Usa o que já entrou em {exercicio ?? "—"} e completa os meses que faltam pela média.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {semDados && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ainda não há valores do critério VAF importados para {exercicio ?? "este exercício"}.
            Importe o extrato do Portal da FJP ou escolha “Digitar a receita” para simular.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Recebido em {exercicio ?? "—"}</p>
            <p className="text-xl font-semibold">{formatarMoeda(previsao.atual.recebido)}</p>
            <p className="text-xs text-muted-foreground">
              {previsao.atual.mesesComValor.length} meses informados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Ano fechado (projetado)</p>
            <p className="text-xl font-semibold">{formatarMoeda(previsao.atual.projecaoAnual)}</p>
            <p className="text-xs text-muted-foreground">
              R$ por ponto de índice: {formatarMoeda(previsao.valorPorPontoAnual)}
            </p>
          </CardContent>
        </Card>
        <Card className={corCartao}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Previsão {exercicioPrevisto}</p>
            <p
              className={`text-xl font-semibold ${subiu ? "text-normal-foreground" : caiu ? "text-destructive" : ""}`}
            >
              {formatarMoeda(previsao.previsaoAnual)}
            </p>
            <p className="text-xs text-muted-foreground">
              Índice usado: {indiceTexto(indiceProjetado)}
            </p>
          </CardContent>
        </Card>
        <Card className={corCartao}>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Diferença</p>
            <p
              className={`flex items-center gap-2 text-xl font-semibold ${subiu ? "text-normal-foreground" : caiu ? "text-destructive" : ""}`}
            >
              {subiu ? <TrendingUp className="h-4 w-4" /> : caiu ? <TrendingDown className="h-4 w-4" /> : null}
              {formatarMoeda(previsao.diferenca)}
            </p>
            <Badge variant="outline" className="mt-1">
              {formatarPercentual(previsao.variacaoPct)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Mês a mês</CardTitle>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} width={80} />
                <ChartTooltip formatter={(v: number) => formatarMoeda(v)} />
                <Legend />
                <Bar dataKey={`Recebido ${exercicio ?? ""}`} fill="hsl(var(--muted-foreground))" />
                <Bar dataKey={`Previsto ${exercicioPrevisto}`} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Mês</th>
                  <th className="py-2 text-right">Recebido {exercicio ?? ""}</th>
                  <th className="py-2 text-right">Previsto {exercicioPrevisto}</th>
                  <th className="py-2 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {previsao.meses.map((m) => {
                  const dif =
                    m.previsto != null && m.recebido != null ? m.previsto - m.recebido : null;
                  return (
                    <tr key={m.mes} className="border-b last:border-0">
                      <td className="py-1.5">{NOME_MES[m.mes - 1]}</td>
                      <td className="py-1.5 text-right">{formatarMoeda(m.recebido)}</td>
                      <td className="py-1.5 text-right font-medium">{formatarMoeda(m.previsto)}</td>
                      <td
                        className={`py-1.5 text-right ${dif != null && dif > 0 ? "text-normal-foreground" : dif != null && dif < 0 ? "text-destructive" : ""}`}
                      >
                        {formatarMoeda(dif)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Cálculo: para cada mês recebido, R$ ÷ índice do mês dá o valor de 1 ponto de índice; a
            média em 12 meses multiplicada pelo índice projetado forma a previsão, distribuída pelos
            meses na mesma proporção do ano atual. A apuração do VAF não é alterada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
