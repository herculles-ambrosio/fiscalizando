import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, CircleDashed, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRITERIOS } from "@/lib/icms/criterios";
import { CriterioEsportesDetalhe } from "@/components/icms/CriterioEsportesDetalhe";
import { IngestaoCriterio } from "@/components/icms/IngestaoCriterio";
import { ConferenciaFjp } from "@/components/icms/ConferenciaFjp";
import { AreasSemCadastroIef } from "@/components/icms/AreasSemCadastroIef";

import { usePerfil } from "@/hooks/usePerfil";
import { PIPELINE_POR_SLUG } from "@/lib/icms/criterios/pipelines";
import {
  useCriterioAnos,
  useCriterioItens,
  useCriterioRanking,
  useItensReferenciaCompleta,
  type FonteRelatorio,
} from "@/hooks/useCriterios";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import { baixarCsv, montarCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/icms/criterio/$slug")({
  head: ({ params }) => {
    const nome = CRITERIOS.find((c) => c.slug === params.slug)?.nome ?? "Critério";
    return {
      meta: [
        { title: `${nome} — detalhamento do critério do ICMS` },
        {
          name: "description",
          content: `O que o município já pontua no critério ${nome} da Lei Robin Hood e o que ainda falta pontuar.`,
        },
        { property: "og:title", content: `${nome} — detalhamento do critério do ICMS` },
        {
          property: "og:description",
          content: `Base legal, itens pontuáveis e lacunas do critério ${nome}.`,
        },
      ],
    };
  },
  component: DetalheCriterio,
});

function DetalheCriterio() {
  const { slug } = Route.useParams();
  if (slug === "esportes") return <CriterioEsportesDetalhe />;
  return <DetalheGenerico slug={slug} />;
}

