import { useEffect, useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
import { useRepassesEstado } from "@/hooks/useRepassesEstado";
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

type OrigemIndice = "media" | "ultima" | "digitado";

export default function PrevisaoRepasse() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);
  useEffect(() => {
    if (exercicios?.length && exercicio == null) setExercicio(exercicios[0] as number);
  }, [exercicios, exercicio]);

  const { data: dados, isLoading } = useIcmsDados(exercicio);
  const { data: indicesSalvos } = useIndicesSalvos(municipioId);
  const { data: bolada } = useRepassesEstado(exercicio);

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

  const apurados = useMemo(
    () => (indicesSalvos ?? []).map((i) => i.indice).filter((v): v is number => v != null && v > 0),
    [indicesSalvos],
  );
  const ultimaApuracao = apurados[0] ?? null;
  const mediaApurada = useMemo(() => {
    if (!apurados.length) return null;
    const dois = apurados.slice(0, 2);
    return dois.reduce((a, b) => a + b, 0) / dois.length;
  }, [apurados]);

  const [origemIndice, setOrigemIndice] = useState<OrigemIndice>("media");
  const [indiceDigitado, setIndiceDigitado] = useState("");
  const indiceProjetado =
    origemIndice === "media"
      ? mediaApurada
      : origemIndice === "ultima"
        ? ultimaApuracao
        : paraNumero(indiceDigitado);

  const [base, setBase] = useState<BaseReceita>("ano_anterior");
  const [crescimento, setCrescimento] = useState("0");
  const [receitaManual, setReceitaManual] = useState("");

  const boladaMeses = useMemo(() => (bolada ?? []).map((m) => m.vaf75), [bolada]);
  const temBolada = boladaMeses.some((v) => v != null && v > 0);

  const previsao = useMemo(
    () =>
      calcularPrevisao({
        serie,
        indiceProjetado,
        indiceAtual,
        base,
        crescimentoPct: paraNumero(crescimento) ?? 0,
        receitaManual: paraNumero(receitaManual),
        boladaEstado: boladaMeses,
        boladaManual: paraNumero(receitaManual),
      }),
    [serie, indiceProjetado, indiceAtual, base, crescimento, receitaManual, boladaMeses],
  );

  const exercicioPrevisto = (exercicio ?? new Date().getFullYear()) + 1;
  const subiu = previsao.diferenca != null && previsao.diferenca > 0;
  const caiu = previsao.diferenca != null && previsao.diferenca < 0;
  const corCartao = subiu
    ? "border-normal-foreground/40 bg-normal"
    : caiu
      ? "border-destructive/40 bg-omisso"
      : "";

  const indiceSubiu = (previsao.variacaoIndicePct ?? 0) > 0;
  const indiceCaiu = (previsao.variacaoIndicePct ?? 0) < 0;

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
  const ultimoMes = previsao.atual.mesesComValor.at(-1);

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
            <Select value={origemIndice} onValueChange={(v) => setOrigemIndice(v as OrigemIndice)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="media">Média das duas últimas apurações</SelectItem>
                <SelectItem value="ultima">Somente a última apuração</SelectItem>
                <SelectItem value="digitado">Digitar o índice</SelectItem>
              </SelectContent>
            </Select>
            {origemIndice === "digitado" ? (
              <Input
                value={indiceDigitado}
                onChange={(e) => setIndiceDigitado(e.target.value)}
                placeholder="0,006691978"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Valor usado: {indiceTexto(indiceProjetado)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Base de receita</Label>
            <Select value={base} onValueChange={(v) => setBase(v as BaseReceita)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ano_anterior">
                  {temBolada ? "Repetir o Estado" : "Repetir o ano anterior"}
                </SelectItem>
                <SelectItem value="crescimento">Crescimento da arrecadação</SelectItem>
                <SelectItem value="manual">
                  {temBolada ? "Digitar a bolada" : "Digitar a receita"}
                </SelectItem>
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
                <Label>
                  {temBolada ? "Bolada anual do VAF (R$)" : "Receita anual do VAF (R$)"}
                </Label>
                <Input
                  value={receitaManual}
                  onChange={(e) => setReceitaManual(e.target.value)}
                  placeholder={temBolada ? "13.100.000.000,00" : "880.000,00"}
                />
                <p className="text-xs text-muted-foreground">
                  {temBolada
                    ? "Total do Estado repassado pelo VAF no ano."
                    : "Total que o município receberia no ano com o índice aplicado hoje."}
                </p>
              </>
            )}
            {base === "ano_anterior" && (
              <p className="pt-6 text-xs text-muted-foreground">
                {temBolada
                  ? `Usa a bolada do Estado de ${exercicio ?? "—"}, completando os meses que faltam pela média.`
                  : `Usa o que já entrou em ${exercicio ?? "—"} e completa os meses que faltam pela média.`}
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

      {!temBolada && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            A bolada do Estado de {exercicio ?? "—"} ainda não foi cadastrada, então ela está sendo
            deduzida do que o município recebeu. Para a conta oficial, cadastre a tabela de
            transferências em{" "}
            <Link to="/icms/transferencias" className="underline">
              Transferências do Estado
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
              Recebido até {ultimoMes ? NOME_MES[ultimoMes - 1] : "—"} de {exercicio ?? "—"}
            </p>
            <p className="text-xl font-semibold">{formatarMoeda(previsao.atual.recebido)}</p>
            <p className="text-xs text-muted-foreground">
              {previsao.atual.mesesComValor.length} meses informados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Ano fechado estimado {exercicio ?? ""}</p>
            <p className="text-xl font-semibold">{formatarMoeda(previsao.atual.projecaoAnual)}</p>
            <p className="text-xs text-muted-foreground">É com este valor que a previsão compara</p>
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
              {formatarMoeda(previsao.diferenca)} ({formatarPercentual(previsao.variacaoPct)})
            </p>
          </CardContent>
        </Card>
        <Card
          className={
            indiceSubiu
              ? "border-normal-foreground/40 bg-normal"
              : indiceCaiu
                ? "border-destructive/40 bg-omisso"
                : ""
          }
        >
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Índice projetado x aplicado hoje</p>
            <p
              className={`flex items-center gap-2 text-xl font-semibold ${indiceSubiu ? "text-normal-foreground" : indiceCaiu ? "text-destructive" : ""}`}
            >
              {indiceSubiu ? (
                <TrendingUp className="h-4 w-4" />
              ) : indiceCaiu ? (
                <TrendingDown className="h-4 w-4" />
              ) : null}
              {formatarPercentual(previsao.variacaoIndicePct)}
            </p>
            <Badge variant="outline" className="mt-1">
              {indiceTexto(indiceProjetado)}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Como chegamos nesse valor</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1.5 text-muted-foreground">Índice aplicado hoje</td>
                <td className="py-1.5 text-right font-medium">{indiceTexto(indiceAtual)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 text-muted-foreground">
                  Índice projetado para {exercicioPrevisto}
                </td>
                <td className="py-1.5 text-right font-medium">
                  {indiceTexto(indiceProjetado)} ({formatarPercentual(previsao.variacaoIndicePct)})
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5 text-muted-foreground">
                  {previsao.origem === "estado"
                    ? "Bolada do Estado no ano (75% do VAF)"
                    : "Bolada estimada pelo recebido (valor ÷ índice)"}
                </td>
                <td className="py-1.5 text-right font-medium">
                  {formatarMoeda(
                    previsao.origem === "estado"
                      ? previsao.boladaAnual
                      : previsao.valorPorPontoAnual,
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-muted-foreground">
                  Previsão = índice x bolada do ano
                </td>
                <td className="py-1.5 text-right font-semibold">
                  {formatarMoeda(previsao.previsaoAnual)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

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
            O repasse de cada mês é o índice do município aplicado sobre a bolada do VAF do Estado
            (75% da transferência líquida). A previsão do ano usa o índice projetado sobre a bolada
            anual e distribui pelos meses na mesma proporção observada. A apuração do VAF não é
            alterada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
