import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Download, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { MapaMunicipios } from "@/components/icms/MapaMunicipios";
import { useIcmsComparativo, useIcmsExercicios } from "@/hooks/useIcms";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { nomeCriterio, normalizarRotulo } from "@/lib/icms/criterios";
import {
  compararMunicipiosFjp,
  listarMunicipiosFjpFn,
} from "@/lib/icms/comparativo.functions";
import { importarComparativoFjp } from "@/lib/icms/importar";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/icms/comparativo")({
  head: () => ({
    meta: [
      { title: "Comparativo entre municípios — ICMS" },
      {
        name: "description",
        content:
          "Compare o repasse de ICMS do seu município com outros municípios, buscando os dados direto no portal Robin Hood da FJP ou pelo extrato importado.",
      },
      { property: "og:title", content: "Comparativo entre municípios — ICMS" },
      {
        property: "og:description",
        content: "Ranking de repasse de ICMS entre municípios mineiros, com seleção pelo mapa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparativoIcms,
});

type MunicipioFjp = { id: number; nome: string };

function ComparativoIcms() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const qc = useQueryClient();
  const [exercicio, setExercicio] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [criterio, setCriterio] = useState<string>("");

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0] ?? null);
    }
  }, [exercicios, exercicio]);

  const { data: linhas } = useIcmsComparativo(exercicio);

  const criteriosDisponiveis = useMemo(() => {
    const set = new Set((linhas ?? []).map((l) => l.criterio));
    return [...set].sort((a, b) => nomeCriterio(a).localeCompare(nomeCriterio(b), "pt-BR"));
  }, [linhas]);

  useEffect(() => {
    if (!criteriosDisponiveis.length) return;
    if (!criteriosDisponiveis.includes(criterio)) {
      setCriterio(
        criteriosDisponiveis.includes("total")
          ? "total"
          : (criteriosDisponiveis[0] as string),
      );
    }
  }, [criteriosDisponiveis, criterio]);

  const ranking = useMemo(() => {
    const mapa = new Map<string, number[]>();
    for (const l of linhas ?? []) {
      if (criterio && l.criterio !== criterio) continue;
      const arr = mapa.get(l.municipio_nome) ?? Array.from({ length: 12 }, () => 0);
      if (l.mes >= 1 && l.mes <= 12) arr[l.mes - 1] = (arr[l.mes - 1] ?? 0) + (l.valor ?? 0);
      mapa.set(l.municipio_nome, arr);
    }
    const lista = [...mapa.entries()]
      .map(([nome, meses]) => ({ nome, meses, total: meses.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .map((x, i) => ({ ...x, posicao: i + 1 }));
    const termo = normalizarRotulo(busca);
    return termo ? lista.filter((x) => normalizarRotulo(x.nome).includes(termo)) : lista;
  }, [linhas, busca, criterio]);

  const dadosGrafico = useMemo(
    () =>
      MESES.map((rotulo, i) => {
        const ponto: Record<string, string | number> = { mes: rotulo };
        for (const r of ranking) ponto[r.nome] = r.meses[i] ?? 0;
        return ponto;
      }),
    [ranking],
  );

  const meu = normalizarRotulo(municipio?.nome ?? "");

  function exportar() {
    baixarCsv(
      `comparativo-icms-${exercicio}.csv`,
      montarCsv(
        ["Posição", "Município", ...MESES, `Total (${nomeCriterio(criterio)})`],
        ranking.map((r) => [
          r.posicao,
          r.nome,
          ...r.meses.map((v) => v.toFixed(2)),
          r.total.toFixed(2),
        ]),
      ),
    );
  }


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Comparativo entre municípios</h1>
          <p className="text-sm text-muted-foreground">
            Compare o repasse do seu município com o de outros — buscando direto no portal Robin
            Hood ou pelo extrato importado.
          </p>
        </div>
        <SeletorExercicio exercicios={exercicios ?? []} valor={exercicio} aoTrocar={setExercicio} />
      </header>

      <Tabs defaultValue={linhas && linhas.length ? "ranking" : "buscar"}>
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="buscar">Buscar no portal</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          {!linhas?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum comparativo gravado ainda. Use a aba “Buscar no portal” para escolher os
                municípios e sincronizar com a FJP, ou importe o extrato de comparação na tela de
                Cargas.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">Repasse acumulado no exercício</CardTitle>
                <div className="flex items-center gap-2">
                  {criteriosDisponiveis.length > 1 && (
                    <Select value={criterio} onValueChange={setCriterio}>
                      <SelectTrigger className="h-9 w-56">
                        <SelectValue placeholder="Critério" />
                      </SelectTrigger>
                      <SelectContent>
                        {criteriosDisponiveis.map((c) => (
                          <SelectItem key={c} value={c}>
                            {nomeCriterio(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" onClick={exportar}>
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Buscar município"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="max-w-xs"
                />
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dadosGrafico} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => v.toLocaleString("pt-BR")}
                        width={72}
                      />
                      <RTooltip
                        formatter={(v: number, n: string) => [formatarMoeda(v), n]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {ranking.map((r, i) => (
                        <Line
                          key={r.nome}
                          type="monotone"
                          dataKey={r.nome}
                          stroke={CORES[i % CORES.length]}
                          strokeWidth={normalizarRotulo(r.nome) === meu ? 3 : 2}
                          dot={{ r: 2 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="min-w-40">Município</TableHead>
                        {MESES.map((m) => (
                          <TableHead key={m} className="text-right whitespace-nowrap">
                            {m}
                          </TableHead>
                        ))}
                        <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((r, i) => (
                        <TableRow
                          key={r.nome}
                          className={cn(
                            normalizarRotulo(r.nome) === meu && "bg-primary/5 font-medium",
                          )}
                        >
                          <TableCell>{r.posicao}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: CORES[i % CORES.length] }}
                              />
                              {r.nome}
                            </span>
                          </TableCell>
                          {r.meses.map((v, idx) => (
                            <TableCell key={idx} className="text-right tabular-nums">
                              {v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatarMoeda(r.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="buscar" className="mt-4">
          <BuscarNoPortal
            municipioId={municipioId ?? null}
            municipioAtivo={municipio?.nome ?? null}
            exercicioPadrao={exercicio ?? new Date().getFullYear()}
            aoConcluir={(ano) => {
              setExercicio(ano);
              qc.invalidateQueries({ queryKey: ["icms-comparativo"] });
              qc.invalidateQueries({ queryKey: ["icms-cargas"] });
              qc.invalidateQueries({ queryKey: ["icms-exercicios"] });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seleção de municípios + sincronização com a FJP                     */
/* ------------------------------------------------------------------ */

function BuscarNoPortal({
  municipioId,
  municipioAtivo,
  exercicioPadrao,
  aoConcluir,
}: {
  municipioId: string | null;
  municipioAtivo: string | null;
  exercicioPadrao: number;
  aoConcluir: (exercicio: number) => void;
}) {
  const [lista, setLista] = useState<MunicipioFjp[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const [ano, setAno] = useState(String(exercicioPadrao));
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarMunicipiosFjpFn()
      .then((r) => {
        if (!vivo) return;
        setLista(r.municipios.map((m) => ({ id: m.id, nome: m.nome })));
        setErroLista(r.erro);
        setCarregandoLista(false);
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErroLista(e instanceof Error ? e.message : "portal indisponível");
        setCarregandoLista(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  // o próprio município entra na comparação por padrão
  useEffect(() => {
    if (!municipioAtivo || !lista.length) return;
    const chave = normalizarRotulo(municipioAtivo);
    const oficial = lista.find((m) => normalizarRotulo(m.nome) === chave);
    if (oficial) setSelecionados((s) => (s.length ? s : [oficial.nome]));
  }, [lista, municipioAtivo]);

  const nomes = useMemo(() => lista.map((m) => m.nome), [lista]);

  const filtrados = useMemo(() => {
    const termo = normalizarRotulo(filtro);
    if (!termo) return lista.slice(0, 40);
    return lista.filter((m) => normalizarRotulo(m.nome).includes(termo)).slice(0, 40);
  }, [lista, filtro]);

  function alternar(nome: string) {
    setSelecionados((s) =>
      s.includes(nome) ? s.filter((x) => x !== nome) : s.length >= 30 ? s : [...s, nome],
    );
  }

  async function sincronizar() {
    if (!municipioId || !selecionados.length) return;
    const exercicio = Number(ano);
    if (!exercicio) return;
    const alvos = selecionados
      .map((nome) => lista.find((m) => m.nome === nome))
      .filter((m): m is MunicipioFjp => !!m)
      .map((m) => ({ id: m.id, nome: m.nome }));

    setSincronizando(true);
    try {
      const r = await compararMunicipiosFjp({ data: { exercicio, municipios: alvos } });
      const comDados = r.resultados.filter((x) => x.registros.length);
      const falhas = r.resultados.filter((x) => !x.registros.length);
      if (!comDados.length) {
        toast.warning(
          `O portal Robin Hood não devolveu dados para ${exercicio}. ${falhas
            .map((f) => `${f.nome}: ${f.erro ?? "sem valores"}`)
            .join(" | ")}`,
          { duration: 12000 },
        );
        return;
      }
      const gravados = await importarComparativoFjp({
        municipioId,
        exercicio,
        resultados: comDados,
      });
      toast.success(
        `${gravados} valores de ${comDados.length} município(s) gravados direto do portal Robin Hood.`,
      );
      if (falhas.length) {
        toast.warning(`Sem dados para: ${falhas.map((f) => f.nome).join(", ")}.`);
      }
      aoConcluir(exercicio);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Falha na sincronização: ${e.message}`
          : "Não consegui falar com o portal Robin Hood.",
      );
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Escolha pelo mapa</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly
            fallback={<div className="h-[420px] rounded-md border bg-muted/30" />}
          >
            <MapaMunicipios
              disponiveis={nomes}
              selecionados={selecionados}
              aoAlternar={alternar}
              municipioAtivo={municipioAtivo}
            />
          </ClientOnly>
          <p className="mt-2 text-xs text-muted-foreground">
            Clique nos municípios vizinhos para incluí-los na comparação. O município da prefeitura
            ativa aparece destacado em dourado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Municípios selecionados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground" htmlFor="ano-comparativo">
                Exercício
              </label>
              <Input
                id="ano-comparativo"
                value={ano}
                onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-9 w-24"
              />
            </div>
            <Button
              onClick={sincronizar}
              disabled={sincronizando || !selecionados.length || !municipioId}
            >
              {sincronizando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar
            </Button>
          </div>

          {carregandoLista && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando a lista oficial de municípios…
            </p>
          )}
          {erroLista && (
            <p className="text-xs text-destructive">
              Não consegui carregar a lista do portal ({erroLista}). Tente novamente em instantes.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {selecionados.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhum município selecionado.</span>
            )}
            {selecionados.map((nome) => (
              <Badge key={nome} variant="secondary" className="gap-1">
                {nome}
                <button type="button" onClick={() => alternar(nome)} aria-label={`Remover ${nome}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <Input
            placeholder="Buscar município pelo nome"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
          <div className="max-h-64 overflow-auto rounded-md border">
            {filtrados.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => alternar(m.nome)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted",
                  selecionados.includes(m.nome) && "bg-primary/10 font-medium",
                )}
              >
                {m.nome}
                {selecionados.includes(m.nome) && (
                  <span className="text-xs text-muted-foreground">selecionado</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Até 30 municípios por sincronização. Os valores vêm da API oficial da FJP, por critério
            e mês, e substituem o que já estiver gravado no mesmo exercício.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
