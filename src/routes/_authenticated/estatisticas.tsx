/**
 * Estatísticas: panorama comparativo de todos os municípios visíveis —
 * índice do ano-base contra o índice do período escolhido (provisório por
 * padrão), quem subiu, quem caiu e as providências em andamento.
 */

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Calculator, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMunicipioAtivo, useMunicipios } from "@/hooks/useMunicipio";
import {
  useAcoesPanorama,
  useImpugnacoesPanorama,
  useIndicesPanorama,
  useOficiosPanorama,
} from "@/hooks/usePanoramaMunicipios";
import {
  montarPanorama,
  ROTULO_SITUACAO,
  type LinhaPanorama,
  type TipoAlvo,
} from "@/lib/vaf/panorama";
import { formatarIndice } from "@/lib/vaf/indice";
import { rotuloRemessa } from "@/lib/vaf/tipoRetorno";
import { formatarMoeda, formatarPercentual } from "@/lib/format";
import { rotuloStatus } from "@/hooks/useImpugnacoes";
import { baixarCsv, montarCsv } from "@/lib/csv";

type Ordem = "variacao" | "indice" | "nome";

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const Route = createFileRoute("/_authenticated/estatisticas")({
  validateSearch: (search: Record<string, unknown>) => ({
    base: num(search["base"]),
    alvo: num(search["alvo"]),
    tipo: search["tipo"] === "definitivo" ? ("definitivo" as TipoAlvo) : ("provisorio" as TipoAlvo),
    remessa: num(search["remessa"]),
  }),
  head: () => ({
    meta: [
      { title: "Estatísticas — panorama do VAF por município" },
      {
        name: "description",
        content:
          "Compare o índice do ano-base com o índice provisório ou definitivo de cada município, veja quem subiu, quem caiu e as providências em andamento.",
      },
      { property: "og:title", content: "Panorama do VAF por município" },
      {
        property: "og:description",
        content:
          "Índice e valor do ano-base contra o período comparado, variação por município e providências tomadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaEstatisticas,
});

function PaginaEstatisticas() {
  const busca = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: municipios, isLoading: carregandoMunicipios } = useMunicipios();
  const { data: indices, isLoading: carregandoIndices } = useIndicesPanorama();
  const { data: acoes } = useAcoesPanorama();
  const { data: impugnacoes } = useImpugnacoesPanorama();
  const { data: oficios } = useOficiosPanorama();
  const { trocar: trocarMunicipio, podeTrocar } = useMunicipioAtivo();

  const [texto, setTexto] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("variacao");
  const [detalhe, setDetalhe] = useState<LinhaPanorama | null>(null);

  /** Leva o usuário ao Índice do VAF já com a prefeitura da linha ativa. */
  function irApurar(linha: LinhaPanorama) {
    if (podeTrocar) trocarMunicipio(linha.municipioId);
    void navigate({ to: "/analises", search: { aba: "indice" } });
  }

  const lista = useMemo(() => indices ?? [], [indices]);
  const exercicios = useMemo(
    () => [...new Set(lista.map((i) => i.exercicio))].sort((a, b) => b - a),
    [lista],
  );

  const anoAlvo = busca.alvo ?? exercicios[0] ?? new Date().getFullYear();
  const anoBase = busca.base ?? exercicios.find((e) => e < anoAlvo) ?? anoAlvo - 1;
  const tipo = busca.tipo;

  const remessas = useMemo(
    () =>
      [
        ...new Set(
          lista
            .filter((i) => i.exercicio === anoAlvo && i.tipo_indice === tipo && i.competencia_mes)
            .map((i) => i.competencia_mes as number),
        ),
      ].sort((a, b) => b - a),
    [lista, anoAlvo, tipo],
  );
  const remessa = busca.remessa && remessas.includes(busca.remessa) ? busca.remessa : null;

  function trocar(campos: Partial<typeof busca>) {
    navigate({ to: ".", search: (p) => ({ ...p, ...campos }) });
  }

  const linhas = useMemo(
    () =>
      montarPanorama({
        municipios: municipios ?? [],
        indices: lista,
        acoes: acoes ?? [],
        impugnacoes: impugnacoes ?? [],
        oficios: oficios ?? [],
        anoBase,
        anoAlvo,
        tipo,
        remessa,
      }),
    [municipios, lista, acoes, impugnacoes, oficios, anoBase, anoAlvo, tipo, remessa],
  );

  const visiveis = useMemo(() => {
    const alvo = texto.trim().toLowerCase();
    const filtradas = alvo
      ? linhas.filter((l) => l.nome.toLowerCase().includes(alvo))
      : [...linhas];
    filtradas.sort((a, b) => {
      if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
      if (ordem === "indice") return Number(b.alvo?.indice ?? -1) - Number(a.alvo?.indice ?? -1);
      return (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity);
    });
    return filtradas;
  }, [linhas, texto, ordem]);

  const comparados = linhas.filter((l) => l.base && l.alvo);
  const resumo = {
    comparados: comparados.length,
    subiram: linhas.filter((l) => l.situacao === "subiu").length,
    cairam: linhas.filter((l) => l.situacao === "caiu").length,
    sem: linhas.filter((l) => l.situacao === "sem_apuracao").length,
    somaBase: comparados.reduce((s, l) => s + Number(l.base!.indice), 0),
    somaAlvo: comparados.reduce((s, l) => s + Number(l.alvo!.indice), 0),
  };
  const variacaoTotal =
    resumo.somaBase > 0 ? ((resumo.somaAlvo - resumo.somaBase) / resumo.somaBase) * 100 : null;

  const dadosVariacao = visiveis
    .filter((l) => l.variacao != null)
    .map((l) => ({ nome: l.nome, variacao: Number(l.variacao!.toFixed(2)) }))
    .sort((a, b) => a.variacao - b.variacao);

  const dadosIndices = visiveis
    .filter((l) => l.base || l.alvo)
    .map((l) => ({
      nome: l.nome,
      base: Number(l.base?.indice ?? 0),
      atual: Number(l.alvo?.indice ?? 0),
    }));

  function exportar() {
    const csv = montarCsv(
      [
        "Município",
        `Índice ${anoBase}`,
        `Valor ${anoBase}`,
        `Índice ${anoAlvo}`,
        `Valor ${anoAlvo}`,
        "Variação (pontos)",
        "Variação (%)",
        "Situação",
        "Ações do plano",
        "Ofícios enviados (plano)",
        "Ações concluídas",
        "A recuperar",
        "Impugnações",
        "Ofícios emitidos",
      ],
      visiveis.map((l) => [
        l.nome,
        l.base ? formatarIndice(Number(l.base.indice)) : "",
        l.base ? Number(l.base.valor_liquido).toFixed(2).replace(".", ",") : "",
        l.alvo ? formatarIndice(Number(l.alvo.indice)) : "",
        l.alvo ? Number(l.alvo.valor_liquido).toFixed(2).replace(".", ",") : "",
        l.pontos != null ? formatarIndice(l.pontos) : "",
        l.variacao != null ? l.variacao.toFixed(2).replace(".", ",") : "",
        ROTULO_SITUACAO[l.situacao],
        l.providencias.acoes,
        l.providencias.acoesOficio,
        l.providencias.acoesConcluidas,
        l.providencias.valorRecuperavel.toFixed(2).replace(".", ","),
        l.providencias.impugnacoes.length,
        l.providencias.oficios,
      ]),
    );
    baixarCsv(`panorama-vaf-${anoBase}-x-${anoAlvo}.csv`, csv);
  }

  if (carregandoMunicipios || carregandoIndices) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!lista.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhum índice apurado ainda. Apure o índice em “Análises do VAF” para montar o panorama.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Panorama das prefeituras: índice e valor do ano-base contra o período comparado, quem
          subiu, quem caiu e as providências em andamento.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="ano-base">Ano-base</Label>
            <Select value={String(anoBase)} onValueChange={(v) => trocar({ base: Number(v) })}>
              <SelectTrigger id="ano-base" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercicios.map((e) => (
                  <SelectItem key={e} value={String(e)}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ano-alvo">Comparar com</Label>
            <Select
              value={String(anoAlvo)}
              onValueChange={(v) => trocar({ alvo: Number(v), remessa: null })}
            >
              <SelectTrigger id="ano-alvo" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercicios.map((e) => (
                  <SelectItem key={e} value={String(e)}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo-indice">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(v) => trocar({ tipo: v as TipoAlvo, remessa: null })}
            >
              <SelectTrigger id="tipo-indice" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="provisorio">Provisório</SelectItem>
                <SelectItem value="definitivo">Definitivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {remessas.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="remessa">Remessa</Label>
              <Select
                value={remessa ? String(remessa) : "recente"}
                onValueChange={(v) => trocar({ remessa: v === "recente" ? null : Number(v) })}
              >
                <SelectTrigger id="remessa" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recente">Mais recente</SelectItem>
                  {remessas.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {rotuloRemessa(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="busca-municipio">Município</Label>
            <Input
              id="busca-municipio"
              className="w-56"
              placeholder="Filtrar pelo nome"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ordem">Ordenar por</Label>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
              <SelectTrigger id="ordem" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variacao">Maior variação</SelectItem>
                <SelectItem value="indice">Maior índice atual</SelectItem>
                <SelectItem value="nome">Nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportar} className="ml-auto">
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Municípios comparados" valor={String(resumo.comparados)} />
        <Kpi rotulo="Subiram" valor={String(resumo.subiram)} />
        <Kpi rotulo="Caíram" valor={String(resumo.cairam)} />
        <Kpi
          rotulo="Variação da soma dos índices"
          valor={formatarPercentual(variacaoTotal)}
          apoio={`${formatarIndice(resumo.somaBase)} → ${formatarIndice(resumo.somaAlvo)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {anoBase} x {anoAlvo} {tipo === "definitivo" ? "definitivo" : "provisório"}
            {remessa ? ` · ${rotuloRemessa(remessa)}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Município</TableHead>
                  <TableHead className="text-right">Índice {anoBase}</TableHead>
                  <TableHead className="text-right">Valor {anoBase}</TableHead>
                  <TableHead className="text-right">Índice {anoAlvo}</TableHead>
                  <TableHead className="text-right">Valor {anoAlvo}</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Providências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((l) => (
                  <TableRow
                    key={l.municipioId}
                    className="cursor-pointer"
                    onClick={() => setDetalhe(l)}
                  >
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {l.base ? formatarIndice(Number(l.base.indice)) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {l.base ? formatarMoeda(Number(l.base.valor_liquido)) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {l.alvo ? formatarIndice(Number(l.alvo.indice)) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {l.alvo ? formatarMoeda(Number(l.alvo.valor_liquido)) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.variacao != null ? (
                        <span
                          className={
                            l.situacao === "caiu"
                              ? "text-destructive"
                              : l.situacao === "subiu"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : ""
                          }
                        >
                          {formatarPercentual(l.variacao)}
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {l.pontos != null && l.pontos > 0 ? "+" : ""}
                            {l.pontos != null ? formatarIndice(l.pontos) : ""}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        <SituacaoBadge linha={l} />
                        {(!l.base || !l.alvo) && (
                          <AcaoApurar
                            linha={l}
                            anoBase={anoBase}
                            anoAlvo={anoAlvo}
                            tipo={tipo}
                            onApurar={() => irApurar(l)}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Providencia linha={l} />
                    </TableCell>
                  </TableRow>
                ))}
                {!visiveis.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Nenhum município encontrado com esse filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {dadosVariacao.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Variação do índice por município</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, dadosVariacao.length * 34)}>
              <BarChart data={dadosVariacao} layout="vertical" margin={{ left: 24, right: 24 }}>
                <XAxis type="number" tickFormatter={(v: number) => `${v}%`} fontSize={12} />
                <YAxis type="category" dataKey="nome" width={150} fontSize={12} />
                <ChartTooltip formatter={(v: number) => [`${v}%`, "Variação"]} />
                <Bar dataKey="variacao" radius={4}>
                  {dadosVariacao.map((d) => (
                    <Cell
                      key={d.nome}
                      fill={d.variacao < 0 ? "var(--destructive)" : "var(--chart-1)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {dadosIndices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Índice {anoBase} x {anoAlvo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dadosIndices} margin={{ left: 8, right: 8 }}>
                <XAxis dataKey="nome" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis fontSize={11} tickFormatter={(v: number) => v.toFixed(3)} />
                <ChartTooltip formatter={(v: number) => formatarIndice(v)} />
                <Legend />
                <Bar dataKey="base" name={`Índice ${anoBase}`} fill="var(--chart-2)" radius={3} />
                <Bar dataKey="atual" name={`Índice ${anoAlvo}`} fill="var(--chart-1)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Sheet open={!!detalhe} onOpenChange={(v) => !v && setDetalhe(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle>{detalhe.nome}</SheetTitle>
                <SheetDescription>
                  Comparação entre {anoBase} e {anoAlvo}{" "}
                  {tipo === "definitivo" ? "definitivo" : "provisório"}.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <Composicao titulo={`Ano-base ${anoBase}`} registro={detalhe.base} />
                <Composicao titulo={`Comparado ${anoAlvo}`} registro={detalhe.alvo} />
                {(!detalhe.base || !detalhe.alvo) && (
                  <div className="space-y-2 rounded-md border border-dashed p-3">
                    <p className="text-sm text-muted-foreground">
                      Para este município entrar no comparativo, apure o índice em Análises do
                      VAF: suba o arquivo da SEFAZ, apure e clique em “Salvar apuração”.
                    </p>
                    <AcaoApurar
                      linha={detalhe}
                      anoBase={anoBase}
                      anoAlvo={anoAlvo}
                      tipo={tipo}
                      onApurar={() => {
                        setDetalhe(null);
                        irApurar(detalhe);
                      }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Providências</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                      Plano de recuperação: {detalhe.providencias.acoes} ações ·{" "}
                      {detalhe.providencias.acoesOficio} com ofício enviado ·{" "}
                      {detalhe.providencias.acoesConcluidas} concluídas
                    </li>
                    <li>
                      A recuperar: {formatarMoeda(detalhe.providencias.valorRecuperavel)}
                    </li>
                    <li>Ofícios emitidos no exercício: {detalhe.providencias.oficios}</li>
                  </ul>
                  {detalhe.providencias.impugnacoes.length ? (
                    <ul className="space-y-1 text-sm">
                      {detalhe.providencias.impugnacoes.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{rotuloStatus(i.status)}</Badge>
                          <span>{i.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {i.protocolo_numero ? `SEI ${i.protocolo_numero}` : "sem protocolo"}
                            {i.protocolado_em
                              ? ` · ${new Date(`${i.protocolado_em}T12:00:00`).toLocaleDateString("pt-BR")}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma impugnação montada para este exercício.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Composicao({
  titulo,
  registro,
}: {
  titulo: string;
  registro: LinhaPanorama["base"];
}) {
  if (!registro) {
    return (
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">Sem apuração gravada.</p>
      </div>
    );
  }
  const itens: [string, string][] = [
    ["Índice", formatarIndice(Number(registro.indice))],
    ["Valor líquido", formatarMoeda(Number(registro.valor_liquido))],
    ["VAF próprio", formatarMoeda(Number(registro.vaf_proprio))],
    ["Crédito externo", formatarMoeda(Number(registro.credito_externo))],
    ["Crédito interno", formatarMoeda(Number(registro.credito_interno))],
    ["Crédito próprio", formatarMoeda(Number(registro.credito_proprio))],
    ["Débito", formatarMoeda(Number(registro.debito))],
  ];
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">
        {titulo}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {registro.tipo_indice === "definitivo" ? "Definitivo" : "Provisório"}
          {registro.competencia_mes ? ` · ${rotuloRemessa(registro.competencia_mes)}` : ""}
          {registro.estimado ? " · estimado" : ""}
        </span>
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {itens.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AcaoApurar({
  linha,
  anoBase,
  anoAlvo,
  tipo,
  onApurar,
}: {
  linha: LinhaPanorama;
  anoBase: number;
  anoAlvo: number;
  tipo: TipoAlvo;
  onApurar: () => void;
}) {
  const falta = !linha.base
    ? !linha.alvo
      ? `faltam os índices de ${anoBase} e ${anoAlvo}`
      : `falta o índice de ${anoBase}`
    : `falta o índice de ${anoAlvo} (${tipo === "definitivo" ? "definitivo" : "provisório"})`;
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onApurar();
        }}
      >
        <Calculator className="mr-1.5 h-3.5 w-3.5" /> Fazer apuração
      </Button>
      <p className="text-[11px] text-muted-foreground">{falta}</p>
    </div>
  );
}

function SituacaoBadge({ linha }: { linha: LinhaPanorama }) {
  const rotulo = ROTULO_SITUACAO[linha.situacao];
  if (linha.situacao === "subiu")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" variant="secondary">
        <ArrowUpRight className="mr-1 h-3 w-3" /> {rotulo}
      </Badge>
    );
  if (linha.situacao === "caiu")
    return (
      <Badge className="bg-destructive/15 text-destructive" variant="secondary">
        <ArrowDownRight className="mr-1 h-3 w-3" /> {rotulo}
      </Badge>
    );
  if (linha.situacao === "estavel")
    return (
      <Badge variant="secondary">
        <ArrowRight className="mr-1 h-3 w-3" /> {rotulo}
      </Badge>
    );
  return <Badge variant="outline">{rotulo}</Badge>;
}

function Providencia({ linha }: { linha: LinhaPanorama }) {
  const p = linha.providencias;
  if (!p.acoes && !p.impugnacoes.length && !p.oficios)
    return <span>Nenhuma providência registrada.</span>;
  return (
    <div className="space-y-0.5">
      {p.acoes > 0 && (
        <p>
          {p.acoes} ações · {p.acoesOficio} com ofício · {p.acoesConcluidas} concluídas
        </p>
      )}
      {p.valorRecuperavel > 0 && <p>A recuperar: {formatarMoeda(p.valorRecuperavel)}</p>}
      {p.impugnacoes.length > 0 && (
        <p>
          {p.impugnacoes.length} impugnação(ões) · {rotuloStatus(p.impugnacoes[0]!.status)}
        </p>
      )}
      {p.oficios > 0 && <p>{p.oficios} ofícios emitidos</p>}
    </div>
  );
}

function Kpi({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{rotulo}</p>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums">{valor}</p>
        {apoio && <p className="mt-1 font-mono text-xs text-muted-foreground">{apoio}</p>}
      </CardContent>
    </Card>
  );
}