function DetalheGenerico({ slug }: { slug: string }) {
  const criterio = CRITERIOS.find((c) => c.slug === slug) ?? null;
  const pipeline = PIPELINE_POR_SLUG.get(slug) ?? null;
  const { municipio } = useMunicipioAtivo();
  const { data: perfil } = usePerfil();
  const consultoria = perfil?.papel === "superadmin" || perfil?.papel === "consultor";
  const chaveMunicipio = municipio ? normalizarMunicipio(municipio.nome) : null;

  const { data: referencia } = useItensReferenciaCompleta(slug);
  const { data: anos } = useCriterioAnos(slug);
  const [combo, setCombo] = useState<string>("");

  useEffect(() => {
    if (anos?.length && !combo) setCombo(`${anos[0]!.ano}|${anos[0]!.fonte}`);
  }, [anos, combo]);

  const [anoStr, fonteStr] = combo.split("|");
  const ano = anoStr ? Number(anoStr) : null;
  const fonte = (fonteStr as FonteRelatorio | undefined) ?? null;

  const { data: ranking } = useCriterioRanking(slug, ano, fonte);
  const { data: itens } = useCriterioItens(slug, ano, fonte, chaveMunicipio);

  const linhaMunicipio = useMemo(
    () => (ranking ?? []).find((l) => l.municipio === chaveMunicipio) ?? null,
    [ranking, chaveMunicipio],
  );

  const pontuados = useMemo(() => {
    const mapa = new Map<string, { nome: string; pontuacao: number | null; observacao: string | null }>();
    for (const i of itens ?? []) {
      if (!i.item_codigo) continue;
      const atual = mapa.get(i.item_codigo);
      const soma = (atual?.pontuacao ?? 0) + (i.pontuacao ?? 0);
      mapa.set(i.item_codigo, { nome: i.item_nome, pontuacao: soma, observacao: i.observacao });
    }
    return mapa;
  }, [itens]);

  const faltantes = useMemo(
    () => (referencia ?? []).filter((r) => !(pontuados.get(r.codigo)?.pontuacao ?? 0)),
    [referencia, pontuados],
  );

  if (!criterio) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Critério não encontrado.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/icms/criterios" search={{ criterio: "" }}>
              <ArrowLeft className="mr-2 size-4" />
              Voltar aos critérios
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold">{criterio.nome}</h1>
          <p className="text-sm text-muted-foreground">
            {criterio.percentual != null ? `${criterio.percentual}% do repasse · ` : ""}
            {criterio.orgao} · {criterio.periodicidade}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {criterio.percentual != null && (
            <Badge variant="secondary">Peso legal {criterio.percentual}%</Badge>
          )}
          <Button asChild size="sm" variant="outline">
            <Link to="/icms/comparativo">Comparar municípios</Link>
          </Button>
        </div>
        {anos && anos.length > 0 && (
          <Select value={combo} onValueChange={setCombo}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Ano-base" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={`${a.ano}|${a.fonte}`} value={`${a.ano}|${a.fonte}`}>
                  {a.ano} — {a.fonte}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que este critério mede</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{criterio.oQueMede}</p>
          <p className="text-xs text-muted-foreground">{criterio.baseLegal}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pontuacao">
        <TabsList>
          <TabsTrigger value="pontuacao">O que pontua hoje</TabsTrigger>
          <TabsTrigger value="melhorar">Como melhorar</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          {ehMeioAmbiente && <TabsTrigger value="ief">Cadastro no IEF</TabsTrigger>}
          {pipeline && consultoria && <TabsTrigger value="importar">Importar relatório</TabsTrigger>}
        </TabsList>

        <TabsContent value="pontuacao" className="space-y-4 pt-4">
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Posição</p>
                <p className="text-xl font-semibold">
                  {linhaMunicipio
                    ? (ranking ?? []).findIndex((l) => l.municipio === chaveMunicipio) + 1 || "—"
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pontuação</p>
                <p className="text-xl font-semibold">
                  {linhaMunicipio ? linhaMunicipio.nota_final.toLocaleString("pt-BR") : "0"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Índice</p>
                <p className="text-xl font-semibold">
                  {linhaMunicipio?.indice_percentual
                    ? `${linhaMunicipio.indice_percentual.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%`
                    : "—"}
                </p>
              </div>
              {!linhaMunicipio && (
                <p className="text-xs text-muted-foreground sm:col-span-3">
                  {municipio?.nome ?? "Este município"} não aparece no relatório importado deste
                  ano-base, ou seja, hoje não pontua neste critério. Veja em “Como melhorar” o que
                  precisa ser feito para entrar na lista.
                </p>
              )}
            </CardContent>
          </Card>

          <ConferenciaFjp
            slug={criterio.slug}
            nomeCriterio={criterio.nome}
            pesoLegalPct={criterio.percentual}
            indiceRelatorio={linhaMunicipio?.indice_percentual ?? null}
          />




          {!referencia?.length && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Os itens pontuáveis deste critério ainda não estão cadastrados. O detalhamento fica
                disponível assim que a consultoria importar o relatório oficial do órgão responsável.
              </CardContent>
            </Card>
          )}

          {!!referencia?.length && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Itens do critério em {municipio?.nome ?? "—"}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    baixarCsv(
                      `${slug}-${municipio?.nome ?? "municipio"}.csv`,
                      montarCsv(
                        ["Item", "Situação", "Pontuação", "Requisito"],
                        (referencia ?? []).map((r) => {
                          const p = pontuados.get(r.codigo);
                          return [
                            r.nome_oficial,
                            p?.pontuacao ? "Pontua" : "Não pontua",
                            String(p?.pontuacao ?? 0),
                            r.requisito ?? "",
                          ];
                        }),
                      ),
                    )
                  }
                >
                  <Download className="mr-2 size-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(referencia ?? []).map((r) => {
                  const p = pontuados.get(r.codigo);
                  const pontua = !!p?.pontuacao;
                  return (
                    <div key={r.codigo} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      {pontua ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.nome_oficial}</p>
                        <p className="text-xs text-muted-foreground">{r.requisito}</p>
                        {p?.observacao && (
                          <p className="text-xs text-muted-foreground">Registro: {p.observacao}</p>
                        )}
                      </div>
                      <Badge variant={pontua ? "secondary" : "outline"}>
                        {pontua ? p?.pontuacao?.toLocaleString("pt-BR") : "sem pontuação"}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="melhorar" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">O que fazer para pontuar mais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {faltantes.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="font-medium">Itens sem pontuação no último relatório:</p>
                  <ul className="list-disc pl-5">
                    {faltantes.map((f) => (
                      <li key={f.codigo}>
                        {f.nome_oficial} — {f.requisito}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="list-disc space-y-1 pl-5">
                {criterio.comoMelhorar.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {pipeline && (
                <p className="text-xs text-muted-foreground">
                  Fonte dos dados: {pipeline.orgao}. {pipeline.comoFunciona}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {!ranking?.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhum relatório importado para este critério.
                </p>
              )}
              {!!ranking?.length && (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Município</th>
                        <th className="p-2 text-right">Pontuação</th>
                        <th className="p-2 text-right">Índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((l, i) => (
                        <tr
                          key={l.municipio}
                          className={l.municipio === chaveMunicipio ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}
                        >
                          <td className="p-2">{i + 1}</td>
                          <td className="p-2">{l.municipio_nome}</td>
                          <td className="p-2 text-right">{l.nota_final.toLocaleString("pt-BR")}</td>
                          <td className="p-2 text-right">
                            {l.indice_percentual
                              ? `${l.indice_percentual.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {pipeline && consultoria && (
          <TabsContent value="importar" className="pt-4">
            <IngestaoCriterio pipeline={pipeline} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
