import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Download, Info, Trophy } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IngestaoEsportes } from "@/components/icms/IngestaoEsportes";
import { OndeInscrever } from "@/components/icms/OndeInscrever";
import { formatarPopulacao, usePopulacao } from "@/hooks/usePopulacao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { usePerfil } from "@/hooks/usePerfil";
import {
  useAtividadesReferencia,
  useEsportesAnos,
  useEsportesAtividades,
  useEsportesRanking,
  useEsportesAtividadesMunicipios,
  type FonteRelatorio,
} from "@/hooks/useEsportes";
import { VizinhosCriterio } from "@/components/icms/VizinhosCriterio";
import { vizinhosDe } from "@/lib/icms/criterios/regioes";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import { CRITERIO_POR_SLUG } from "@/lib/icms/criterios";
import { baixarCsv, montarCsv } from "@/lib/csv";

const numero = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function CriterioEsportesDetalhe() {
  const { municipio } = useMunicipioAtivo();
  const populacao = usePopulacao();
  const { data: perfil } = usePerfil();
  const { data: anos } = useEsportesAnos();
  const { data: referencia } = useAtividadesReferencia();

  const [chave, setChave] = useState<string>("");
  useEffect(() => {
    if (anos?.length && !chave) setChave(`${anos[0]!.ano}|${anos[0]!.fonte}`);
  }, [anos, chave]);

  const [ano, fonte] = useMemo(() => {
    const [a, f] = chave.split("|");
    return [a ? Number(a) : null, (f as FonteRelatorio) ?? null] as const;
  }, [chave]);

  const { data: ranking } = useEsportesRanking(ano, fonte);
  const nomeNormalizado = municipio ? normalizarMunicipio(municipio.nome) : null;
  const { data: atividades } = useEsportesAtividades(ano, fonte, nomeNormalizado);
  const chavesVizinhas = useMemo(() => vizinhosDe(nomeNormalizado), [nomeNormalizado]);
  const { data: atividadesVizinhos } = useEsportesAtividadesMunicipios(ano, fonte, chavesVizinhas);

  const linhaMunicipio = useMemo(
    () => (ranking ?? []).find((l) => l.municipio === nomeNormalizado) ?? null,
    [ranking, nomeNormalizado],
  );

  const somaAtividades = (atividades ?? []).reduce((s, a) => s + (a.pontuacao ?? 0), 0);
  const divergencia =
    linhaMunicipio && atividades?.length
      ? Math.abs(somaAtividades - linhaMunicipio.nota_atividades) > 0.5
      : false;

  const pesoRcl = (atividades ?? []).find((a) => a.peso_rcl != null)?.peso_rcl ?? null;
  const codigosPontuando = new Set((atividades ?? []).map((a) => a.atividade_codigo));
  const faltantes = (referencia ?? []).filter((r) => !codigosPontuando.has(r.codigo));
  const potencialTotal = pesoRcl
    ? faltantes.reduce((s, r) => s + Number(r.peso) * pesoRcl * 15 * 10, 0)
    : null;

  const [busca, setBusca] = useState("");
  const rankingFiltrado = (ranking ?? []).filter((l) =>
    !busca.trim() ? true : l.municipio.includes(normalizarMunicipio(busca)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/icms/criterios" search={{ criterio: "" }}>
              <ArrowLeft className="h-4 w-4" />
              Critérios
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold">Critério Esportes</h1>
          <p className="text-sm text-muted-foreground">
            ICMS Solidário — Lei 18.030/2009, art. 8º, §3º. Dados dos relatórios da Subsecretaria de
            Esportes (SEDESE).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anos && anos.length > 0 && (
            <Select value={chave} onValueChange={setChave}>
              <SelectTrigger className="w-[230px]">
                <SelectValue placeholder="Ano-base" />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={`${a.ano}|${a.fonte}`} value={`${a.ano}|${a.fonte}`}>
                    Ano-base {a.ano} — {a.fonte}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="municipio">
        <TabsList>
          <TabsTrigger value="municipio">Detalhamento do município</TabsTrigger>
          <TabsTrigger value="melhorar">Como melhorar</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="vizinhos">Vizinhos</TabsTrigger>
          {perfil?.ehConsultoria && <TabsTrigger value="ingestao">Ingestão de dados</TabsTrigger>}
        </TabsList>

        <TabsContent value="municipio" className="space-y-4 pt-4">
          {!anos?.length ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum relatório do critério Esportes importado ainda.
                {perfil?.ehConsultoria &&
                  " Use a aba “Ingestão de dados” para importar o PDF oficial."}
              </CardContent>
            </Card>
          ) : !linhaMunicipio ? (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="flex gap-3 py-6 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium">
                    {municipio?.nome ?? "O município"} não aparece no relatório deste ano-base.
                  </p>
                  <p className="text-muted-foreground">
                    Só participam deste critério os municípios que mantiverem em pleno funcionamento
                    o Conselho Municipal de Esportes (art. 8º, §1º da Lei 18.030/2009), com cadastro
                    e prestação de contas no prazo junto à Subsecretaria de Esportes.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Posição no ranking", linhaMunicipio.posicao?.toString() ?? "—"],
                  ["Pontuação de atividades", numero(linhaMunicipio.nota_atividades)],
                  ["Nota final", numero(linhaMunicipio.nota_final)],
                  ["Índice do critério", `${numero(linhaMunicipio.indice_percentual)}%`],
                  ["JIMI", numero(linhaMunicipio.nota_jimi)],
                  ["JEMG", numero(linhaMunicipio.nota_jemg)],
                  ["Bolsa Atleta/Técnico", numero(linhaMunicipio.nota_babt)],
                  ["Peso da receita per capita", numero(pesoRcl)],
                ].map(([rotulo, valor]) => (
                  <Card key={rotulo}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{rotulo}</p>
                      <p className="font-display text-xl font-semibold">{valor}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {divergencia && (
                <p className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />A soma das atividades (
                  {numero(somaAtividades)}) difere da coluna de atividades do ranking (
                  {numero(linhaMunicipio.nota_atividades)}). Confira o relatório.
                </p>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    Já pontuando ({atividades?.length ?? 0})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      baixarCsv(
                        `esportes-${municipio?.nome ?? ""}-${ano}.csv`,
                        montarCsv(
                          [
                            "Atividade",
                            "Peso",
                            "Atletas",
                            "Modalidades",
                            "Pontuação",
                            "Eventos",
                            "Participantes",
                          ],
                          (atividades ?? []).map((a) => [
                            a.atividade_nome,
                            a.peso_atividade ?? "",
                            a.pontuacao_atletas ?? "",
                            a.pontuacao_modalidades ?? "",
                            a.pontuacao ?? "",
                            a.qtd_eventos,
                            a.total_participantes,
                          ]),
                        ),
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atividade</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Atletas</TableHead>
                        <TableHead className="text-right">Modalidades</TableHead>
                        <TableHead className="text-right">Pontuação</TableHead>
                        <TableHead className="text-right">Eventos</TableHead>
                        <TableHead className="text-right">Participantes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(atividades ?? []).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                                pontuando
                              </Badge>
                              <span>{a.atividade_nome}</span>
                              {a.modalidades_texto && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <p className="text-xs">{a.modalidades_texto}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{numero(a.peso_atividade)}</TableCell>
                          <TableCell className="text-right">
                            {numero(a.pontuacao_atletas)}
                          </TableCell>
                          <TableCell className="text-right">
                            {numero(a.pontuacao_modalidades)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {numero(a.pontuacao)}
                          </TableCell>
                          <TableCell className="text-right">{a.qtd_eventos}</TableCell>
                          <TableCell className="text-right">{a.total_participantes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Ainda não explorado ({faltantes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {faltantes.map((r) => {
                    const potencial = pesoRcl ? Number(r.peso) * pesoRcl * 15 * 10 : null;
                    return (
                      <div key={r.codigo} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{r.nome_oficial}</span>
                          <Badge variant="secondary">não pontuado</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(r as unknown as { requisito?: string }).requisito}
                        </p>
                        <p className="mt-2 text-xs">
                          Peso do Anexo V: <strong>{numero(Number(r.peso))}</strong>
                          {potencial != null && (
                            <>
                              {" "}
                              — ganho potencial de até <strong>{numero(potencial)}</strong> pontos
                              (peso × peso da receita per capita {numero(pesoRcl)} × faixa máxima de
                              atletas e modalidades).
                            </>
                          )}
                        </p>
                      </div>
                    );
                  })}
                  {!faltantes.length && (
                    <p className="text-sm text-muted-foreground">
                      O município já pontua em todas as atividades do Anexo V.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="melhorar" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">O que fazer para pontuar mais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!!faltantes.length && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="font-medium">
                    Atividades sem pontuação no último relatório
                    {potencialTotal != null && (
                      <> — expectativa de até +{numero(potencialTotal)} pontos</>
                    )}
                    :
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {faltantes.map((r) => {
                      const potencial = pesoRcl ? Number(r.peso) * pesoRcl * 15 * 10 : null;
                      return (
                        <li key={r.codigo}>
                          {r.nome_oficial}
                          {(r as unknown as { requisito?: string }).requisito
                            ? ` — ${(r as unknown as { requisito?: string }).requisito}`
                            : ""}
                          {potencial != null && (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">
                              {" "}
                              (projeção +{numero(potencial)} pontos)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {!faltantes.length && !!linhaMunicipio && (
                <p className="text-muted-foreground">
                  O município já pontua em todas as atividades do Anexo V. Para subir no ranking,
                  amplie o número de atletas e modalidades em cada atividade.
                </p>
              )}
              <ul className="list-disc space-y-1 pl-5">
                {(CRITERIO_POR_SLUG.get("esportes")?.comoMelhorar ?? []).map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Projeção estimada pelo peso da atividade no Anexo V × peso da receita per capita do
                município × faixa máxima de atletas e modalidades. Serve como ordem de grandeza para
                priorizar as ações.
              </p>
            </CardContent>
          </Card>
          <OndeInscrever slug="esportes" />
        </TabsContent>

        <TabsContent value="vizinhos" className="pt-4">
          <VizinhosCriterio
            slug="esportes"
            ano={ano}
            fonte={fonte}
            ranking={ranking}
            chaveMunicipio={nomeNormalizado}
            nomeMunicipio={municipio?.nome ?? null}
            itensExternos={(atividadesVizinhos ?? []).map((a) => ({
              municipio: a.municipio,
              item_codigo: a.atividade_codigo,
              item_nome: a.atividade_nome,
              pontuacao: a.pontuacao,
            }))}
          />
        </TabsContent>

        <TabsContent value="ranking" className="space-y-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder="Buscar município"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                baixarCsv(
                  `ranking-esportes-${ano}.csv`,
                  montarCsv(
                    [
                      "Posição",
                      "Município",
                      "Atividades",
                      "JIMI",
                      "JEMG",
                      "BA/BT",
                      "Final",
                      "Índice %",
                    ],
                    rankingFiltrado.map((l) => [
                      l.posicao ?? "",
                      l.municipio_nome,
                      l.nota_atividades,
                      l.nota_jimi,
                      l.nota_jemg,
                      l.nota_babt,
                      l.nota_final,
                      l.indice_percentual,
                    ]),
                  ),
                )
              }
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">
                      População{populacao.anoReferencia ? ` (${populacao.anoReferencia})` : ""}
                    </TableHead>
                    <TableHead className="text-right">Atividades</TableHead>
                    <TableHead className="text-right">JIMI</TableHead>
                    <TableHead className="text-right">JEMG</TableHead>
                    <TableHead className="text-right">BA/BT</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead className="text-right">Índice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingFiltrado.slice(0, 400).map((l) => (
                    <TableRow
                      key={`${l.municipio}-${l.posicao}`}
                      className={l.municipio === nomeNormalizado ? "bg-emerald-500/10" : undefined}
                    >
                      <TableCell>
                        {l.posicao === 1 ? (
                          <Trophy className="h-4 w-4 text-amber-500" />
                        ) : (
                          l.posicao
                        )}
                      </TableCell>
                      <TableCell>{l.municipio_nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatarPopulacao(populacao.de(l.municipio_nome))}
                      </TableCell>
                      <TableCell className="text-right">{numero(l.nota_atividades)}</TableCell>
                      <TableCell className="text-right">{numero(l.nota_jimi)}</TableCell>
                      <TableCell className="text-right">{numero(l.nota_jemg)}</TableCell>
                      <TableCell className="text-right">{numero(l.nota_babt)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {numero(l.nota_final)}
                      </TableCell>
                      <TableCell className="text-right">{numero(l.indice_percentual)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {perfil?.ehConsultoria && (
          <TabsContent value="ingestao" className="pt-4">
            <IngestaoEsportes />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
