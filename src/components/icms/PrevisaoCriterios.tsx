import { useEffect, useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useIndiceAplicado } from "@/hooks/useIndiceAplicado";
import { useArrecadacoesEstadoGlobais } from "@/hooks/useIndicesHistorico";
import { useEvolucoesSalvas } from "@/hooks/useEvolucoesSalvas";
import { useSituacoesCadastrais } from "@/hooks/useSituacoesCadastrais";
import { usePreferencia } from "@/hooks/usePreferencia";
import { CRITERIOS_PAINEL } from "@/lib/icms/criterios";
import { preverPorCriterio } from "@/lib/icms/previsaoCriterios";
import { acrescimoIndiceRecuperacao, fatorArrecadacao } from "@/lib/vaf/previsaoRepasse";
import { compararDeclarantes } from "@/lib/vaf/evolucao";
import { diagnosticarEvolucao } from "@/lib/vaf/diagnostico";
import { montarPlanoRecuperacao, potencialConsolidado } from "@/lib/vaf/recuperacao";
import { formatarCompacto, formatarMoeda, formatarPercentual } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { gerarPdf } from "@/lib/vaf/relatorioPdf";

type Base = "repetir" | "arrecadacao" | "crescimento";

const idx = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 9 });

function paraNumero(t: string): number | null {
  const l = t.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!l) return null;
  const n = Number(l);
  return Number.isFinite(n) ? n : null;
}

const cor = (v: number | null) =>
  v == null || v === 0 ? "" : v > 0 ? "text-emerald-600" : "text-destructive";

