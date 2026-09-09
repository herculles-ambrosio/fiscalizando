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
import { HabilitacaoTurismo } from "@/components/icms/HabilitacaoTurismo";
import { PrazoRecursoEducacao } from "@/components/icms/PrazoRecursoEducacao";
import { DadosConstitutivosEducacao } from "@/components/icms/DadosConstitutivosEducacao";
import { RepasseEducacaoFjp } from "@/components/icms/RepasseEducacaoFjp";

import { usePerfil } from "@/hooks/usePerfil";
import { PIPELINE_POR_SLUG } from "@/lib/icms/criterios/pipelines";
import {
  useCriterioAnos,
  useCriterioItens,
  usePotencialItens,
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
  const [filtroPontuacao, setFiltroPontuacao] = useState<"todos" | "pontuados" | "nao_pontuados">("todos");


  useEffect(() => {
    if (anos?.length && !combo) setCombo(`${anos[0]!.ano}|${anos[0]!.fonte}`);
  }, [anos, combo]);

  const [anoStr, fonteStr] = combo.split("|");
  const ano = anoStr ? Number(anoStr) : null;
  const fonte = (fonteStr as FonteRelatorio | undefined) ?? null;

  const { data: ranking } = useCriterioRanking(slug, ano, fonte);
  const { data: itens } = useCriterioItens(slug, ano, fonte, chaveMunicipio);
  const { data: potencial } = usePotencialItens(slug, ano, fonte);

  const ehMeioAmbiente = slug === "meio_ambiente" || slug === "meio-ambiente";
  const ehTurismo = slug === "turismo";
  const ehEducacao = slug === "educacao";
  const versaoEducacao = fonte === "definitivo" ? "definitivo" : "provisorio";

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

  const referenciaFiltrada = useMemo(() => {
    const lista = referencia ?? [];
    if (filtroPontuacao === "todos") return lista;
    return lista.filter((r) => {
      const pontua = !!(pontuados.get(r.codigo)?.pontuacao ?? 0);
      return filtroPontuacao === "pontuados" ? pontua : !pontua;
    });
  }, [referencia, pontuados, filtroPontuacao]);

  /**
   * Projeção de pontos de um item: primeiro tenta o que o próprio relatório
   * mostra (mediana/teto entre quem já pontua o item); quando o item não tem
   * linha própria no relatório (ex.: subitens da habilitação de Turismo), cai
   * no peso de referência do item.
   */
  const projecaoDe = useMemo(
    () => (r: { codigo: string; peso: number | null }) => {
      const observado = potencial?.get(r.codigo);
      if (observado) return { tipico: observado.tipico, maximo: observado.maximo, observado: true, municipios: observado.municipios };
      const peso = r.peso ?? 0;
      if (peso > 0) return { tipico: peso, maximo: peso, observado: false, municipios: 0 };
      return null;
    },
    [potencial],
  );

  /**
   * Quanto o município pode somar nos itens hoje zerados: usa a pontuação
   * típica (mediana) de quem já cumpre o item no mesmo relatório, com o teto
   * observado como referência máxima.
   */
  const potencialFaltante = useMemo(() => {
    let tipico = 0;
    let maximo = 0;
    for (const f of faltantes) {
      const p = projecaoDe(f);
      if (!p) continue;
      tipico += p.tipico;
      maximo += p.maximo;
    }
    return { tipico, maximo };
  }, [faltantes, projecaoDe]);

  /**
   * No Meio Ambiente o relatório não trabalha com pontos: cada exigência vale
   * uma fatia do índice do critério (saneamento, unidades de conservação e
   * mata seca). Por isso a projeção é apresentada em % do critério.
   */
  const unidade = ehMeioAmbiente ? "% do critério" : "pontos";




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
          {ehTurismo && <TabsTrigger value="habilitacao">Habilitação na Secult</TabsTrigger>}
          {ehEducacao && <TabsTrigger value="prazo">Prazo de recurso</TabsTrigger>}
          {ehEducacao && <TabsTrigger value="constitutivos">Dados constitutivos</TabsTrigger>}
          {ehEducacao && <TabsTrigger value="repasse">Repasse × índice</TabsTrigger>}
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
            anoBase={ano}
          />

          {potencialFaltante.tipico > 0 && (
            <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Projeção de pontuação</p>
                  <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
                    +{potencialFaltante.tipico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {unidade}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    É o que {municipio?.nome ?? "o município"} pode somar cumprindo os{" "}
                    {faltantes.length} itens hoje zerados
                    {potencialFaltante.maximo > potencialFaltante.tipico && (
                      <>
                        {" "}(teto observado no relatório:{" "}
                        {potencialFaltante.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })})
                      </>
                    )}
                    .
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Meta de melhoria
                </Badge>
              </CardContent>
            </Card>
          )}





          {!!itens?.length && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">
                  O que {municipio?.nome ?? "o município"} já pontua no relatório
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    baixarCsv(
                      `${slug}-pontuado-${municipio?.nome ?? "municipio"}.csv`,
                      montarCsv(
                        ["Registro", "Pontuação", "Quantidade", "Detalhe"],
                        (itens ?? []).map((i) => [
                          i.item_nome,
                          String(i.pontuacao ?? 0),
                          String(i.quantidade ?? ""),
                          i.observacao ?? "",
                        ]),
                      ),
                    )
                  }
                >
                  <Download className="mr-2 size-4" />
                  CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...(itens ?? [])]
                  .sort((a, b) => (b.pontuacao ?? 0) - (a.pontuacao ?? 0))
                  .map((i) => (
                    <div key={i.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.item_nome}</p>
                        {i.observacao && (
                          <p className="text-xs text-muted-foreground">{i.observacao}</p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {i.pontuacao != null
                          ? i.pontuacao.toLocaleString("pt-BR", { maximumFractionDigits: 6 })
                          : "—"}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}


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
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">
                    Itens do critério em {municipio?.nome ?? "—"}
                  </CardTitle>
                  <Select value={filtroPontuacao} onValueChange={(v) => setFiltroPontuacao(v as typeof filtroPontuacao)}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Mostrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pontuados">O que pontuou</SelectItem>
                      <SelectItem value="nao_pontuados">Sem pontuação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    baixarCsv(
                      `${slug}-${municipio?.nome ?? "municipio"}.csv`,
                      montarCsv(
                        ["Item", "Situação", "Pontuação", "Pode alcançar", "Teto no relatório", "Requisito"],
                        referenciaFiltrada.map((r) => {
                          const p = pontuados.get(r.codigo);
                          const proj = projecaoDe(r);
                          return [
                            r.nome_oficial,
                            p?.pontuacao ? "Pontua" : "Não pontua",
                            String(p?.pontuacao ?? 0),
                            p?.pontuacao ? "" : String(proj?.tipico ?? ""),
                            String(proj?.maximo ?? ""),
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
                {potencialFaltante.tipico > 0 && (
                  <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                    <p className="text-sm font-medium">
                      Cumprindo os {faltantes.length} itens que hoje estão zerados,{" "}
                      {municipio?.nome ?? "o município"} passaria a somar cerca de{" "}
                      <span className="text-emerald-700 dark:text-emerald-400">
                        +{potencialFaltante.tipico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {unidade}
                      </span>{" "}
                      neste critério.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expectativa calculada pela pontuação típica de quem já cumpre cada item no
                      mesmo relatório oficial. No melhor cenário, o teto alcançado por outros
                      municípios chega a{" "}
                      {potencialFaltante.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {unidade}.
                    </p>
                  </div>
                )}
                {referenciaFiltrada.map((r) => {
                  const p = pontuados.get(r.codigo);
                  const pontua = !!p?.pontuacao;
                  const proj = projecaoDe(r);
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
                        {!pontua && proj?.observado && (
                          <p className="text-xs text-muted-foreground">
                            {proj.municipios} municípios já pontuam este item; o maior alcançou{" "}
                            {proj.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {unidade}.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={pontua ? "secondary" : "outline"}>
                          {pontua ? p?.pontuacao?.toLocaleString("pt-BR") : "sem pontuação"}
                        </Badge>
                        {!pontua && proj && (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            projeção +
                            {proj.tipico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                          </Badge>
                        )}
                      </div>
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
                  <p className="font-medium">
                    Itens sem pontuação no último relatório
                    {potencialFaltante.tipico > 0 && (
                      <> — expectativa de +
                        {potencialFaltante.tipico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {unidade}
                      </>
                    )}
                    :
                  </p>
                  <ul className="list-disc pl-5">
                    {faltantes.map((f) => (
                      <li key={f.codigo}>
                        {f.nome_oficial} — {f.requisito}
                        {projecaoDe(f) && (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {" "}
                            (projeção +
                            {projecaoDe(f)!
                              .tipico.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
                            {unidade})

                          </span>
                        )}
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
        {ehMeioAmbiente && (
          <TabsContent value="ief" className="pt-4">
            <AreasSemCadastroIef ano={ano} fonte={fonte} />
          </TabsContent>
        )}
        {ehTurismo && (
          <TabsContent value="habilitacao" className="pt-4">
            <HabilitacaoTurismo ano={ano} fonte={fonte} />
          </TabsContent>
        )}
        {ehEducacao && (
          <TabsContent value="prazo" className="pt-4">
            <PrazoRecursoEducacao
              exercicio={ano}
              versao={versaoEducacao}
              municipio={chaveMunicipio}
              consultoria={consultoria}
            />
          </TabsContent>
        )}
        {ehEducacao && (
          <TabsContent value="constitutivos" className="pt-4">
            <DadosConstitutivosEducacao
              exercicio={ano}
              versao={versaoEducacao}
              municipio={chaveMunicipio}
              municipioNome={municipio?.nome ?? "—"}
            />
          </TabsContent>
        )}
        {ehEducacao && (
          <TabsContent value="repasse" className="pt-4">
            <RepasseEducacaoFjp anoBase={ano} fonte={fonte} />
          </TabsContent>
        )}
        {pipeline && consultoria && (
          <TabsContent value="importar" className="pt-4">
            <IngestaoCriterio pipeline={pipeline} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
