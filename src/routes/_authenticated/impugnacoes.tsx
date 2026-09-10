/**
 * Impugnações pendentes: acompanha as petições montadas, a situação de cada
 * uma e a data em que foram protocoladas no SEI.
 */

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import {
  rotuloStatus,
  STATUS_IMPUGNACAO,
  useAtualizarAcompanhamento,
  useImpugnacoes,
  type ImpugnacaoSalva,
} from "@/hooks/useImpugnacoes";
import { moedaBr, totalContestado } from "@/lib/vaf/impugnacao";

export const Route = createFileRoute("/_authenticated/impugnacoes")({
  head: () => ({
    meta: [
      { title: "Impugnações pendentes — Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Acompanhe as impugnações do índice provisório do VAF já montadas, com situação, número e data de protocolo.",
      },
      { property: "og:title", content: "Impugnações pendentes do VAF" },
      {
        property: "og:description",
        content:
          "Painel das petições de impugnação montadas, com situação e data de protocolamento no SEI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpugnacoesPendentes,
});

const CORES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  pronta: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  protocolada: "bg-primary/15 text-primary",
  deferida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  indeferida: "bg-destructive/15 text-destructive",
};

const dataBr = (v: string | null): string =>
  v ? new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function ImpugnacoesPendentes() {
  const { municipioId } = useMunicipioAtivo();
  const { data: lista, isLoading } = useImpugnacoes(municipioId ?? null);
  const atualizar = useAtualizarAcompanhamento();
  const [filtro, setFiltro] = useState<string>("pendentes");

  const registros = useMemo(() => {
    const todas = lista ?? [];
    if (filtro === "todas") return todas;
    if (filtro === "pendentes")
      return todas.filter((i) => i.status !== "deferida" && i.status !== "indeferida");
    return todas.filter((i) => i.status === filtro);
  }, [lista, filtro]);

  const pendentes = (lista ?? []).filter((i) => !i.protocolado_em).length;
  const protocoladas = (lista ?? []).filter((i) => !!i.protocolado_em).length;

  function salvar(i: ImpugnacaoSalva, campos: Partial<ImpugnacaoSalva>) {
    atualizar.mutate(
      {
        id: i.id,
        status: (campos.status ?? i.status) as string,
        protocoloNumero:
          campos.protocolo_numero !== undefined ? campos.protocolo_numero : i.protocolo_numero,
        protocoladoEm:
          campos.protocolado_em !== undefined ? campos.protocolado_em : i.protocolado_em,
      },
      {
        onSuccess: () => toast.success("Acompanhamento atualizado."),
        onError: () => toast.error("Não foi possível atualizar o acompanhamento."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ClipboardList className="size-6 text-primary" />
            Impugnações pendentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Petições montadas nesta prefeitura, com a situação de cada uma e a data em que foram
            protocoladas.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-status">Mostrar</Label>
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger id="filtro-status" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendentes">Em andamento</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
                {STATUS_IMPUGNACAO.map((s) => (
                  <SelectItem key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link to="/impugnacao">Nova impugnação</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Montadas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{lista?.length ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aguardando protocolo</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{pendentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Protocoladas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{protocoladas}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acompanhamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : registros.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Impugnação</TableHead>
                    <TableHead className="text-right">Contribuintes</TableHead>
                    <TableHead className="text-right">A recompor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Protocolada em</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <p className="font-medium">{i.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Exercício {i.exercicio} · {i.resolucao} · montada em{" "}
                          {new Date(i.criado_em).toLocaleDateString("pt-BR")}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.itens?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {moedaBr(totalContestado(i.itens ?? []))}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Badge className={CORES[i.status] ?? CORES["rascunho"]} variant="secondary">
                            {rotuloStatus(i.status)}
                          </Badge>
                          <Select
                            value={i.status}
                            onValueChange={(v) => salvar(i, { status: v })}
                          >
                            <SelectTrigger className="h-8 w-48" aria-label="Alterar situação">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_IMPUGNACAO.map((s) => (
                                <SelectItem key={s.valor} value={s.valor}>
                                  {s.rotulo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-40"
                          placeholder="Nº do SEI"
                          aria-label="Número do protocolo"
                          defaultValue={i.protocolo_numero ?? ""}
                          onBlur={(e) => {
                            const valor = e.target.value.trim();
                            if (valor !== (i.protocolo_numero ?? ""))
                              salvar(i, { protocolo_numero: valor || null });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 w-40"
                          aria-label="Data de protocolamento"
                          value={i.protocolado_em ?? ""}
                          onChange={(e) =>
                            salvar(i, {
                              protocolado_em: e.target.value || null,
                              status:
                                e.target.value && i.status === "rascunho"
                                  ? "protocolada"
                                  : i.status,
                            })
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dataBr(i.protocolado_em)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/impugnacao">Abrir</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhuma impugnação nesta situação. Monte uma nova em{" "}
              <strong>Impugnação</strong> e salve para acompanhá-la aqui.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
