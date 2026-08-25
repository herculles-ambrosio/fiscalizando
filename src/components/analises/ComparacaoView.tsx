import { useMemo, useState } from "react";
import { NotaRemessa } from "@/components/NotaRemessa";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarCnpj, formatarMoeda, formatarPercentual } from "@/lib/format";
import { formatarCnae } from "@/lib/vaf/cnae";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ordemExercicioRemessa,
  rotuloExercicioRemessa,
  rotuloTipoRetorno,
} from "@/lib/vaf/tipoRetorno";

type Linha = {
  inscricao_estadual: string;
  cnpj: string | null;
  nome: string | null;
  cnae: string | null;
  vaf_atual: number | null;
  situacoes: string[];
};

async function carregarContribuintes(cargaId: string): Promise<Linha[]> {
  const tamanho = 1000;
  const todos: Linha[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase
      .from("contribuintes_apurados")
      .select("inscricao_estadual, cnpj, nome, cnae, vaf_atual, situacoes")
      .eq("carga_id", cargaId)
      .range(inicio, inicio + tamanho - 1);
    if (error) throw error;
    todos.push(...((data ?? []) as Linha[]));
    if (!data || data.length < tamanho) break;
  }
  return todos;
}

const SITUACOES_RESUMO = [
  ["total_ativos", "Ativos"],
  ["total_omissos", "Omissos"],
  ["total_zerados", "Zerados"],
  ["total_fora_prazo", "Fora do prazo"],
  ["total_discrepantes", "Discrepantes"],
  ["total_normais", "Normais"],
  ["total_simples_nacional", "Simples Nacional"],
  ["total_simei", "SIMEI"],
] as const;

function variacao(atual: number | null, base: number | null): number | null {
  if (atual == null || base == null || base === 0) return null;
  return ((atual - base) / Math.abs(base)) * 100;
}

