import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngestaoCriterio } from "@/components/icms/IngestaoCriterio";
import { IngestaoEsportes } from "@/components/icms/IngestaoEsportes";
import { PIPELINES } from "@/lib/icms/criterios/pipelines";
import { useImportacoes } from "@/hooks/useCriterios";
import { apagarImportacao } from "@/lib/icms/criterios.functions";
import { usePerfil } from "@/hooks/usePerfil";

export const Route = createFileRoute("/_authenticated/icms/importacoes")({
  head: () => ({
    meta: [
      { title: "Relatórios importados — critérios do ICMS" },
      {
        name: "description",
        content:
          "Histórico dos relatórios oficiais já extraídos por critério, com recarga manual e registro dos itens não reconhecidos.",
      },
      { property: "og:title", content: "Relatórios importados — critérios do ICMS" },
      {
        property: "og:description",
        content: "Acompanhe as importações dos relatórios de Esportes, Turismo e Meio Ambiente.",
      },
    ],
  }),
  component: PainelImportacoes,
});

function PainelImportacoes() {
  const { data: perfil } = usePerfil();
  const consultoria = perfil?.papel === "superadmin" || perfil?.papel === "consultor";
  const [criterio, setCriterio] = useState<string>(PIPELINES[0]?.slug ?? "esportes");
  const { data: importacoes, isLoading } = useImportacoes(criterio);
  const apagar = useServerFn(apagarImportacao);
  const cliente = useQueryClient();

  const pipeline = useMemo(
    () => PIPELINES.find((p) => p.slug === criterio) ?? PIPELINES[0]!,
    [criterio],
  );

  const naoMapeados = useMemo(() => {
    const conta = new Map<string, number>();
    for (const imp of importacoes ?? []) {
      for (const nome of imp.nao_mapeados ?? []) conta.set(nome, (conta.get(nome) ?? 0) + 1);
    }
    return [...conta.entries()].sort((a, b) => b[1] - a[1]);
  }, [importacoes]);

  if (!consultoria) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Esta área é exclusiva da consultoria.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Relatórios importados</h1>
        <p className="text-sm text-muted-foreground">
          Tudo que já foi extraído dos relatórios oficiais, por critério e ano-base, com recarga manual
          e o registro do que não foi reconhecido.
        </p>
      </div>

      <Tabs value={criterio} onValueChange={setCriterio}>
        <TabsList>
          {PIPELINES.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug}>
              {p.nome}
            </TabsTrigger>
          ))}
        </TabsList>

        {PIPELINES.map((p) => (
          <TabsContent key={p.slug} value={p.slug} className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de extrações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
                {!isLoading && !importacoes?.length && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum relatório de {p.nome} importado até agora.
                  </p>
                )}
                {(importacoes ?? []).map((imp) => (
                  <div
                    key={imp.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{imp.ano_base}</Badge>
                        <Badge variant="secondary">{imp.fonte_relatorio}</Badge>
                        <span className="truncate font-medium">
                          {imp.arquivo_nome ?? imp.url ?? "importação"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {imp.municipios} municípios · {imp.registros_ranking} linhas de ranking ·{" "}
                        {imp.registros_itens} itens · {imp.paginas} páginas ·{" "}
                        {new Date(imp.criado_em).toLocaleString("pt-BR")}
                        {imp.importado_por_nome ? ` · ${imp.importado_por_nome}` : ""}
                      </p>
                      {imp.nao_mapeados?.length > 0 && (
                        <p className="text-xs text-amber-600">
                          {imp.nao_mapeados.length} itens não reconhecidos: {imp.nao_mapeados.slice(0, 6).join(" · ")}
                          {imp.nao_mapeados.length > 6 ? "…" : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {imp.url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard?.writeText(imp.url ?? "");
                            toast.info(
                              "Endereço copiado. Cole no campo de importação abaixo para recarregar este relatório.",
                            );
                          }}
                        >
                          <RefreshCw className="mr-2 size-4" />
                          Recarregar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await apagar({ data: { id: imp.id } });
                            await cliente.invalidateQueries({ queryKey: ["criterio-importacoes"] });
                            toast.success("Registro removido do histórico.");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao remover.");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {naoMapeados.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Itens não reconhecidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {naoMapeados.map(([nome, vezes]) => (
                    <div key={nome} className="flex items-center justify-between gap-3">
                      <span className="truncate">{nome}</span>
                      <Badge variant="outline">{vezes}x</Badge>
                    </div>
                  ))}
                  <p className="pt-2 text-xs text-muted-foreground">
                    Esses nomes aparecem no relatório mas ainda não têm item correspondente cadastrado —
                    a pontuação deles fica de fora do detalhamento até o cadastro ser ajustado.
                  </p>
                </CardContent>
              </Card>
            )}

            {p.slug === "esportes" ? <IngestaoEsportes /> : <IngestaoCriterio pipeline={p} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
