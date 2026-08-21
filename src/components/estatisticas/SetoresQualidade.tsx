import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarMoeda, formatarCompacto } from "@/lib/format";
import { descricaoCnae, formatarCodigoCnae } from "@/lib/vaf/cnae";
import { MESES_CURTOS } from "@/lib/vaf/tipoRetorno";
import {
  agregarPorContribuinte,
  corSerie,
  curvaPareto,
  empresasParaAtingir,
  periodoDaCarga,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { estiloTooltip } from "./MaioresContribuintes";
import { DetalheContribuinte } from "./DetalheContribuinte";
import { DetalheSetor } from "./DetalheSetor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SITUACOES = [
  { chave: "OMISSO", rotulo: "Omissos", cor: "var(--omisso-foreground)" },
  { chave: "ZERADO", rotulo: "Zerados", cor: "var(--zerado-foreground)" },
  { chave: "FORA_DO_PRAZO", rotulo: "Fora do prazo", cor: "var(--prazo-foreground)" },
  { chave: "DISCREPANTE", rotulo: "Discrepantes", cor: "var(--discrepante-foreground)" },
] as const;

export function SetoresQualidade({
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
  const [cnaeDetalhe, setCnaeDetalhe] = useState<string | null>(null);
  const [ieDetalhe, setIeDetalhe] = useState<string | null>(null);
  const anoAtivo = ano && anos.includes(Number(ano)) ? Number(ano) : (anos[0] ?? null);

  const periodoPorCarga = useMemo(
    () => new Map(cargas.map((c) => [c.id, periodoDaCarga(c)])),
    [cargas],
  );

  const linhasAno = useMemo(
    () =>
      linhas.filter((l) => {
        const p = periodoPorCarga.get(l.carga_id);
        return p && p.ano === anoAtivo;
      }),
    [linhas, periodoPorCarga, anoAtivo],
  );

  const ranking = useMemo(
    () => agregarPorContribuinte(linhasAno, periodoPorCarga),
    [linhasAno, periodoPorCarga],
  );

  const pareto = useMemo(() => curvaPareto(ranking), [ranking]);
  const marcos = useMemo(
    () => [50, 80, 95].map((alvo) => ({ alvo, empresas: empresasParaAtingir(ranking, alvo) })),
    [ranking],
  );

  const porCnae = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of linhasAno) {
      const cnae = l.cnae || "sem CNAE";
      mapa.set(cnae, (mapa.get(cnae) ?? 0) + Number(l.vaf_atual ?? 0));
    }
    return [...mapa.entries()]
      .map(([cnae, vaf]) => ({
        cnae,
        rotulo: formatarCodigoCnae(cnae),
        descricao: descricaoCnae(cnae) ?? "",
        vaf,
      }))
      .sort((a, b) => b.vaf - a.vaf)
      .slice(0, 12);
  }, [linhasAno]);

  const sazonalidade = useMemo(() => {
    const mapa = new Map<number, Record<string, number>>();
    for (const l of linhas) {
      const p = periodoPorCarga.get(l.carga_id);
      if (!p?.mes || p.mes > 12) continue;
      const atual = mapa.get(p.mes) ?? {};
      atual[String(p.ano)] = (atual[String(p.ano)] ?? 0) + Number(l.vaf_atual ?? 0);
      mapa.set(p.mes, atual);
    }
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_CURTOS[i],
      ...(mapa.get(i + 1) ?? {}),
    }));
  }, [linhas, periodoPorCarga]);

  const qualidade = useMemo(() => {
    const mapa = new Map<string, Record<string, number>>();
    for (const l of linhas) {
      const p = periodoPorCarga.get(l.carga_id);
      if (!p) continue;
      const atual: Record<string, number> = mapa.get(p.rotulo) ?? { ordem: p.ordem };
      for (const s of SITUACOES) {
        if (l.situacoes?.includes(s.chave)) atual[s.chave] = (atual[s.chave] ?? 0) + 1;
      }
      mapa.set(p.rotulo, atual);
    }
    return [...mapa.entries()]
      .map(([competencia, v]) => ({ competencia, ...v }) as { competencia: string } & Record<string, number>)
      .sort((a, b) => (a["ordem"] ?? 0) - (b["ordem"] ?? 0));
  }, [linhas, periodoPorCarga]);

  const declarantes = useMemo(() => {
    const porPeriodo = new Map<string, { ordem: number; ies: Set<string> }>();
    for (const l of linhas) {
      const p = periodoPorCarga.get(l.carga_id);
      if (!p || !l.entregou_declaracao) continue;
      const atual = porPeriodo.get(p.rotulo) ?? { ordem: p.ordem, ies: new Set<string>() };
      atual.ies.add(l.inscricao_estadual);
      porPeriodo.set(p.rotulo, atual);
    }
    const ordenado = [...porPeriodo.entries()].sort((a, b) => a[1].ordem - b[1].ordem);
    return ordenado.map(([competencia, atual], i) => {
      const anterior = i > 0 ? ordenado[i - 1]![1].ies : new Set<string>();
      let entraram = 0;
      let sairam = 0;
      for (const ie of atual.ies) if (!anterior.has(ie)) entraram += 1;
      for (const ie of anterior) if (!atual.ies.has(ie)) sairam += 1;
      return {
        competencia,
        entraram: i === 0 ? 0 : entraram,
        sairam: i === 0 ? 0 : -sairam,
        declarantes: atual.ies.size,
      };
    });
  }, [linhas, periodoPorCarga]);

  const eixoValor = {
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    stroke: "var(--muted-foreground)",
  } as const;

  return (
    <div className="space-y-6">
      <div className="w-40">
        <label className="mb-1 block text-xs text-muted-foreground">Ano de referência</label>
        <Select value={anoAtivo ? String(anoAtivo) : ""} onValueChange={setAno}>
          <SelectTrigger aria-label="Ano de referência">
            <SelectValue placeholder="Ano" />
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

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Concentração do VAF (Pareto) — {anoAtivo ?? "—"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {marcos
              .map((m) => `${m.empresas} empresa(s) somam ${m.alvo}% do VAF`)
              .join(" · ")}
          </p>
        </CardHeader>
        <CardContent className="h-80 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={pareto}
              margin={{ left: -12, right: 16 }}
              className="cursor-pointer"
              onClick={(estado: { activePayload?: { payload?: { ie?: string } }[] }) => {
                const ie = estado?.activePayload?.[0]?.payload?.ie;
                if (ie) setIeDetalhe(ie);
              }}
            >
              <defs>
                <linearGradient id="grad-pareto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="posicao" {...eixoValor} />
              <YAxis {...eixoValor} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                contentStyle={estiloTooltip}
                labelFormatter={(p: number) => `${p}ª maior empresa`}
                formatter={(v: number, nome, item) => [
                  `${v.toFixed(1)}% · ${item?.payload?.nome ?? ""}`,
                  nome === "acumulado" ? "Acumulado" : "Participação",
                ]}
              />
              <Area
                type="monotone"
                className="cursor-pointer"
                activeDot={{ r: 5, cursor: "pointer" }}
                dataKey="acumulado"
                stroke="var(--primary)"
                fill="url(#grad-pareto)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            VAF por setor (CNAE) — {anoAtivo ?? "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-96 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porCnae} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                {...eixoValor}
                tickFormatter={formatarCompacto}
              />
              <YAxis type="category" dataKey="rotulo" width={90} {...eixoValor} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={estiloTooltip}
                labelFormatter={(r: string, itens) =>
                  itens?.[0]?.payload?.descricao ? `${r} — ${itens[0].payload.descricao}` : r
                }
                formatter={(v: number) => [formatarMoeda(v), "VAF"]}
              />
              <Bar
                dataKey="vaf"
                fill="var(--gold)"
                radius={[0, 6, 6, 0]}
                className="cursor-pointer"
                onClick={(d: { cnae?: string } & Record<string, unknown>) => {
                  const alvo = (d?.cnae ?? (d as { payload?: { cnae?: string } })?.payload?.cnae) as
                    | string
                    | undefined;
                  if (alvo) setCnaeDetalhe(alvo);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
        <CardContent className="p-6 pt-0">
          <p className="mb-2 text-xs text-muted-foreground">
            Clique em uma barra ou linha para abrir o detalhamento do setor.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CNAE</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">VAF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCnae.map((c) => (
                <TableRow
                  key={c.cnae}
                  className="cursor-pointer"
                  onClick={() => setCnaeDetalhe(c.cnae)}
                >
                  <TableCell className="font-medium tabular-nums">{c.rotulo}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.descricao || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatarMoeda(c.vaf)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Sazonalidade mensal do VAF
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            VAF total do município por mês, um ano sobre o outro.
          </p>
        </CardHeader>
        <CardContent className="h-80 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sazonalidade} margin={{ left: -8, right: 16 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" {...eixoValor} />
              <YAxis {...eixoValor} tickFormatter={formatarCompacto} />
              <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => formatarMoeda(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {anos.map((a, i) => (
                <Line
                  key={a}
                  type="monotone"
                  dataKey={String(a)}
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
          <CardTitle className="font-display text-base font-semibold">
            Qualidade da declaração por competência
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Número de contribuintes omissos, zerados, fora do prazo e discrepantes.
          </p>
        </CardHeader>
        <CardContent className="h-80 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={qualidade} margin={{ left: -12, right: 16 }}>
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="competencia" {...eixoValor} />
              <YAxis {...eixoValor} allowDecimals={false} />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={estiloTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {SITUACOES.map((s) => (
                <Bar key={s.chave} dataKey={s.chave} name={s.rotulo} fill={s.cor} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="font-display text-base font-semibold">
            Entradas e saídas de declarantes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Quantas empresas passaram a declarar e quantas deixaram de declarar em cada competência.
          </p>
        </CardHeader>
        <CardContent className="h-80 p-6 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={declarantes} margin={{ left: -12, right: 16 }} stackOffset="sign">
              <CartesianGrid strokeDasharray="2 6" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="competencia" {...eixoValor} />
              <YAxis {...eixoValor} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={estiloTooltip}
                formatter={(v: number, n) => [Math.abs(v), n === "entraram" ? "Entraram" : "Saíram"]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="entraram" name="Entraram" stackId="d" fill="var(--normal-foreground)" />
              <Bar dataKey="sairam" name="Saíram" stackId="d" fill="var(--omisso-foreground)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DetalheSetor
        cnae={cnaeDetalhe}
        cargas={cargas}
        linhas={linhas}
        ano={anoAtivo}
        onOpenChange={(aberto) => !aberto && setCnaeDetalhe(null)}
        onSelecionarContribuinte={(ie) => {
          setCnaeDetalhe(null);
          setIeDetalhe(ie);
        }}
      />

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