export default function Comparacao() {
  const { municipioId } = useMunicipioAtivo();
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");

  const { data: cargas, isLoading } = useQuery({
    queryKey: ["cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
        .eq("municipio_id", municipioId!)
        .eq("status", "concluida")
        .order("exercicio", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const escolhidas = useMemo(
    () =>
      selecionadas
        .map((id) => (cargas ?? []).find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .sort(
          (a, b) =>
            ordemExercicioRemessa(a.exercicio, a.competencia_mes) -
              ordemExercicioRemessa(b.exercicio, b.competencia_mes) ||
            a.criado_em.localeCompare(b.criado_em),
        ),
    [selecionadas, cargas],
  );

  const detalhes = useQuery({
    queryKey: ["comparacao", escolhidas.map((c) => c.id)],
    enabled: escolhidas.length >= 2,
    queryFn: async () => {
      const listas = await Promise.all(escolhidas.map((c) => carregarContribuintes(c.id)));
      return Object.fromEntries(escolhidas.map((c, i) => [c.id, listas[i]!]));
    },
  });

  const dados = detalhes.data;

  const totaisVaf = useMemo(() => {
    if (!dados) return {} as Record<string, number>;
    return Object.fromEntries(
      Object.entries(dados).map(([id, linhas]) => [
        id,
        linhas.reduce((s, l) => s + (l.vaf_atual ?? 0), 0),
      ]),
    );
  }, [dados]);

  const porCnae = useMemo(() => {
    if (!dados) return [];
    const mapa = new Map<string, Record<string, number>>();
    for (const [id, linhas] of Object.entries(dados)) {
      for (const l of linhas) {
        const cnae = l.cnae?.trim() || "Sem CNAE";
        const atual = mapa.get(cnae) ?? {};
        atual[id] = (atual[id] ?? 0) + (l.vaf_atual ?? 0);
        mapa.set(cnae, atual);
      }
    }
    const ultima = escolhidas[escolhidas.length - 1]?.id ?? "";
    return [...mapa.entries()]
      .map(([cnae, valores]) => ({ cnae, valores }))
      .sort((a, b) => (b.valores[ultima] ?? 0) - (a.valores[ultima] ?? 0));
  }, [dados, escolhidas]);

  const porContribuinte = useMemo(() => {
    if (!dados) return [];
    const mapa = new Map<
      string,
      { nome: string | null; cnpj: string | null; valores: Record<string, number | null> }
    >();
    for (const [id, linhas] of Object.entries(dados)) {
      for (const l of linhas) {
        const item = mapa.get(l.inscricao_estadual) ?? {
          nome: l.nome,
          cnpj: l.cnpj,
          valores: {},
        };
        if (l.nome) item.nome = l.nome;
        if (l.cnpj) item.cnpj = l.cnpj;
        item.valores[id] = (item.valores[id] ?? 0) + (l.vaf_atual ?? 0);
        mapa.set(l.inscricao_estadual, item);
      }
    }
    const primeira = escolhidas[0]?.id ?? "";
    const ultima = escolhidas[escolhidas.length - 1]?.id ?? "";
    const termo = busca.trim().toLowerCase();
    return [...mapa.entries()]
      .map(([ie, item]) => ({
        ie,
        ...item,
        variacao: variacao(item.valores[ultima] ?? null, item.valores[primeira] ?? null),
        entrou: item.valores[primeira] === undefined,
        saiu: item.valores[ultima] === undefined,
      }))
      .filter(
        (l) =>
          !termo ||
          l.ie.includes(termo) ||
          (l.cnpj ?? "").includes(termo.replace(/\D/g, "")) ||
          (l.nome ?? "").toLowerCase().includes(termo),
      )
      .sort((a, b) => (b.valores[ultima] ?? 0) - (a.valores[ultima] ?? 0));
  }, [dados, escolhidas, busca]);

  const base = escolhidas[0];
  const ultimaId = escolhidas[escolhidas.length - 1]?.id ?? "";

  const colunas = escolhidas.map(
    (c) =>
      `${rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)} · ${rotuloTipoRetorno(c.tipo_retorno)}`,
  );

  // cada exportação leva exatamente as linhas visíveis na aba (mesma busca e mesmo limite)
  const visiveisCnae = porCnae.slice(0, 100);
  const visiveisIndice = porContribuinte.slice(0, 50);
  const visiveisContribuintes = porContribuinte.slice(0, 300);

  function exportarCnae() {
    baixarCsv(
      "comparacao-por-cnae.csv",
      montarCsv(
        ["CNAE", ...colunas, "Variação (%)"],
        visiveisCnae.map((l) => [
          l.cnae === "Sem CNAE" ? l.cnae : formatarCnae(l.cnae),
          ...escolhidas.map((c) => l.valores[c.id] ?? 0),
          variacao(l.valores[ultimaId] ?? null, l.valores[base!.id] ?? null) ?? "",
        ]),
      ),
    );
  }

  function exportarIndice() {
    const parte = (id: string, valores: Record<string, number | null>) => {
      const total = totaisVaf[id] ?? 0;
      const v = valores[id];
      if (v == null || total === 0) return null;
      return (v / total) * 100;
    };
    baixarCsv(
      "comparacao-participacao.csv",
      montarCsv(
        ["Contribuinte", "Inscrição estadual", ...colunas, "Δ p.p."],
        visiveisIndice.map((l) => {
          const inicio = parte(base!.id, l.valores);
          const fim = parte(ultimaId, l.valores);
          return [
            l.nome ?? l.ie,
            l.ie,
            ...escolhidas.map((c) => parte(c.id, l.valores) ?? ""),
            inicio == null || fim == null ? "" : fim - inicio,
          ];
        }),
      ),
    );
  }

  function exportarContribuintes() {
    baixarCsv(
      "comparacao-contribuintes.csv",
      montarCsv(
        ["Contribuinte", "CNPJ", "Inscrição estadual", ...colunas, "Variação (%)", "Cadastro"],
        visiveisContribuintes.map((l) => [
          l.nome ?? "",
          l.cnpj ?? "",
          l.ie,
          ...escolhidas.map((c) => l.valores[c.id] ?? ""),
          l.variacao ?? "",
          l.entrou ? "Novo" : l.saiu ? "Saiu" : "Mantido",
        ]),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Comparar apurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione duas ou mais apurações (exercícios ou tipos de retorno diferentes) para
          comparar totais, CNAE, participação e contribuintes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apurações disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !cargas?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma apuração concluída.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cargas.map((c) => {
                const marcada = selecionadas.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                  >
                    <Checkbox
                      checked={marcada}
                      onCheckedChange={(v) =>
                        setSelecionadas((s) =>
                          v ? [...s, c.id] : s.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">
                        {rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)}
                        <NotaRemessa className="ml-1" />
                      </span>
                      <Badge variant="outline">{rotuloTipoRetorno(c.tipo_retorno)}</Badge>
                      <span className="block text-xs text-muted-foreground">
                        {c.total_ativos ?? 0} contribuintes
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {escolhidas.length < 2 ? (
        <p className="text-sm text-muted-foreground">Selecione pelo menos duas apurações.</p>
      ) : detalhes.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="totais">
          <TabsList>
            <TabsTrigger value="totais">Totais e situações</TabsTrigger>
            <TabsTrigger value="indice">Índice / participação</TabsTrigger>
            <TabsTrigger value="cnae">Por CNAE</TabsTrigger>
            <TabsTrigger value="contribuintes">Contribuinte a contribuinte</TabsTrigger>
          </TabsList>

          <TabsContent value="totais">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      {escolhidas.map((c) => (
                        <TableHead key={c.id} className="text-right">
                          {rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)} ·{" "}
                          {rotuloTipoRetorno(c.tipo_retorno)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">VAF total</TableCell>
                      {escolhidas.map((c) => (
                        <TableCell key={c.id} className="text-right">
                          {formatarMoeda(totaisVaf[c.id] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        {formatarPercentual(
                          variacao(
                            totaisVaf[escolhidas[escolhidas.length - 1]!.id] ?? null,
                            totaisVaf[base!.id] ?? null,
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                    {SITUACOES_RESUMO.map(([campo, rotulo]) => (
                      <TableRow key={campo}>
                        <TableCell className="font-medium">{rotulo}</TableCell>
                        {escolhidas.map((c) => (
                          <TableCell key={c.id} className="text-right">
                            {(c[campo] as number | null) ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          {formatarPercentual(
                            variacao(
                              escolhidas[escolhidas.length - 1]![campo] as number | null,
                              base![campo] as number | null,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="indice" className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={exportarIndice}
                disabled={visiveisIndice.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar visíveis ({visiveisIndice.length})
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contribuinte</TableHead>
                      {escolhidas.map((c) => (
                        <TableHead key={c.id} className="text-right">
                          {rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)} ·{" "}
                          {rotuloTipoRetorno(c.tipo_retorno)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Δ p.p.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveisIndice.map((l) => {
                      const parte = (id: string) => {
                        const total = totaisVaf[id] ?? 0;
                        const v = l.valores[id];
                        if (v == null || total === 0) return null;
                        return (v / total) * 100;
                      };
                      const inicio = parte(base!.id);
                      const fim = parte(escolhidas[escolhidas.length - 1]!.id);
                      return (
                        <TableRow key={l.ie}>
                          <TableCell className="max-w-[16rem] truncate">
                            {l.nome ?? l.ie}
                          </TableCell>
                          {escolhidas.map((c) => {
                            const p = parte(c.id);
                            return (
                              <TableCell key={c.id} className="text-right">
                                {p == null
                                  ? "—"
                                  : `${p.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%`}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right">
                            {inicio == null || fim == null
                              ? "—"
                              : (fim - inicio).toLocaleString("pt-BR", {
                                  maximumFractionDigits: 3,
                                })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cnae" className="space-y-3">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={exportarCnae}
                disabled={visiveisCnae.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar visíveis ({visiveisCnae.length})
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CNAE</TableHead>
                      {escolhidas.map((c) => (
                        <TableHead key={c.id} className="text-right">
                          {rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)} ·{" "}
                          {rotuloTipoRetorno(c.tipo_retorno)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Variação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveisCnae.map((l) => (
                      <TableRow key={l.cnae}>
                        <TableCell className="max-w-[22rem] font-medium">
                          {l.cnae === "Sem CNAE" ? l.cnae : formatarCnae(l.cnae)}
                        </TableCell>
                        {escolhidas.map((c) => (
                          <TableCell key={c.id} className="text-right">
                            {formatarMoeda(l.valores[c.id] ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          {formatarPercentual(
                            variacao(
                              l.valores[escolhidas[escolhidas.length - 1]!.id] ?? null,
                              l.valores[base!.id] ?? null,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contribuintes" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por nome, CNPJ ou inscrição estadual"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="max-w-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={exportarContribuintes}
                disabled={visiveisContribuintes.length === 0}
                className="sm:ml-auto"
              >
                <Download className="h-3.5 w-3.5" />
                Exportar visíveis ({visiveisContribuintes.length})
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contribuinte</TableHead>
                      <TableHead>CNPJ</TableHead>
                      {escolhidas.map((c) => (
                        <TableHead key={c.id} className="text-right">
                          {rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno)} ·{" "}
                          {rotuloTipoRetorno(c.tipo_retorno)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Variação</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveisContribuintes.map((l) => (
                      <TableRow key={l.ie}>
                        <TableCell className="max-w-[16rem] truncate">{l.nome ?? "—"}</TableCell>
                        <TableCell>{formatarCnpj(l.cnpj)}</TableCell>
                        {escolhidas.map((c) => (
                          <TableCell key={c.id} className="text-right">
                            {l.valores[c.id] == null ? "—" : formatarMoeda(l.valores[c.id]!)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          {formatarPercentual(l.variacao)}
                        </TableCell>
                        <TableCell>
                          {l.entrou ? (
                            <Badge variant="secondary">Novo</Badge>
                          ) : l.saiu ? (
                            <Badge variant="destructive">Saiu</Badge>
                          ) : (
                            <span className="text-muted-foreground">Mantido</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">
              Mostrando os 300 maiores VAF do período mais recente.
            </p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
