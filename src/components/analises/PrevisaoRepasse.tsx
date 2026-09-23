import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
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
import { Textarea } from "@/components/ui/textarea";
import { explicarPrevisao } from "@/lib/vaf/duvidaPrevisao.functions";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { useIndicesSalvos } from "@/hooks/useIndicesHistorico";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useIndiceAplicado } from "@/hooks/useIndiceAplicado";
import { useExerciciosEstado, useRepassesEstado } from "@/hooks/useRepassesEstado";
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

type OrigemIndice = "media" | "ultima" | "digitado" | "resolucao";

export default function PrevisaoRepasse() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const { data: exerciciosEstado } = useExerciciosEstado();
  const [exercicio, setExercicio] = useState<number | null>(null);
  useEffect(() => {
    if (exercicio != null) return;
    if (exercicios?.length) setExercicio(exercicios[0] as number);
    else if (exerciciosEstado?.length) setExercicio(exerciciosEstado[0] as number);
    else if (exercicios) setExercicio(new Date().getFullYear());
  }, [exercicios, exerciciosEstado, exercicio]);

  const { data: dados, isLoading } = useIcmsDados(exercicio);
  const { data: indicesSalvos } = useIndicesSalvos(municipioId);
  const { data: bolada } = useRepassesEstado(exercicio);
  // Índices oficiais publicados em resolução da SEF: servem de fonte para as
  // prefeituras que não têm apuração própria carregada.
  const { data: resolucaoAtual } = useIndiceAplicado(municipioId, exercicio);
  const { data: resolucaoProxima } = useIndiceAplicado(
    municipioId,
    exercicio != null ? exercicio + 1 : null,
  );

  const boladaMesesFjp = useMemo(() => (bolada ?? []).map((m) => m.vaf75), [bolada]);

  const seriePropria: MesRepasse[] = useMemo(() => {
    const s = dados?.series.get("vaf");
    return Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      indice: s?.indices[i] ?? null,
      valor: s?.valores[i] ?? null,
    }));
  }, [dados]);

  const temSeriePropria = seriePropria.some((m) => m.valor != null && m.valor > 0);
  const indiceResolucaoAtual = resolucaoAtual?.media_indices ?? null;
  const indiceResolucaoProxima = resolucaoProxima?.media_indices ?? null;

  /** Série estimada pela resolução aplicada x bolada mensal da FJP. */
  const serieResolucao: MesRepasse[] = useMemo(() => {
    if (indiceResolucaoAtual == null || indiceResolucaoAtual <= 0) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const bol = boladaMesesFjp[i] ?? null;
      return {
        mes: i + 1,
        indice: indiceResolucaoAtual,
        valor: bol != null && bol > 0 ? (bol * indiceResolucaoAtual) / 100 : null,
      };
    });
  }, [indiceResolucaoAtual, boladaMesesFjp]);

  const usandoResolucao = !temSeriePropria && serieResolucao.length > 0;
  const serie = usandoResolucao ? serieResolucao : seriePropria;

  const indiceAtual = useMemo(() => {
    const comIndice = serie.filter((m) => m.indice != null && m.indice > 0);
    return comIndice.at(-1)?.indice ?? indiceResolucaoAtual;
  }, [serie, indiceResolucaoAtual]);

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

  /** Índice publicado para o exercício previsto (ou o do exercício atual). */
  const indiceResolucaoProjetado = indiceResolucaoProxima ?? indiceResolucaoAtual;

  const [origemIndice, setOrigemIndice] = useState<OrigemIndice>("media");
  const [origemAjustada, setOrigemAjustada] = useState(false);
  // Sem apuração própria, a origem padrão passa a ser a resolução da SEF.
  useEffect(() => {
    if (origemAjustada || !indicesSalvos) return;
    if (!apurados.length && indiceResolucaoProjetado != null) setOrigemIndice("resolucao");
    setOrigemAjustada(true);
  }, [indicesSalvos, apurados.length, indiceResolucaoProjetado, origemAjustada]);

  const [indiceDigitado, setIndiceDigitado] = useState("");
  const indiceProjetado =
    origemIndice === "media"
      ? mediaApurada
      : origemIndice === "ultima"
        ? ultimaApuracao
        : origemIndice === "resolucao"
          ? indiceResolucaoProjetado
          : paraNumero(indiceDigitado);

  const [base, setBase] = useState<BaseReceita>("ano_anterior");
  const [crescimento, setCrescimento] = useState("0");
  const [receitaManual, setReceitaManual] = useState("");
  const [arrAnterior, setArrAnterior] = useState("");
  const [arrAtual, setArrAtual] = useState("");
  const [arrInicializada, setArrInicializada] = useState(false);

  // Preenche as arrecadações do Estado com o que está gravado nas duas
  // apurações usadas na projeção (o usuário pode editar).
  useEffect(() => {
    if (arrInicializada || !indicesSalvos?.length) return;
    const formatar = (v: number | null | undefined) =>
      v != null && v > 0
        ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";
    setArrAtual(formatar(indicesSalvos[0]?.vaf_estadual));
    setArrAnterior(formatar(indicesSalvos[1]?.vaf_estadual));
    setArrInicializada(true);
  }, [indicesSalvos, arrInicializada]);

  const arrecadacaoAnterior = paraNumero(arrAnterior);
  const arrecadacaoAtual = paraNumero(arrAtual);
  const crescimentoArrecadacao =
    arrecadacaoAnterior != null && arrecadacaoAtual != null && arrecadacaoAnterior > 0
      ? (arrecadacaoAtual / arrecadacaoAnterior - 1) * 100
      : null;

  const boladaMeses = boladaMesesFjp;
  const temBolada = boladaMeses.some((v) => v != null && v > 0);

  const previsao = useMemo(
    () =>
      calcularPrevisao({
        serie,
        indiceProjetado,
        indiceAtual,
        base,
        crescimentoPct: paraNumero(crescimento) ?? 0,
        arrecadacaoAnterior,
        arrecadacaoAtual,
        receitaManual: paraNumero(receitaManual),
        boladaEstado: boladaMeses,
        boladaManual: paraNumero(receitaManual),
      }),
    [
      serie,
      indiceProjetado,
      indiceAtual,
      base,
      crescimento,
      arrecadacaoAnterior,
      arrecadacaoAtual,
      receitaManual,
      boladaMeses,
    ],
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

  const mediaRecebidaMensal = previsao.atual.mediaMensal;
  const valorRecebidoOuEstimado = (valor: number | null) => valor ?? mediaRecebidaMensal;

  const grafico = previsao.meses.map((m) => ({
    mes: NOME_MES[m.mes - 1]?.slice(0, 3),
    [`Recebido/estimado ${exercicio ?? ""}`]: valorRecebidoOuEstimado(m.recebido) ?? 0,
    [`Previsto ${exercicioPrevisto}`]: m.previsto ?? 0,
  }));

  const nomeBase = `previsao-vaf-${municipio?.nome ?? "municipio"}-${exercicioPrevisto}`;
  const ultimoMes = previsao.atual.mesesComValor.at(-1);
  const ultimoMesNome = ultimoMes ? (NOME_MES[ultimoMes - 1] as string) : "—";

  /** Memória de cálculo em pares rótulo/valor, usada no CSV e no PDF. */
  const memoria = useMemo(() => {
    const linhas: [string, string][] = [
      ["Município", municipio?.nome ?? "—"],
      ["Exercício recebido", String(exercicio ?? "—")],
      ["Exercício previsto", String(exercicioPrevisto)],
      ["Emitido em", new Date().toLocaleString("pt-BR")],
      ["Índice aplicado hoje", indiceTexto(indiceAtual)],
      [
        "Índice projetado",
        `${indiceTexto(indiceProjetado)} (${
          origemIndice === "media"
            ? "média das duas últimas apurações"
            : origemIndice === "ultima"
              ? "somente a última apuração"
              : origemIndice === "resolucao"
                ? `média da Resolução ${resolucaoProxima?.resolucao ?? resolucaoAtual?.resolucao ?? "SEF"}`
                : "digitado"
        })`,
      ],
      ["Variação do índice", formatarPercentual(previsao.variacaoIndicePct)],
    ];
    if (usandoResolucao) {
      linhas.push(
        [
          "Origem dos valores mensais",
          `Resolução ${resolucaoAtual?.resolucao ?? "—"} x transferências da FJP de ${exercicio ?? "—"}`,
        ],
        [
          "Meses da FJP disponíveis",
          String(boladaMeses.filter((v) => v != null && v > 0).length),
        ],
      );
    }
    if (base === "arrecadacao_estado") {
      linhas.push(
        ["Arrecadação do Estado — apuração anterior", formatarMoeda(arrecadacaoAnterior)],
        ["Arrecadação do Estado — apuração atual", formatarMoeda(arrecadacaoAtual)],
        [
          "Crescimento da arrecadação aplicado",
          formatarPercentual(previsao.crescimentoArrecadacaoPct),
        ],
      );
    }
    if (base === "crescimento") {
      linhas.push([
        "Crescimento informado",
        formatarPercentual(paraNumero(crescimento) ?? 0),
      ]);
    }
    linhas.push(
      [
        previsao.origem === "estado"
          ? "Bolada do Estado no ano (75% do VAF)"
          : "Bolada estimada pelo recebido (valor ÷ índice)",
        formatarMoeda(
          previsao.origem === "estado" ? previsao.boladaAnual : previsao.valorPorPontoAnual,
        ),
      ],
      [
        `Recebido até ${ultimoMesNome} de ${exercicio ?? "—"}`,
        formatarMoeda(previsao.atual.recebido),
      ],
      [`Ano fechado estimado ${exercicio ?? ""}`, formatarMoeda(previsao.atual.projecaoAnual)],
      [`Previsão anual ${exercicioPrevisto}`, formatarMoeda(previsao.previsaoAnual)],
      [
        "Diferença sobre o ano fechado",
        `${formatarMoeda(previsao.diferenca)} (${formatarPercentual(previsao.variacaoPct)})`,
      ],
    );
    return linhas;
  }, [
    municipio,
    exercicio,
    exercicioPrevisto,
    indiceAtual,
    indiceProjetado,
    origemIndice,
    base,
    crescimento,
    arrecadacaoAnterior,
    arrecadacaoAtual,
    previsao,
    usandoResolucao,
    resolucaoAtual,
    resolucaoProxima,
    boladaMeses,
    ultimoMesNome,
  ]);

  const linhasMes = previsao.meses.map((m) => ({
    mes: NOME_MES[m.mes - 1] as string,
    recebido: valorRecebidoOuEstimado(m.recebido),
    recebidoEstimado: m.recebido == null && mediaRecebidaMensal != null,
    previsto: m.previsto,
    diferenca:
      m.previsto != null && valorRecebidoOuEstimado(m.recebido) != null
        ? m.previsto - (valorRecebidoOuEstimado(m.recebido) as number)
        : null,
  }));

  const totalPrevisto = linhasMes.reduce((a, m) => a + (m.previsto ?? 0), 0);
  const totalRecebido = linhasMes.reduce((a, m) => a + (m.recebido ?? 0), 0);

  // ---- Dúvida sobre a memória de cálculo, explicada por IA ----
  const perguntarIa = useServerFn(explicarPrevisao);
  const [duvida, setDuvida] = useState("");
  const [respostaIa, setRespostaIa] = useState<string | null>(null);
  const [erroIa, setErroIa] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);

  const contextoIa = useMemo(() => {
    const memoriaTexto = memoria.map(([r, v]) => `- ${r}: ${v}`).join("\n");
    const mesesTexto = previsao.meses
      .map((m) => {
        const part = previsao.participacaoMeses[m.mes - 1];
        const bol = boladaMeses[m.mes - 1];
        return `- ${NOME_MES[m.mes - 1]}: recebido/estimado ${formatarMoeda(valorRecebidoOuEstimado(m.recebido))}; previsto ${formatarMoeda(
          m.previsto,
        )}${m.recebido == null && mediaRecebidaMensal != null ? " (média provisória dos meses recebidos)" : " (valor realizado)"}; participação do mês ${
          part != null ? `${(part * 100).toFixed(2)}%` : "—"
        }; bolada do Estado no mês ${formatarMoeda(bol ?? null)}`;
      })
      .join("\n");
    return [
      `Memória de cálculo:\n${memoriaTexto}`,
      `Valores mês a mês:\n${mesesTexto}`,
      `Totais: recebido ${formatarMoeda(totalRecebido)}; previsto ${formatarMoeda(totalPrevisto)}.`,
    ].join("\n\n");
  }, [memoria, previsao, boladaMeses, totalRecebido, totalPrevisto, mediaRecebidaMensal]);

  async function enviarDuvida() {
    const pergunta = duvida.trim();
    if (pergunta.length < 3) return;
    setConsultando(true);
    setErroIa(null);
    setRespostaIa(null);
    try {
      const r = await perguntarIa({ data: { pergunta, contexto: contextoIa } });
      setRespostaIa(r.resposta);
    } catch (e) {
      setErroIa(e instanceof Error ? e.message : "Não foi possível consultar a IA agora.");
    } finally {
      setConsultando(false);
    }
  }

  const sugestoes = [
    `Por que a previsão de ${exercicioPrevisto} ficou nesse valor?`,
    "Como foi calculado o valor previsto de janeiro?",
    "O que significa a participação do mês?",
  ];

  function exportar() {
    const csv = [
      montarCsv(["Memória de cálculo da previsão", ""], memoria),
      "",
      montarCsv(
        ["Mês", `Recebido/estimado ${exercicio ?? ""}`, `Previsto ${exercicioPrevisto}`, "Diferença"],
        [
          ...linhasMes.map((m) => [m.mes, m.recebido ?? "", m.previsto ?? "", m.diferenca ?? ""]),
          ["Total do ano", totalRecebido, totalPrevisto, totalPrevisto - totalRecebido],
        ],
      ),
    ].join("\n");
    baixarCsv(`${nomeBase}.csv`, csv);
  }

  async function exportarPdf() {
    const { gerarPdf } = await import("@/lib/vaf/relatorioPdf");
    await gerarPdf(`${nomeBase}.pdf`, [
      { tipo: "titulo", texto: `Previsão de repasse do VAF — ${exercicioPrevisto}` },
      { tipo: "secao", texto: "Memória de cálculo" },
      {
        tipo: "tabela",
        cabecalho: ["Item", "Valor"],
        larguras: [4, 2.6],
        direita: [false, true],
        linhas: memoria.map(([r, v]) => [r, v]),
      },
      { tipo: "secao", texto: "Mês a mês" },
      {
        tipo: "tabela",
        cabecalho: [
          "Mês",
          `Recebido/estimado ${exercicio ?? ""}`,
          `Previsto ${exercicioPrevisto}`,
          "Diferença",
        ],
        larguras: [2, 2, 2, 2],
        direita: [false, true, true, true],
        linhas: [
          ...linhasMes.map((m) => [
            m.mes,
            formatarMoeda(m.recebido),
            formatarMoeda(m.previsto),
            formatarMoeda(m.diferenca),
          ]),
          [
            "Total do ano",
            formatarMoeda(totalRecebido),
            formatarMoeda(totalPrevisto),
            formatarMoeda(totalPrevisto - totalRecebido),
          ],
        ],
      },
      {
        tipo: "texto",
        texto:
          "O repasse de cada mês é o índice do município aplicado sobre a bolada do VAF do Estado (75% da transferência líquida). A apuração do VAF não é alterada.",
      },
    ]);
  }

  const semDados = !isLoading && previsao.atual.mesesComValor.length === 0;
  const anosDisponiveis = useMemo(
    () =>
      Array.from(new Set([...(exercicios ?? []), ...(exerciciosEstado ?? [])])).sort(
        (a, b) => b - a,
      ),
    [exercicios, exerciciosEstado],
  );

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
                {anosDisponiveis.map((a) => (
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
                {indiceResolucaoProjetado != null && (
                  <SelectItem value="resolucao">
                    Média da Resolução{" "}
                    {resolucaoProxima?.resolucao ?? resolucaoAtual?.resolucao ?? "SEF"}
                  </SelectItem>
                )}
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
                <SelectItem value="crescimento">Crescimento digitado (%)</SelectItem>
                <SelectItem value="arrecadacao_estado">
                  Crescimento pela arrecadação do Estado
                </SelectItem>
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
            {base === "arrecadacao_estado" && (
              <>
                <Label>Arrecadação do Estado — ano da apuração anterior (R$)</Label>
                <Input
                  value={arrAnterior}
                  onChange={(e) => setArrAnterior(e.target.value)}
                  placeholder="925.287.575.000,00"
                />
                <Label>Arrecadação do Estado — ano da apuração atual (R$)</Label>
                <Input
                  value={arrAtual}
                  onChange={(e) => setArrAtual(e.target.value)}
                  placeholder="1.004.153.256.799,00"
                />
                <p className="text-xs text-muted-foreground">
                  Crescimento calculado: {formatarPercentual(crescimentoArrecadacao)}
                  {crescimentoArrecadacao == null &&
                    " — informe as duas arrecadações para calcular"}
                </p>
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

      {usandoResolucao && (
        <Card className="border-primary/40">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Esta prefeitura não tem apuração própria carregada, então os números vêm das fontes
            oficiais: índice médio da{" "}
            <strong>Resolução {resolucaoAtual?.resolucao ?? "—"}</strong> aplicada em{" "}
            {exercicio ?? "—"} e transferências da FJP ({" "}
            {boladaMeses.filter((v) => v != null && v > 0).length} meses cadastrados). Os valores
            mensais são estimativa oficial (índice × repasse do Estado), não o crédito efetivo.
          </CardContent>
        </Card>
      )}

      {semDados && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Ainda não há valores do critério VAF importados para {exercicio ?? "este exercício"} e
            também não há índice em resolução para esta prefeitura. Importe o extrato do Portal da
            FJP, cadastre a resolução ou escolha “Digitar a receita” para simular.
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
              {base === "arrecadacao_estado" && (
                <>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground">
                      Arrecadação do Estado — ano da apuração anterior
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {formatarMoeda(arrecadacaoAnterior)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground">
                      Arrecadação do Estado — ano da apuração atual
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {formatarMoeda(arrecadacaoAtual)}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1.5 text-muted-foreground">
                      Crescimento da arrecadação aplicado
                    </td>
                    <td className="py-1.5 text-right font-medium">
                      {formatarPercentual(previsao.crescimentoArrecadacaoPct)}
                    </td>
                  </tr>
                </>
              )}
              <tr className="border-b">
                <td className="py-1.5 text-muted-foreground">
                  {previsao.origem === "estado"
                    ? "Bolada do Estado no ano (75% do VAF)"
                    : "Bolada estimada pelo recebido (valor ÷ índice)"}
                  {base === "arrecadacao_estado" ? ", já com o crescimento" : ""}
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportarPdf()}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
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
                <Bar
                  dataKey={`Recebido/estimado ${exercicio ?? ""}`}
                  fill="hsl(var(--muted-foreground))"
                />
                <Bar dataKey={`Previsto ${exercicioPrevisto}`} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Mês</th>
                  <th className="py-2 text-right">Recebido/estimado {exercicio ?? ""}</th>
                  <th className="py-2 text-right">Previsto {exercicioPrevisto}</th>
                  <th className="py-2 text-right font-bold">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {previsao.meses.map((m) => {
                  const recebidoComparacao = valorRecebidoOuEstimado(m.recebido);
                  const recebidoEstimado = m.recebido == null && recebidoComparacao != null;
                  const dif =
                    m.previsto != null && recebidoComparacao != null
                      ? m.previsto - recebidoComparacao
                      : null;
                  const corResultado =
                    dif != null && dif > 0
                      ? "text-normal-foreground"
                      : dif != null && dif < 0
                        ? "text-destructive"
                        : "";
                  const participacao = previsao.participacaoMeses[m.mes - 1] ?? null;
                  const boladaMes = boladaMeses[m.mes - 1] ?? null;
                  const explicacao =
                    m.previsto != null && previsao.previsaoAnual != null && participacao != null
                      ? [
                          `Previsão anual ${formatarMoeda(previsao.previsaoAnual)} × participação do mês ${(participacao * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% = ${formatarMoeda(m.previsto)}.`,
                          boladaMes != null && boladaMes > 0
                            ? `A participação vem da bolada do Estado em ${NOME_MES[m.mes - 1]}: ${formatarMoeda(boladaMes)} (75% da transferência líquida da FJP).`
                            : `Sem bolada da FJP cadastrada para ${NOME_MES[m.mes - 1]}: a participação foi estimada pela média dos meses conhecidos.`,
                        ]
                      : null;
                  return (
                    <tr key={m.mes} className="border-b last:border-0">
                      <td className="py-1.5">{NOME_MES[m.mes - 1]}</td>
                      <td className="py-1.5 text-right">
                        <span
                          className={recebidoEstimado ? "border-b border-dashed border-muted-foreground/50" : ""}
                          title={
                            recebidoEstimado
                              ? `Estimativa temporária pela média dos meses já recebidos: ${formatarMoeda(mediaRecebidaMensal)}. Será substituída quando o valor real chegar.`
                              : "Valor real recebido"
                          }
                        >
                          {formatarMoeda(recebidoComparacao)}
                        </span>
                      </td>
                      <td className={`py-1.5 text-right font-medium ${corResultado}`}>
                        {explicacao ? (
                          <span className="group relative inline-block cursor-help border-b border-dashed border-muted-foreground/50">
                            {formatarMoeda(m.previsto)}
                            <span className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-72 rounded-md border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-md group-hover:block">
                              {explicacao.map((linha) => (
                                <span key={linha} className="block first:mb-1">
                                  {linha}
                                </span>
                              ))}
                            </span>
                          </span>
                        ) : (
                          formatarMoeda(m.previsto)
                        )}
                      </td>
                      <td className={`py-1.5 text-right font-bold ${corResultado}`}>
                        {formatarMoeda(dif)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {(() => {
                  const totRecebido = previsao.meses.reduce(
                    (s, m) => s + (valorRecebidoOuEstimado(m.recebido) ?? 0),
                    0,
                  );
                  const totPrevisto = previsao.meses.reduce((s, m) => s + (m.previsto ?? 0), 0);
                  const temRecebido = previsao.meses.some(
                    (m) => valorRecebidoOuEstimado(m.recebido) != null,
                  );
                  const totDif = temRecebido ? totPrevisto - totRecebido : null;
                  const corTotal =
                    totDif != null && totDif > 0
                      ? "text-normal-foreground"
                      : totDif != null && totDif < 0
                        ? "text-destructive"
                        : "";
                  return (
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2">Total anual</td>
                      <td className="py-2 text-right">{formatarMoeda(temRecebido ? totRecebido : null)}</td>
                      <td className={`py-2 text-right ${corTotal}`}>{formatarMoeda(totPrevisto)}</td>
                      <td className={`py-2 text-right font-bold ${corTotal}`}>
                        {formatarMoeda(totDif)}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Nos meses ainda sem crédito, a coluna recebido usa provisoriamente a média dos meses já
            informados; cada valor é substituído automaticamente quando o valor real chegar. O
            repasse previsto usa o índice projetado sobre a bolada anual e a distribui na proporção
            mensal observada. A apuração do VAF não é alterada.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Tire uma dúvida sobre esta previsão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Escreva a dúvida com suas palavras. A explicação é gerada a partir dos números que estão
            nesta tela (índices, participações e valores mês a mês).
          </p>
          <Textarea
            value={duvida}
            onChange={(e) => setDuvida(e.target.value)}
            rows={3}
            placeholder="Ex.: por que o previsto de janeiro ficou nesse valor?"
          />
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => setDuvida(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => void enviarDuvida()} disabled={consultando || duvida.trim().length < 3}>
              {consultando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Explicar
                </>
              )}
            </Button>
            {respostaIa && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRespostaIa(null);
                  setDuvida("");
                }}
              >
                Limpar
              </Button>
            )}
          </div>
          {erroIa && <p className="text-sm text-destructive">{erroIa}</p>}
          {respostaIa && (
            <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">
              {respostaIa}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
