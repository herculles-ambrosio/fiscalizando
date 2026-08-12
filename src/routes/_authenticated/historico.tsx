import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  listarCargasSemRegime,
  reprocessarCargasPendentes,
  type ProgressoReprocesso,
} from "@/lib/vaf/reprocessar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROTULO_TIPO_RETORNO_CURTO,
  TIPOS_RETORNO,
  rotuloTipoRetorno,
  type TipoRetorno,
  formatarCompetencia,
} from "@/lib/vaf/tipoRetorno";
import { formatarDataHora } from "@/lib/format";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de apurações VAF" },
      {
        name: "description",
        content: "Todas as apurações VAF já processadas pelo município, com totais por situação.",
      },
      { property: "og:title", content: "Histórico de apurações VAF" },
      {
        property: "og:description",
        content: "Consulte as apurações VAF anteriores do município e seus resultados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { municipioId } = useMunicipioAtivo();
  const { data, isLoading } = useQuery({
    queryKey: ["cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoRetorno>("todos");
  const cargas = (data ?? []).filter(
    (c) => filtroTipo === "todos" || (c.tipo_retorno ?? "mensal") === filtroTipo,
  );

  const queryClient = useQueryClient();
  const [progresso, setProgresso] = useState<ProgressoReprocesso | null>(null);
  const jaTentou = useRef<string | null>(null);

  const { data: pendentes, refetch: recarregarPendentes } = useQuery({
    queryKey: ["cargas-sem-regime", municipioId],
    enabled: !!municipioId,
    queryFn: () => listarCargasSemRegime(municipioId!),
  });

  async function reprocessar() {
    if (!municipioId || progresso) return;
    setProgresso({ etapa: "Iniciando", percentual: 0 });
    try {
      const r = await reprocessarCargasPendentes(municipioId, setProgresso);
      if (r.erros.length) toast.error(r.erros.join(" • "));
      if (r.cargas > 0)
        toast.success(
          `${r.cargas} apuração(ões) atualizada(s) com Regime, Simples Nacional e SIMEI.`,
        );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cargas"] }),
        recarregarPendentes(),
      ]);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao reprocessar apurações.");
    } finally {
      setProgresso(null);
    }
  }

  // Reprocessa sozinho as apurações antigas ao abrir a tela (uma vez por município).
  useEffect(() => {
    if (!municipioId || !pendentes?.length) return;
    if (jaTentou.current === municipioId) return;
    jaTentou.current = municipioId;
    void reprocessar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipioId, pendentes]);

  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function excluirCarga(cargaId: string) {
    setExcluindo(cargaId);
    try {
      const oficios = await supabase.from("oficios_emitidos").delete().eq("carga_id", cargaId);
      if (oficios.error) throw oficios.error;
      const contribuintes = await supabase
        .from("contribuintes_apurados")
        .delete()
        .eq("carga_id", cargaId);
      if (contribuintes.error) throw contribuintes.error;
      const carga = await supabase.from("cargas").delete().eq("id", cargaId);
      if (carga.error) throw carga.error;
      toast.success("Apuração excluída.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cargas"] }),
        recarregarPendentes(),
      ]);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao excluir a apuração.");
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Apurações Realizadas</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Apurações processadas pelo município.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
            <SelectTrigger className="w-48" aria-label="Filtrar por tipo de retorno">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS_RETORNO.map((t) => (
                <SelectItem key={t} value={t}>
                  {ROTULO_TIPO_RETORNO_CURTO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        <Button variant="outline" onClick={reprocessar} disabled={!municipioId || !!progresso}>
          {progresso ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Atualizar regimes
        </Button>
        </div>
      </div>

      {progresso ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm text-muted-foreground">{progresso.etapa}</p>
            <Progress value={progresso.percentual} />
          </CardContent>
        </Card>
      ) : pendentes?.length ? (
        <p className="text-sm text-muted-foreground">
          {pendentes.length} apuração(ões) sem os dados de regime — clique em “Atualizar regimes”.
        </p>
      ) : null}


      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !cargas.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma apuração registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercício</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo de retorno</TableHead>

                  <TableHead>Processada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Omissos</TableHead>
                  <TableHead className="text-right">Zerados</TableHead>
                  <TableHead className="text-right">Fora do prazo</TableHead>
                  <TableHead className="text-right">Discrepantes</TableHead>
                  <TableHead className="w-16 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/cargas/$cargaId"
                        params={{ cargaId: c.id }}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.exercicio}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatarCompetencia(c.competencia_mes, c.competencia_ano)}
                    </TableCell>
                    <TableCell>

                      <Badge
                        variant={
                          c.tipo_retorno === "indice_definitivo"
                            ? "default"
                            : c.tipo_retorno === "indice_provisorio"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {rotuloTipoRetorno(c.tipo_retorno)}
                        {c.tipo_retorno === "mensal" && c.mes_referencia
                          ? ` ${String(c.mes_referencia).padStart(2, "0")}`
                          : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatarDataHora(c.criado_em)}</TableCell>
                    <TableCell className="capitalize">{c.status}</TableCell>
                    <TableCell className="text-right">{c.total_ativos ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_omissos ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_zerados ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_fora_prazo ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_discrepantes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir apuração de ${c.exercicio}`}
                            disabled={excluindo === c.id}
                            className="text-destructive hover:text-destructive"
                          >
                            {excluindo === c.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir apuração {c.exercicio}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Todos os contribuintes apurados e o histórico de ofícios desta
                              apuração serão removidos. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void excluirCarga(c.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