export default function PrevisaoCriterios() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);
  useEffect(() => {
    if (exercicio == null && exercicios?.length) setExercicio(exercicios[0]!);
  }, [exercicios, exercicio]);
  const exercicioPrevisto = (exercicio ?? new Date().getFullYear()) + 1;

  const { data: dados, isLoading } = useIcmsDados(exercicio);
  const { data: resolucaoProxima } = useIndiceAplicado(municipioId, exercicioPrevisto);
  const { data: arr } = useArrecadacoesEstadoGlobais();

  const [base, setBase] = useState<Base>("arrecadacao");
  const [crescimento, setCrescimento] = useState("0");
  const fatorArr = fatorArrecadacao(arr?.anterior, arr?.atual);
  const fator =
    base === "arrecadacao"
      ? (fatorArr ?? 1)
      : base === "crescimento"
        ? 1 + (paraNumero(crescimento) ?? 0) / 100
        : 1;

  // potencial mapeado na Análise do VAF
  const { data: evolucoes } = useEvolucoesSalvas(municipioId);
  const { data: situacoesCad } = useSituacoesCadastrais(municipioId);
  const evolucao = evolucoes?.[0] ?? null;
  const potencial = useMemo(() => {
    if (!evolucao) return null;
    try {
      const { base: b, atual: a } = evolucao;
      return potencialConsolidado(
        montarPlanoRecuperacao(
          diagnosticarEvolucao(b, a),
          compararDeclarantes(b.declarantes, a.declarantes),
          { exercicio, situacoesCadastrais: situacoesCad ?? null },
        ),
      );
    } catch {
      return null;
    }
  }, [evolucao, exercicio, situacoesCad]);
  const [recTexto, setRecTexto] = useState<string | null>(null);
  const valorRecuperar = recTexto != null ? paraNumero(recTexto) : potencial;

  const { valor: alvos, definir: definirAlvos } = usePreferencia<Record<string, string>>(
    `previsao-criterios-alvos-${municipioId ?? ""}`,
    {},
  );

  const resultado = useMemo(() => {
    const entradas = CRITERIOS_PAINEL.map((c) => {
      const s = dados?.series.get(c.slug);
      const atual = s?.ultimoIndice ?? null;
      let projetado = atual;
      let recuperacao: number | null = null;
      if (c.slug === "vaf") {
        projetado = resolucaoProxima?.media_indices ?? atual;
        const acr = acrescimoIndiceRecuperacao(valorRecuperar, arr?.atual ?? null, true);
        recuperacao = projetado != null && acr != null ? projetado + acr : null;
      } else {
        const alvo = alvos[c.slug] ? paraNumero(alvos[c.slug]!) : null;
        recuperacao = alvo;
      }
      return {
        slug: c.slug,
        nome: c.nome,
        percentual: c.percentual,
        valores: s?.valores ?? Array(12).fill(null),
        indiceAtual: atual,
        indiceProjetado: projetado,
        indiceRecuperacao: recuperacao,
      };
    });
    return preverPorCriterio(entradas, fator);
  }, [dados, resolucaoProxima, valorRecuperar, arr, alvos, fator]);

  const comDados = resultado.linhas.filter((l) => l.anual != null);
  const semDados = resultado.linhas.filter((l) => l.anual == null);
  const { totais } = resultado;
  const ganhoTotal = totais.comRecuperacao - totais.previsto;

  const rotuloBase =
    base === "arrecadacao"
      ? `Crescimento pela arrecadação do Estado (${formatarPercentual(fatorArr != null ? (fatorArr - 1) * 100 : null)})`
      : base === "crescimento"
        ? `Crescimento informado (${crescimento}%)`
        : "Repetir o exercício";

  const cabecalho = [
    "Critério",
    "Peso %",
    "Índice atual",
    "Índice projetado",
    "Índice c/ recuperação",
    `Anual ${exercicio ?? ""}`,
    `Previsto ${exercicioPrevisto}`,
    "Diferença",
    "Com recuperação",
  ];
  const linhasExport = () => [
    ...comDados.map((l) => [
      l.nome,
      l.percentual?.toLocaleString("pt-BR") ?? "—",
      idx(l.indiceAtual),
      idx(l.indiceProjetado),
      idx(l.indiceRecuperacao ?? l.indiceProjetado),
      formatarMoeda(l.anual),
      formatarMoeda(l.previsto),
      formatarMoeda(l.diferenca),
      formatarMoeda(l.comRecuperacao),
    ]),
    [
      "Total",
      "",
      "",
      "",
      "",
      formatarMoeda(totais.anual),
      formatarMoeda(totais.previsto),
      formatarMoeda(totais.previsto - totais.anual),
      formatarMoeda(totais.comRecuperacao),
    ],
  ];
  const nomeArq = `previsao-criterios-${municipio?.nome ?? "municipio"}-${exercicioPrevisto}`;

  function exportarCsv() {
    baixarCsv(`${nomeArq}.csv`, montarCsv(cabecalho, linhasExport()));
  }
  async function exportarPdf() {
    await gerarPdf(`${nomeArq}.pdf`, [
      { tipo: "titulo", texto: `Previsão por critério — ${municipio?.nome ?? ""} ${exercicioPrevisto}` },
      { tipo: "texto", texto: `Base de receita: ${rotuloBase}. Valor a recuperar no VAF: ${formatarMoeda(valorRecuperar)}.` },
      {
        tipo: "texto",
        texto:
          "Conta: previsto = recebido anualizado × fator da receita × índice projetado ÷ índice atual. Com recuperação usa o índice com recuperação (VAF) ou o índice alvo informado.",
      },
      {
        tipo: "tabela",
        cabecalho: ["Critério", "Índice atual", "Índice proj.", `Anual ${exercicio ?? ""}`, `Prev. ${exercicioPrevisto}`, "C/ recup."],
        linhas: linhasExport().map((l) => [l[0]!, l[2]!, l[3]!, l[5]!, l[6]!, l[8]!]),
        larguras: [40, 24, 24, 28, 29, 29],
        direita: [false, true, true, true, true, true],
      },
    ]);
  }

  const grafico = comDados.map((l) => ({
    nome: l.nome,
    [`${exercicio}`]: l.anual,
    [`${exercicioPrevisto}`]: l.previsto,
    "Com recuperação": l.comRecuperacao,
  }));

  if (!municipioId) return <p className="text-sm text-muted-foreground">Selecione um município.</p>;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Premissas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Exercício recebido</Label>
              <Select value={exercicio?.toString() ?? ""} onValueChange={(v) => setExercicio(Number(v))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(exercicios ?? []).map((e) => (
                    <SelectItem key={e} value={String(e)}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Base de receita</Label>
              <Select value={base} onValueChange={(v) => setBase(v as Base)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="repetir">Repetir o exercício</SelectItem>
                  <SelectItem value="arrecadacao">Crescimento pela arrecadação do Estado</SelectItem>
                  <SelectItem value="crescimento">Crescimento informado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{rotuloBase}</p>
            </div>
            {base === "crescimento" && (
              <div className="space-y-1">
                <Label>Crescimento (%)</Label>
                <Input value={crescimento} onChange={(e) => setCrescimento(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Valor a recuperar no VAF (R$)</Label>
              <Input
                value={recTexto ?? (potencial != null ? potencial.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "")}
                onChange={(e) => setRecTexto(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                {potencial != null ? `Potencial mapeado: ${formatarMoeda(potencial)}` : "Sem análise do VAF salva."}
                {recTexto != null && potencial != null && (
                  <button className="ml-2 underline" onClick={() => setRecTexto(null)}>Voltar ao potencial</button>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Previsto {exercicioPrevisto}</p>
            <p className={`text-2xl font-semibold ${cor(totais.previsto - totais.anual)}`}>{formatarMoeda(totais.previsto)}</p>
            <p className="text-xs text-muted-foreground">Anual {exercicio}: {formatarMoeda(totais.anual)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Com recuperação</p>
            <p className="text-2xl font-semibold text-emerald-600">{formatarMoeda(totais.comRecuperacao)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Ganho com a recuperação</p>
            <p className={`text-2xl font-semibold ${cor(ganhoTotal)}`}>{formatarMoeda(ganhoTotal)}</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Impacto por critério</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportarCsv}><Download className="mr-1 h-4 w-4" />CSV</Button>
              <Button size="sm" variant="outline" onClick={() => void exportarPdf()}><FileText className="mr-1 h-4 w-4" />PDF</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : !comDados.length ? (
              <p className="text-sm text-muted-foreground">Nenhum repasse por critério carregado para este exercício.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Critério</th>
                    <th className="py-2 text-right">Peso</th>
                    <th className="py-2 text-right">Índice atual</th>
                    <th className="py-2 text-right">Índice projetado</th>
                    <th className="py-2 text-right">Índice c/ recuperação</th>
                    <th className="py-2 text-right">Anual {exercicio}</th>
                    <th className="py-2 text-right">Previsto {exercicioPrevisto}</th>
                    <th className="py-2 text-right">Diferença</th>
                    <th className="py-2 text-right">Com recuperação</th>
                  </tr>
                </thead>
                <tbody>
                  {comDados.map((l) => (
                    <tr key={l.slug} className="border-b">
                      <td className="py-2">{l.nome}</td>
                      <td className="py-2 text-right">{l.percentual != null ? `${l.percentual.toLocaleString("pt-BR")}%` : "—"}</td>
                      <td className="py-2 text-right font-mono">{idx(l.indiceAtual)}</td>
                      <td className="py-2 text-right font-mono">{idx(l.indiceProjetado)}</td>
                      <td className="py-2 text-right">
                        {l.slug === "vaf" ? (
                          <span className="font-mono">{idx(l.indiceRecuperacao)}</span>
                        ) : (
                          <Input
                            className="ml-auto h-8 w-32 text-right font-mono"
                            placeholder="índice alvo"
                            defaultValue={alvos[l.slug] ?? ""}
                            key={`${l.slug}-${alvos[l.slug] ?? ""}`}
                            onBlur={(e) => definirAlvos({ ...alvos, [l.slug]: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="py-2 text-right">{formatarMoeda(l.anual)}</td>
                      <td className={`py-2 text-right ${cor(l.diferenca)}`}>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help border-b border-dotted">{formatarMoeda(l.previsto)}</TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">
                            {formatarMoeda(l.anual)} (média de {l.mesesComValor} meses × 12) × fator {fator.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
                            {l.indiceAtual && l.indiceProjetado ? ` × ${idx(l.indiceProjetado)} ÷ ${idx(l.indiceAtual)}` : ""} = {formatarMoeda(l.previsto)}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className={`py-2 text-right font-semibold ${cor(l.diferenca)}`}>
                        {formatarMoeda(l.diferenca)} <span className="text-xs">({formatarPercentual(l.variacaoPct)})</span>
                      </td>
                      <td className={`py-2 text-right ${cor(l.ganho)}`}>{formatarMoeda(l.comRecuperacao)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2" colSpan={5}>Total</td>
                    <td className="py-2 text-right">{formatarMoeda(totais.anual)}</td>
                    <td className={`py-2 text-right ${cor(totais.previsto - totais.anual)}`}>{formatarMoeda(totais.previsto)}</td>
                    <td className={`py-2 text-right ${cor(totais.previsto - totais.anual)}`}>{formatarMoeda(totais.previsto - totais.anual)}</td>
                    <td className="py-2 text-right text-emerald-600">{formatarMoeda(totais.comRecuperacao)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {semDados.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Sem dados: {semDados.map((l) => l.nome).join(", ")}.
              </p>
            )}
          </CardContent>
        </Card>

        {comDados.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Comparativo por critério</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" fontSize={11} />
                  <YAxis tickFormatter={(v) => formatarCompacto(v as number)} fontSize={11} />
                  <ChartTooltip formatter={(v) => formatarMoeda(v as number)} />
                  <Legend />
                  <Bar dataKey={`${exercicio}`} fill="var(--muted-foreground)" />
                  <Bar dataKey={`${exercicioPrevisto}`} fill="var(--primary)" />
                  <Bar dataKey="Com recuperação" fill="var(--chart-2, var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
