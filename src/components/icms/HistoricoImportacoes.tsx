import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useImportacoes } from "@/hooks/useCriterios";
import { apagarImportacao } from "@/lib/icms/criterios.functions";
import { competenciaAmbiental } from "@/lib/icms/criterios/competencia";

export function HistoricoImportacoes({ criterio }: { criterio: string }) {
  const { data, isLoading } = useImportacoes(criterio);
  const apagar = useServerFn(apagarImportacao);
  const cliente = useQueryClient();

  async function remover(id: string) {
    if (!confirm("Remover este registro do histórico? Os dados importados não serão apagados.")) return;
    try {
      await apagar({ data: { id } });
      await cliente.invalidateQueries({ queryKey: ["criterio-importacoes"] });
      toast.success("Registro removido do histórico");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
           <History className="h-4 w-4" /> Histórico de relatórios importados
          {data && <Badge variant="secondary">{data.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação registrada para este critério.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Arquivo / origem</th>
                   <th className="py-2 pr-3">{criterio === "patrimonio_cultural" ? "Exercício" : "Ano-base"}</th>
                  <th className="py-2 pr-3">Relatório</th>
                   {criterio === "meio_ambiente" && <th className="py-2 pr-3">Competência</th>}
                  <th className="py-2 pr-3 text-right">Municípios</th>
                  <th className="py-2 pr-3 text-right">Itens</th>
                  <th className="py-2 pr-3">Alertas</th>
                  <th className="py-2 pr-3">Por</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(i.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{i.arquivo_nome ?? "—"}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {i.origem}
                        {i.url && (
                          <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                            link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{i.ano_base}</td>
                    <td className="py-2 pr-3">{i.fonte_relatorio}</td>
                   {criterio === "meio_ambiente" && <td className="py-2 pr-3 whitespace-nowrap">{i.competencia ?? competenciaAmbiental(i.url ?? i.arquivo_nome)}</td>}
                    <td className="py-2 pr-3 text-right">{i.municipios}</td>
                    <td className="py-2 pr-3 text-right">{i.registros_itens}</td>
                    <td className="py-2 pr-3 text-xs">
                       {criterio === "meio_ambiente" && !i.hash_arquivo && <Badge variant="outline">Carga anterior ao controle de duplicidade</Badge>}{" "}
                       {(i.nao_mapeados?.length ?? 0) > 0 && (
                        <Badge variant="outline">{i.nao_mapeados.length} não reconhecidos</Badge>
                      )}{" "}
                      {(i.divergencias?.length ?? 0) > 0 && (
                        <Badge variant="destructive">{i.divergencias.length} divergências</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{i.importado_por_nome ?? "—"}</td>
                    <td className="py-2">
                      <Button size="icon" variant="ghost" onClick={() => remover(i.id)} aria-label="Remover do histórico">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
