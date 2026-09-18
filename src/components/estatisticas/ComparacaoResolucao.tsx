/**
 * Comparação das Estatísticas alimentada pelas resoluções da SEF-MG:
 * a média publicada na resolução escolhida (lado base) contra a média atual
 * das evoluções salvas marcadas (uma por prefeitura). Permite gravar o
 * resultado com os números do momento.
 */

import { useMemo, useState } from "react";
import { Download, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMunicipios } from "@/hooks/useMunicipio";
import { useResolucoesSef } from "@/hooks/useResolucoesSef";
import {
  useComparacoesSalvas,
  useEvolucoesResumo,
  useExcluirComparacao,
  useIndicesDaResolucao,
  useSalvarComparacao,
  type ComparacaoSalva,
  type LinhaComparacaoGravada,
} from "@/hooks/useComparacoesEstatisticas";
import { formatarIndice } from "@/lib/vaf/indice";
import { formatarPercentual } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

export function ComparacaoResolucao() {
  const { data: municipios } = useMunicipios();
  const { data: resolucoes, isLoading: carregandoResolucoes } = useResolucoesSef();
  const { data: evolucoes, isLoading: carregandoEvolucoes } = useEvolucoesResumo();
  const { data: gravadas } = useComparacoesSalvas();
  const salvar = useSalvarComparacao();
  const excluir = useExcluirComparacao();

  const [resolucaoNumero, setResolucaoNumero] = useState<string>("");
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [gravada, setGravada] = useState<ComparacaoSalva | null>(null);

  const resolucao = (resolucoes ?? []).find((r) => r.numero === resolucaoNumero) ?? null;
  const numeroEfetivo =
    resolucaoNumero || (resolucoes && resolucoes[0] ? resolucoes[0].numero : "");
  const { data: linhasResolucao } = useIndicesDaResolucao(numeroEfetivo || null);

  const nomePorMunicipio = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of municipios ?? []) mapa.set(m.id, m.nome);
    return mapa;
  }, [municipios]);

  const mediaPorMunicipio = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of linhasResolucao ?? []) {
      if (!l.municipio_id || l.media_indices == null) continue;
      mapa.set(l.municipio_id, Number(l.media_indices));
    }
    return mapa;
  }, [linhasResolucao]);

  /** Uma evolução por prefeitura: marcar outra do mesmo município substitui a anterior. */
  function alternar(id: string, municipioId: string) {
    setGravada(null);
    setMarcadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      const semOMesmoMunicipio = atual.filter(
        (x) => (evolucoes ?? []).find((e) => e.id === x)?.municipio_id !== municipioId,
      );
      return [...semOMesmoMunicipio, id];
    });
  }

  const linhas: LinhaComparacaoGravada[] = useMemo(() => {
    if (gravada) return gravada.linhas;
    return marcadas
      .map((id) => (evolucoes ?? []).find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => {
        const mediaResolucao = mediaPorMunicipio.get(e.municipio_id) ?? null;
        const mediaAtual =
          e.indiceBase != null && e.indiceAtual != null ? (e.indiceBase + e.indiceAtual) / 2 : null;
        const pontos =
          mediaResolucao != null && mediaAtual != null ? mediaAtual - mediaResolucao : null;
        const variacao =
          pontos != null && mediaResolucao ? (pontos / mediaResolucao) * 100 : null;
        return {
          municipioId: e.municipio_id,
          municipio: nomePorMunicipio.get(e.municipio_id) ?? "—",
          evolucaoId: e.id,
          evolucaoNome: e.nome,
          mediaResolucao,
          indiceBase: e.indiceBase,
          indiceAtual: e.indiceAtual,
          mediaAtual,
          pontos,
          variacao,
        };
      })
      .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR"));
  }, [gravada, marcadas, evolucoes, mediaPorMunicipio, nomePorMunicipio]);

  const subiram = linhas.filter((l) => (l.variacao ?? 0) > 0.5).length;
  const cairam = linhas.filter((l) => (l.variacao ?? 0) < -0.5).length;

  async function gravar() {
    if (!nome.trim()) {
      toast.error("Dê um nome para a comparação.");
      return;
    }
    if (!numeroEfetivo || !linhas.length) {
      toast.error("Escolha a resolução e ao menos uma evolução.");
      return;
    }
    try {
      await salvar.mutateAsync({
        nome: nome.trim(),
        resolucaoNumero: numeroEfetivo,
        evolucaoIds: marcadas,
        linhas,
      });
      setNome("");
      toast.success("Comparação gravada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gravar.");
    }
  }

  function exportar() {
    const csv = montarCsv(
      [
        "Município",
        "Evolução",
        `Média publicada (Resolução ${gravada?.resolucao_numero ?? numeroEfetivo})`,
        "Índice base",
        "Índice atual",
        "Média atual",
        "Diferença (pontos)",
        "Variação (%)",
      ],
      linhas.map((l) => [
        l.municipio,
        l.evolucaoNome,
        l.mediaResolucao != null ? formatarIndice(l.mediaResolucao) : "",
        l.indiceBase != null ? formatarIndice(l.indiceBase) : "",
        l.indiceAtual != null ? formatarIndice(l.indiceAtual) : "",
        l.mediaAtual != null ? formatarIndice(l.mediaAtual) : "",
        l.pontos != null ? formatarIndice(l.pontos) : "",
        l.variacao != null ? l.variacao.toFixed(2).replace(".", ",") : "",
      ]),
    );
    baixarCsv(`comparacao-resolucao-${gravada?.resolucao_numero ?? numeroEfetivo}.csv`, csv);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comparação por resolução e evoluções</CardTitle>
        <p className="text-sm text-muted-foreground">
          A base vem da média publicada na resolução escolhida. O lado atual vem das evoluções
          salvas marcadas — uma por prefeitura.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="resolucao-base">Resolução (base)</Label>
            <Select
              value={numeroEfetivo}
              onValueChange={(v) => {
                setResolucaoNumero(v);
                setGravada(null);
              }}
            >
              <SelectTrigger id="resolucao-base" className="w-72">
                <SelectValue placeholder="Escolha a resolução" />
              </SelectTrigger>
              <SelectContent>
                {(resolucoes ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.numero}>
                    Resolução {r.numero} · apuração {r.ano_apuracao} · aplicação {r.ano_aplicacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nome-comparacao">Nome da comparação</Label>
            <Input
              id="nome-comparacao"
              className="w-64"
              placeholder="Ex.: Carteira 2027"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportar} disabled={!linhas.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            <Button onClick={() => void gravar()} disabled={salvar.isPending || !!gravada}>
              {salvar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gravar
            </Button>
          </div>
        </div>

        {resolucao?.observacao && (
          <p className="text-xs text-muted-foreground">{resolucao.observacao}</p>
        )}

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">Evoluções salvas</div>
            <div className="max-h-72 space-y-1 overflow-y-auto p-3">
              {carregandoEvolucoes && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {!carregandoEvolucoes && !(evolucoes ?? []).length && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma evolução salva. Salve uma em “Análises do VAF → Evolução”.
                </p>
              )}
              {(evolucoes ?? []).map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted/60"
                >
                  <Checkbox
                    checked={marcadas.includes(e.id)}
                    onCheckedChange={() => alternar(e.id, e.municipio_id)}
                  />
                  <span className="text-sm leading-tight">
                    <span className="font-medium">
                      {nomePorMunicipio.get(e.municipio_id) ?? "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {e.nome} · {dataCurta(e.criado_em)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {gravada && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <Badge variant="secondary">Comparação gravada</Badge>
                <span>
                  {gravada.nome} · Resolução {gravada.resolucao_numero} ·{" "}
                  {dataCurta(gravada.criado_em)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setGravada(null)}
                >
                  Voltar à seleção
                </Button>
              </div>
            )}
            {!!linhas.length && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{linhas.length} prefeitura(s)</span>
                <span className="text-emerald-600 dark:text-emerald-400">{subiram} subiram</span>
                <span className="text-destructive">{cairam} caíram</span>
              </div>
            )}
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">Média publicada</TableHead>
                    <TableHead className="text-right">Índice base</TableHead>
                    <TableHead className="text-right">Índice atual</TableHead>
                    <TableHead className="text-right">Média atual</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!linhas.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {carregandoResolucoes
                          ? "Carregando resoluções…"
                          : "Marque as evoluções que deseja comparar."}
                      </TableCell>
                    </TableRow>
                  )}
                  {linhas.map((l) => (
                    <TableRow key={l.evolucaoId}>
                      <TableCell className="font-medium">
                        {l.municipio}
                        <span className="block text-xs text-muted-foreground">
                          {l.evolucaoNome}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {l.mediaResolucao != null ? formatarIndice(l.mediaResolucao) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {l.indiceBase != null ? formatarIndice(l.indiceBase) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {l.indiceAtual != null ? formatarIndice(l.indiceAtual) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {l.mediaAtual != null ? formatarIndice(l.mediaAtual) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.variacao != null ? (
                          <span
                            className={
                              l.variacao < -0.5
                                ? "text-destructive"
                                : l.variacao > 0.5
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {!!(gravadas ?? []).length && (
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">Comparações gravadas</div>
            <div className="divide-y">
              {(gravadas ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    Resolução {c.resolucao_numero} · {c.linhas.length} prefeitura(s) ·{" "}
                    {dataCurta(c.criado_em)}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGravada(c)}>
                      Carregar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (gravada?.id === c.id) setGravada(null);
                        excluir.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
