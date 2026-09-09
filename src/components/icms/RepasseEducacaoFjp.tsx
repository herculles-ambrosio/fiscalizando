/**
 * Confere o índice de Educação calculado a partir da planilha da FJP com o
 * dinheiro que cada município realmente recebeu no critério, buscado no portal
 * da Lei Robin Hood. A diferença aponta erro de escala do índice, exercício
 * trocado ou parcela ainda não repassada.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarMunicipiosFjpFn } from "@/lib/icms/comparativo.functions";
import { repasseEducacaoFjp } from "@/lib/icms/educacaoFjp.functions";
import { useCriterioRanking, type FonteRelatorio } from "@/hooks/useCriterios";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

type MunicipioFjp = { id: number; nome: string };
type LinhaPortal = {
  id: number;
  nome: string;
  valor: number | null;
  indice: number | null;
  meses: number;
  erro: string | null;
};

const pct = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%`;

export function RepasseEducacaoFjp({
  anoBase,
  fonte,
}: {
  anoBase: number | null;
  fonte: FonteRelatorio | null;
}) {
  const { municipio } = useMunicipioAtivo();
  const chaveMunicipio = municipio ? normalizarMunicipio(municipio.nome) : null;
  const { data: ranking } = useCriterioRanking("educacao", anoBase, fonte);

  const listar = useServerFn(listarMunicipiosFjpFn);
  const buscarRepasse = useServerFn(repasseEducacaoFjp);

  const [lista, setLista] = useState<MunicipioFjp[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [escolhidos, setEscolhidos] = useState<MunicipioFjp[]>([]);
  const [exercicio, setExercicio] = useState<number>(
    anoBase ? anoBase + 2 : new Date().getFullYear(),
  );
  const [linhas, setLinhas] = useState<LinhaPortal[]>([]);
  const [buscando, setBuscando] = useState(false);
  // Valores lidos da planilha real de repasses (tem prioridade sobre o portal).
  const [planilha, setPlanilha] = useState<Map<string, number>>(new Map());
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  // Ao trocar o ano-base do relatório, o repasse acontece dois anos depois.
  useEffect(() => {
    if (anoBase) setExercicio(anoBase + 2);
  }, [anoBase]);

  async function lerPlanilha(arquivo: File) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const mapa = new Map<string, number>();
      for (const aba of wb.SheetNames) {
        const linhasAba = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba]!, {
          header: 1,
          raw: true,
        });
        for (const linha of linhasAba) {
          if (!Array.isArray(linha)) continue;
          const nome = linha.find((c) => typeof c === "string" && c.trim().length > 2) as
            | string
            | undefined;
          if (!nome) continue;
          const chave = normalizarMunicipio(nome);
          const numeros = linha
            .map((c) =>
              typeof c === "number"
                ? c
                : typeof c === "string" &&
                    /^[\d.,\s]+$/.test(c.trim()) &&
                    c.trim().length > 0
                  ? Number(c.replace(/\./g, "").replace(",", ".").trim())
                  : null,
            )
            .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
          // O repasse é o maior número da linha (índices e quantidades são menores).
          const valor = numeros.length ? Math.max(...numeros) : null;
          if (valor != null && valor >= 100 && !mapa.has(chave)) mapa.set(chave, valor);
        }
      }
      if (!mapa.size) {
        toast.error("Não encontrei valores de repasse por município nessa planilha.");
        return;
      }
      setPlanilha(mapa);
      setNomeArquivo(arquivo.name);
      toast.success(`${mapa.size} município(s) lidos da planilha.`);
    } catch {
      toast.error("Não foi possível ler a planilha. Envie o arquivo .xlsx original.");
    }
  }

  function adicionarDaPlanilha() {
    const novos: MunicipioFjp[] = [];
    for (const m of lista) {
      if (!planilha.has(normalizarMunicipio(m.nome))) continue;
      if (escolhidos.some((e) => e.id === m.id)) continue;
      novos.push(m);
    }
    setEscolhidos((a) => [...a, ...novos].slice(0, 40));
  }

  useEffect(() => {
    let vivo = true;
    listar({})
      .then((r) => {
        if (!vivo) return;
        setLista(r.municipios as MunicipioFjp[]);
        setErroLista(r.erro);
      })
      .catch(() => vivo && setErroLista("portal indisponível"));
    return () => {
      vivo = false;
    };
  }, [listar]);

  // Começa pelo município da prefeitura ativa.
  useEffect(() => {
    if (escolhidos.length || !lista.length || !municipio) return;
    const chave = normalizarMunicipio(municipio.nome);
    const achado = lista.find((m) => normalizarMunicipio(m.nome) === chave);
    if (achado) setEscolhidos([achado]);
  }, [lista, municipio, escolhidos.length]);

  const indicePorMunicipio = useMemo(() => {
    const mapa = new Map<string, { nome: string; indice: number }>();
    for (const l of ranking ?? [])
      mapa.set(l.municipio, { nome: l.municipio_nome, indice: l.indice_percentual });
    return mapa;
  }, [ranking]);

  const resultado = useMemo(
    () =>
      linhas.map((l) => {
        const calc = indicePorMunicipio.get(normalizarMunicipio(l.nome)) ?? null;
        const ieCalculado = calc?.indice ?? null;
        const fator = l.valor != null && l.indice ? l.valor / l.indice : null;
        const esperado = fator != null && ieCalculado != null ? ieCalculado * fator : null;
        const difValor = esperado != null && l.valor != null ? esperado - l.valor : null;
        const difIndice =
          ieCalculado != null && l.indice != null ? ieCalculado - l.indice : null;
        return { ...l, ieCalculado, esperado, difValor, difIndice };
      }),
    [linhas, indicePorMunicipio],
  );

  const sugestoes = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return [];
    const jaTem = new Set(escolhidos.map((m) => m.id));
    return lista
      .filter((m) => !jaTem.has(m.id) && m.nome.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [filtro, lista, escolhidos]);

  function adicionarTopRanking() {
    const top = (ranking ?? []).slice(0, 10);
    const novos: MunicipioFjp[] = [];
    for (const l of top) {
      const achado = lista.find((m) => normalizarMunicipio(m.nome) === l.municipio);
      if (achado && !escolhidos.some((e) => e.id === achado.id)) novos.push(achado);
    }
    setEscolhidos((a) => [...a, ...novos].slice(0, 40));
  }

  async function conferir() {
    if (!escolhidos.length) return;
    setBuscando(true);
    try {
      const r = await buscarRepasse({
        data: { exercicio, municipios: escolhidos.map((m) => ({ id: m.id, nome: m.nome })) },
      });
      setLinhas(r.linhas as LinhaPortal[]);
      const semDado = (r.linhas as LinhaPortal[]).filter((l) => l.valor == null).length;
      if (semDado)
        toast.warning(`${semDado} município(s) sem repasse de Educação informado em ${exercicio}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível consultar o portal da FJP.");
    } finally {
      setBuscando(false);
    }
  }

  const anos = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 1 - i);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">
            Repasse da Educação no portal da FJP × índice calculado
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            O sistema baixa do portal da FJP o valor repassado de Educação e o índice publicado de
            cada município no exercício escolhido, e compara com o índice calculado a partir da
            planilha importada
            {anoBase ? ` (ano-base ${anoBase}, repasse em ${anoBase + 2})` : ""}.
          </p>
          {erroLista && (
            <p className="text-sm text-amber-600">
              Lista de municípios do portal indisponível ({erroLista}). Tente novamente em alguns
              minutos.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(exercicio)} onValueChange={(v) => setExercicio(Number(v))}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    Repasse de {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Adicionar município"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              {!!sugestoes.length && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
                  {sugestoes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setEscolhidos((a) => (a.length >= 40 ? a : [...a, m]));
                        setFiltro("");
                      }}
                    >
                      <Plus className="size-3" />
                      {m.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={adicionarTopRanking} disabled={!ranking?.length}>
              Top 10 do ranking
            </Button>
            <Button onClick={conferir} disabled={buscando || !escolhidos.length}>
              <RefreshCw className={`mr-2 size-4 ${buscando ? "animate-spin" : ""}`} />
              {buscando ? "Consultando o portal…" : "Baixar e comparar"}
            </Button>
          </div>
          {!!escolhidos.length && (
            <div className="flex flex-wrap gap-1">
              {escolhidos.map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1">
                  {m.nome}
                  <button
                    type="button"
                    onClick={() => setEscolhidos((a) => a.filter((x) => x.id !== m.id))}
                    aria-label={`Remover ${m.nome}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!resultado.length ? (
            <p className="text-sm text-muted-foreground">
              Escolha os municípios e clique em “Baixar e comparar”.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Município</th>
                      <th className="py-2 text-right">Índice no portal</th>
                      <th className="py-2 text-right">Índice calculado</th>
                      <th className="py-2 text-right">Diferença</th>
                      <th className="py-2 text-right">Repassado</th>
                      <th className="py-2 text-right">Esperado pelo cálculo</th>
                      <th className="py-2 text-right">Diferença em R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.map((l) => (
                      <tr
                        key={l.id}
                        className={`border-b last:border-0 ${
                          normalizarMunicipio(l.nome) === chaveMunicipio
                            ? "bg-emerald-50 dark:bg-emerald-950/20"
                            : ""
                        }`}
                      >
                        <td className="py-2 pr-3 font-medium">
                          {l.nome}
                          {l.erro && (
                            <span className="ml-2 text-xs text-amber-600">({l.erro})</span>
                          )}
                        </td>
                        <td className="py-2 text-right">{pct(l.indice)}</td>
                        <td className="py-2 text-right">{pct(l.ieCalculado)}</td>
                        <td className="py-2 text-right">
                          {l.difIndice == null ? (
                            "—"
                          ) : Math.abs(l.difIndice) > (l.indice ?? 0) * 0.05 ? (
                            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                              {l.difIndice > 0 ? "+" : ""}
                              {l.difIndice.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">
                              {l.difIndice > 0 ? "+" : ""}
                              {l.difIndice.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {l.valor == null ? "—" : formatarMoeda(l.valor)}
                        </td>
                        <td className="py-2 text-right">
                          {l.esperado == null ? "—" : formatarMoeda(l.esperado)}
                        </td>
                        <td
                          className={`py-2 text-right ${
                            l.difValor != null && l.difValor > 0
                              ? "text-emerald-600"
                              : l.difValor != null && l.difValor < 0
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {l.difValor == null ? "—" : formatarMoeda(l.difValor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Esperado = índice calculado × (repasse recebido ÷ índice publicado no portal).
                  Diferença positiva indica que o índice calculado é maior que o que gerou o
                  repasse; confira se o exercício escolhido corresponde ao ano-base da planilha.
                </p>
                <Button
                  variant="outline"
                  onClick={() =>
                    baixarCsv(
                      `educacao-repasse-fjp-${exercicio}.csv`,
                      montarCsv(
                        [
                          "Município",
                          "Índice no portal (%)",
                          "Índice calculado (%)",
                          "Diferença de índice",
                          "Repassado (R$)",
                          "Esperado (R$)",
                          "Diferença (R$)",
                        ],
                        resultado.map((l) => [
                          l.nome,
                          l.indice ?? "",
                          l.ieCalculado ?? "",
                          l.difIndice ?? "",
                          l.valor ?? "",
                          l.esperado ?? "",
                          l.difValor ?? "",
                        ]),
                      ),
                    )
                  }
                >
                  <Download className="mr-2 size-4" />
                  Baixar CSV
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
