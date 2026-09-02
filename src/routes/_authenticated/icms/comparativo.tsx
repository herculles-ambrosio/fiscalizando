import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Download, FilePlus2, Loader2, RefreshCw, Save, Trash2, X } from "lucide-react";
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
import {
  useIcmsDados,
  useApagarComparativoSalvo,
  useComparativosSalvos,
  useIcmsComparativo,
  useIcmsExerciciosComparativo,
  useSalvarComparativo,
} from "@/hooks/useIcms";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { nomeCriterio, normalizarRotulo } from "@/lib/icms/criterios";
import { montarDiagnostico } from "@/lib/icms/diagnostico";
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

const MESES = [
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

const CORES = [
  "hsl(var(--chart-1, 152 45% 35%))",
  "hsl(210 70% 55%)",
  "hsl(40 85% 50%)",
  "hsl(0 65% 55%)",
  "hsl(275 55% 55%)",
  "hsl(180 45% 40%)",
  "hsl(25 75% 50%)",
  "hsl(330 55% 55%)",
];

function ComparativoIcms() {
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExerciciosComparativo();
  const qc = useQueryClient();
  const [exercicio, setExercicio] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [criterio, setCriterio] = useState<string>("");
  /** quando um comparativo salvo está aberto, limita o ranking a esses municípios */
  const [salvoAberto, setSalvoAberto] = useState<{ id: string; municipios: string[] } | null>(null);
  /** municípios tirados da tela (não apaga nada gravado) */
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [dialogoSalvar, setDialogoSalvar] = useState(false);
  const [nomeSalvar, setNomeSalvar] = useState("");
  const [obsSalvar, setObsSalvar] = useState("");
  const [aba, setAba] = useState("ranking");

  const { data: salvos } = useComparativosSalvos();
  const salvar = useSalvarComparativo();
  const apagarSalvo = useApagarComparativoSalvo();


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

  /** critério escolhido pelo usuário — mantido ao trocar de exercício */
  const criterioPreferido = useRef<string>("");
  useEffect(() => {
    if (criterio) criterioPreferido.current = criterio;
  }, [criterio]);

  useEffect(() => {
    if (!criteriosDisponiveis.length) return;
    if (criteriosDisponiveis.includes(criterio)) return;
    const preferido = criterioPreferido.current;
    setCriterio(
      preferido && criteriosDisponiveis.includes(preferido)
        ? preferido
        : criteriosDisponiveis.includes("total")
          ? "total"
          : (criteriosDisponiveis[0] as string),
    );
  }, [criteriosDisponiveis, criterio]);

  /**
   * Meta ponderada do próprio município no exercício selecionado:
   * índice do critério (FJP) x peso do Anexo I x valor de 1 ponto de índice —
   * sempre do exercício em tela (o de destino), nunca do exercício de origem.
   */
  const { data: dadosProprios } = useIcmsDados(exercicio);
  const diagnostico = useMemo(
    () => (dadosProprios && exercicio ? montarDiagnostico(dadosProprios, exercicio) : null),
    [dadosProprios, exercicio],
  );
  const metaPropria = useMemo(() => {
    if (!diagnostico || !criterio || criterio === "total") return null;
    return diagnostico.linhas.find((l) => l.criterio.slug === criterio)?.metaValor ?? null;
  }, [diagnostico, criterio]);

  /** peso do Anexo I do critério em tela (fração, ex.: 0,75 para o VAF) */
  const pesoAnexo = useMemo(() => {
    if (!criterio || criterio === "total") return null;
    const pct = CRITERIO_POR_SLUG.get(criterio)?.percentual ?? null;
    return pct != null ? pct / 100 : null;
  }, [criterio]);

  const valorPonto = diagnostico?.valorPorPontoIndice ?? null;
  /** valor de 1 ponto de índice dentro da fatia do critério */
  const valorPontoCriterio =
    valorPonto != null && pesoAnexo != null ? valorPonto * pesoAnexo : null;

  const ranking = useMemo(() => {
    const permitidos = salvoAberto
      ? new Set(salvoAberto.municipios.map((n) => normalizarRotulo(n)))
      : null;
    const escondidos = new Set(ocultos.map((n) => normalizarRotulo(n)));
    const mapa = new Map<string, number[]>();
    for (const l of linhas ?? []) {
      if (criterio && l.criterio !== criterio) continue;
      if (permitidos && !permitidos.has(normalizarRotulo(l.municipio_nome))) continue;
      if (escondidos.has(normalizarRotulo(l.municipio_nome))) continue;
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
  }, [linhas, busca, criterio, salvoAberto, ocultos]);


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
        [
          "Posição",
          "Município",
          ...MESES,
          `Total (${nomeCriterio(criterio)})`,
          "Meta ponderada (R$)",
          "Falta (R$)",
        ],
        ranking.map((r) => {
          const proprio = normalizarRotulo(r.nome) === meu;
          return [
            r.posicao,
            r.nome,
            ...r.meses.map((v) => v.toFixed(2)),
            r.total.toFixed(2),
            proprio && metaPropria != null ? metaPropria.toFixed(2) : "",
            proprio && metaPropria != null ? Math.max(0, metaPropria - r.total).toFixed(2) : "",
          ];
        }),
      ),
    );
  }

  function confirmarSalvar() {
    if (!exercicio || !ranking.length) return;
    salvar.mutate(
      {
        nome: nomeSalvar.trim() || `Comparativo ${exercicio}`,
        exercicio,
        criterio: criterio || "total",
        municipios: ranking.map((r) => r.nome),
        observacao: obsSalvar.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Comparativo salvo.");
          setDialogoSalvar(false);
          setNomeSalvar("");
          setObsSalvar("");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Não consegui salvar o comparativo."),
      },
    );
  }

  function novoComparativo() {
    setSalvoAberto(null);
    setOcultos([]);
    setBusca("");
    setAba("buscar");
    toast.success(
      "Tela limpa para um novo comparativo. Os dados já gravados continuam salvos e podem ser reabertos.",
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

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="buscar">Buscar no portal</TabsTrigger>
          <TabsTrigger value="salvos">Salvos {salvos?.length ? `(${salvos.length})` : ""}</TabsTrigger>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNomeSalvar(`Comparativo ${exercicio ?? ""}`.trim());
                      setDialogoSalvar(true);
                    }}
                  >
                    <Save className="h-4 w-4" />
                    Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={novoComparativo}>
                    <FilePlus2 className="h-4 w-4" />
                    Novo comparativo
                  </Button>

                  <Button variant="outline" size="sm" onClick={exportar}>
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {salvoAberto && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-xs">
                    <span>
                      Mostrando um comparativo salvo ({salvoAberto.municipios.length} municípios).
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setSalvoAberto(null)}>
                      Ver todos
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Buscar município"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button variant="outline" size="sm" onClick={() => setAba("buscar")}>
                    <RefreshCw className="h-4 w-4" />
                    Incluir outros municípios
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {criterio && criterio !== "total"
                    ? metaPropria != null
                      ? `Meta ponderada de ${municipio?.nome ?? "seu município"} em ${nomeCriterio(
                          criterio,
                        )}: índice do critério × peso do Anexo I × valor de 1 ponto de índice de ${exercicio} (${formatarMoeda(
                          diagnostico?.valorPorPontoIndice ?? 0,
                        )}). Os demais municípios entram como referência de valor recebido.`
                      : `Sem índice próprio importado para ${exercicio}: a meta ponderada aparece assim que os índices deste exercício forem carregados.`
                    : "Escolha um critério específico para ver a meta ponderada do seu município."}
                </p>
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
                        <TableHead className="text-right whitespace-nowrap">
                          Meta ponderada
                        </TableHead>
                        <TableHead className="text-right whitespace-nowrap">Falta</TableHead>
                        <TableHead className="w-10" />
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
                          <TableCell className="text-right tabular-nums">
                            {normalizarRotulo(r.nome) === meu && metaPropria != null
                              ? formatarMoeda(metaPropria)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {normalizarRotulo(r.nome) === meu && metaPropria != null
                              ? metaPropria - r.total > 0
                                ? formatarMoeda(metaPropria - r.total)
                                : "meta atingida"
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={`Tirar ${r.nome} da comparação`}
                              aria-label={`Tirar ${r.nome} da comparação`}
                              onClick={() => {
                                setOcultos((s) => (s.includes(r.nome) ? s : [...s, r.nome]));
                                setSalvoAberto((s) =>
                                  s
                                    ? { ...s, municipios: s.municipios.filter((n) => n !== r.nome) }
                                    : s,
                                );
                                toast.success(
                                  `${r.nome} saiu da comparação (os valores continuam gravados).`,
                                );
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
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
              qc.invalidateQueries({ queryKey: ["icms-exercicios-comparativo"] });
              setOcultos([]);

              setAba("ranking");
            }}
          />
        </TabsContent>

        <TabsContent value="salvos" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparativos salvos</CardTitle>
            </CardHeader>
            <CardContent>
              {!salvos?.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum comparativo salvo ainda. Monte a comparação na aba Ranking e clique em
                  “Salvar”.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-24">Exercício</TableHead>
                      <TableHead className="w-28">Municípios</TableHead>
                      <TableHead className="w-40 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salvos.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium">{s.nome}</div>
                          {s.observacao && (
                            <div className="text-xs text-muted-foreground">{s.observacao}</div>
                          )}
                        </TableCell>
                        <TableCell>{s.exercicio}</TableCell>
                        <TableCell>{s.municipios.length}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExercicio(s.exercicio);
                              if (s.criterio) setCriterio(s.criterio);
                              setOcultos([]);
                              setSalvoAberto({ id: s.id, municipios: s.municipios });

                              setAba("ranking");
                            }}
                          >
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir comparativo salvo"
                            aria-label="Excluir comparativo salvo"
                            onClick={() =>
                              apagarSalvo.mutate(s.id, {
                                onSuccess: () => {
                                  setSalvoAberto((cur) => (cur?.id === s.id ? null : cur));
                                  toast.success("Comparativo excluído.");
                                },
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogoSalvar} onOpenChange={setDialogoSalvar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar comparativo</DialogTitle>
            <DialogDescription>
              Guarda os municípios comparados, o exercício e o critério para você reabrir depois.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Nome do comparativo"
              value={nomeSalvar}
              onChange={(e) => setNomeSalvar(e.target.value)}
            />
            <Textarea
              placeholder="Observação (opcional)"
              value={obsSalvar}
              onChange={(e) => setObsSalvar(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogoSalvar(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarSalvar} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
