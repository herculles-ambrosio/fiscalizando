/**
 * Fiscaliza Cartório — confere o que cada cartório declarou de ISS ao
 * município com os emolumentos publicados pelo Portal da Transparência do
 * TJMG (coluna "Emolumentos (DAP)").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCartorioConfig,
  useCompetenciasCartorio,
  useExcluirCompetenciaCartorio,
  useFiscalizacaoCartorio,
  useImportarDeclaracoes,
  useImportarEmolumentos,
  useSalvarCartorioConfig,
  useSalvarDeclaracao,
  type Competencia,
  type LinhaFiscalizacao,
} from "@/hooks/useCartorios";
import { lerDeclaracoes, lerEmolumentos, MESES_NOME } from "@/lib/cartorios/parser";
import { buscarPortalCartorios } from "@/lib/cartorios/portal.functions";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/cartorios")({
  head: () => ({
    meta: [
      { title: "Fiscaliza Cartório — ISS das serventias | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Compare os emolumentos publicados pelo TJMG com o ISS que cada cartório declarou ao município e encontre a diferença a cobrar.",
      },
      { property: "og:title", content: "Fiscaliza Cartório — ISS das serventias" },
      {
        property: "og:description",
        content:
          "Emolumentos do portal do TJMG cruzados com a declaração de ISS de cada cartório do município.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FiscalizaCartorio,
});

const anoAtual = new Date().getFullYear();

function FiscalizaCartorio() {
  const { data: competencias } = useCompetenciasCartorio();
  const [chaveComp, setChaveComp] = useState("");

  useEffect(() => {
    if (competencias?.length && !chaveComp)
      setChaveComp(`${competencias[0]!.ano}-${competencias[0]!.mes}`);
  }, [competencias, chaveComp]);

  const competencia: Competencia | null = useMemo(() => {
    const [a, m] = chaveComp.split("-");
    return a && m ? { ano: Number(a), mes: Number(m) } : null;
  }, [chaveComp]);

  const { data: config } = useCartorioConfig();
  const { data: linhas, isFetching } = useFiscalizacaoCartorio(competencia);
  const aliquota = config?.aliquota_iss ?? 5;

  const totais = useMemo(() => {
    const l = linhas ?? [];
    return {
      cartorios: l.length,
      emolumentos: l.reduce((s, x) => s + x.emolumentos, 0),
      devido: l.reduce((s, x) => s + x.issDevido, 0),
      declarado: l.reduce((s, x) => s + (x.issDeclarado ?? 0), 0),
      semDeclaracao: l.filter((x) => !x.temDeclaracao).length,
    };
  }, [linhas]);

  const diferenca = totais.devido - totais.declarado;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Fiscaliza Cartório</h1>
          <p className="text-sm text-muted-foreground">
            Emolumentos publicados pelo TJMG confrontados com o ISS declarado por cada serventia
            (item 21.01 da Lei Complementar 116/2003).
          </p>
        </div>
        {!!competencias?.length && (
          <Select value={chaveComp} onValueChange={setChaveComp}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              {competencias.map((c) => (
                <SelectItem key={`${c.ano}-${c.mes}`} value={`${c.ano}-${c.mes}`}>
                  {MESES_NOME[c.mes - 1]} de {c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue={competencias?.length ? "fiscalizacao" : "importar"}>
        <TabsList>
          <TabsTrigger value="fiscalizacao">Fiscalização</TabsTrigger>
          <TabsTrigger value="importar">Carga de dados</TabsTrigger>
          <TabsTrigger value="config">Alíquota do município</TabsTrigger>
        </TabsList>

        <TabsContent value="fiscalizacao" className="space-y-4 pt-4">
          {!competencia ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum mês carregado ainda. Use a aba “Carga de dados” para enviar a lista de
                serventias do portal do TJMG.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Cartórios no mês", String(totais.cartorios)],
                  ["Emolumentos (TJMG)", formatarMoeda(totais.emolumentos)],
                  [`ISS devido (${aliquota}%)`, formatarMoeda(totais.devido)],
                  ["ISS declarado", formatarMoeda(totais.declarado)],
                  ["Diferença a apurar", formatarMoeda(diferenca)],
                ].map(([rotulo, valor]) => (
                  <Card key={rotulo}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{rotulo}</p>
                      <p className="font-display text-xl font-semibold">{valor}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totais.semDeclaracao > 0 && (
                <p className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="size-4" />
                  {totais.semDeclaracao} cartório(s) sem nenhuma declaração informada neste mês —
                  lance o valor na linha ou envie a planilha da prefeitura.
                </p>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    {MESES_NOME[competencia.mes - 1]} de {competencia.ano}
                    {isFetching && <span className="ml-2 text-xs text-muted-foreground">…</span>}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      baixarCsv(
                        `fiscaliza-cartorio-${competencia.ano}-${competencia.mes}.csv`,
                        montarCsv(
                          [
                            "CNS",
                            "Serventia",
                            "Comarca",
                            "Tipo de serviço",
                            "Situação",
                            "Emolumentos (TJMG)",
                            "Base declarada",
                            "Diferença de base",
                            `ISS devido (${aliquota}%)`,
                            "ISS declarado",
                            "ISS pago",
                            "Diferença de ISS",
                          ],
                          (linhas ?? []).map((l) => [
                            l.cns,
                            l.nome,
                            l.comarca ?? "",
                            l.tipoServico,
                            l.status ?? "",
                            l.emolumentos,
                            l.baseDeclarada ?? "",
                            l.diferencaBase ?? "",
                            l.issDevido,
                            l.issDeclarado ?? "",
                            l.issPago ?? "",
                            l.diferencaIss ?? "",
                          ]),
                        ),
                      )
                    }
                  >
                    <Download className="mr-2 size-4" />
                    CSV
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Serventia</TableHead>
                        <TableHead>Tipo de serviço</TableHead>
                        <TableHead className="text-right">Emolumentos</TableHead>
                        <TableHead className="text-right">ISS devido</TableHead>
                        <TableHead className="w-40 text-right">Base declarada</TableHead>
                        <TableHead className="w-36 text-right">ISS pago</TableHead>
                        <TableHead className="text-right">Diferença de ISS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(linhas ?? []).map((l) => (
                        <LinhaCartorio
                          key={`${l.cns}|${l.tipoServico}`}
                          linha={l}
                          competencia={competencia}
                          aliquota={aliquota}
                        />
                      ))}
                      {!linhas?.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhum cartório neste mês.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="importar" className="pt-4">
          <CargaDados competenciaAtual={competencia} />
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <ConfiguracaoAliquota />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Linha da tabela com lançamento direto do que o cartório declarou. */
function LinhaCartorio({
  linha,
  competencia,
  aliquota,
}: {
  linha: LinhaFiscalizacao;
  competencia: Competencia;
  aliquota: number;
}) {
  const salvar = useSalvarDeclaracao();
  const [base, setBase] = useState(linha.baseDeclarada?.toString() ?? "");
  const [pago, setPago] = useState(linha.issPago?.toString() ?? "");

  useEffect(() => {
    setBase(linha.baseDeclarada?.toString() ?? "");
    setPago(linha.issPago?.toString() ?? "");
  }, [linha.baseDeclarada, linha.issPago]);

  const numero = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

  function gravar() {
    const baseNum = numero(base);
    const pagoNum = numero(pago);
    if (baseNum === (linha.baseDeclarada ?? 0) && pagoNum === (linha.issPago ?? 0)) return;
    salvar.mutate(
      {
        competencia,
        cns: linha.cns,
        tipoServico: linha.tipoServico,
        serventiaNome: linha.nome,
        baseDeclarada: baseNum,
        issDeclarado: (baseNum * aliquota) / 100,
        issPago: pagoNum,
        observacao: null,
      },
      {
        onSuccess: () => toast.success("Declaração salva."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  }

  const dif = linha.diferencaIss;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{linha.nome}</div>
        <div className="text-xs text-muted-foreground">
          CNS {linha.cns}
          {linha.comarca ? ` — ${linha.comarca}` : ""}
          {linha.status ? ` — ${linha.status}` : ""}
        </div>
      </TableCell>
      <TableCell className="text-sm">{linha.tipoServico || "—"}</TableCell>
      <TableCell className="text-right">{formatarMoeda(linha.emolumentos)}</TableCell>
      <TableCell className="text-right font-medium">{formatarMoeda(linha.issDevido)}</TableCell>
      <TableCell className="text-right">
        <Input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          onBlur={gravar}
          placeholder="0,00"
          className="h-8 text-right"
          inputMode="decimal"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          value={pago}
          onChange={(e) => setPago(e.target.value)}
          onBlur={gravar}
          placeholder="0,00"
          className="h-8 text-right"
          inputMode="decimal"
        />
      </TableCell>
      <TableCell className="text-right">
        {!linha.temDeclaracao ? (
          <Badge variant="secondary">sem declaração</Badge>
        ) : dif == null ? (
          "—"
        ) : (
          <span
            className={
              dif > 0.5 ? "font-medium text-destructive" : dif < -0.5 ? "text-emerald-600" : ""
            }
          >
            {formatarMoeda(dif)}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

function CargaDados({ competenciaAtual }: { competenciaAtual: Competencia | null }) {
  const importarEmol = useImportarEmolumentos();
  const importarDecl = useImportarDeclaracoes();
  const excluir = useExcluirCompetenciaCartorio();
  const { data: competencias } = useCompetenciasCartorio();
  const buscar = useServerFn(buscarPortalCartorios);

  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(anoAtual));
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [urlPortal, setUrlPortal] = useState("");
  const [buscando, setBuscando] = useState(false);
  const refEmol = useRef<HTMLInputElement>(null);
  const refDecl = useRef<HTMLInputElement>(null);

  const competencia = { ano: Number(ano), mes: Number(mes) };

  async function enviarEmolumentos(arquivo: File) {
    try {
      const r = await lerEmolumentos(arquivo);
      const comp = r.competencia ?? competencia;
      const total = await importarEmol.mutateAsync({
        linhas: r.linhas,
        competencia: comp,
        arquivoNome: arquivo.name,
      });
      setIgnoradas(r.colunasIgnoradas);
      setMes(String(comp.mes));
      setAno(String(comp.ano));
      toast.success(`${total} cartório(s) carregados em ${MESES_NOME[comp.mes - 1]}/${comp.ano}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }

  async function enviarDeclaracoes(arquivo: File) {
    try {
      const r = await lerDeclaracoes(arquivo);
      const total = await importarDecl.mutateAsync({
        linhas: r.linhas,
        competencia,
        arquivoNome: arquivo.name,
      });
      toast.success(`${total} declaração(ões) carregadas.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }

  async function tentarPortal() {
    setBuscando(true);
    try {
      const r = await buscar({ data: urlPortal.trim() ? { url: urlPortal.trim() } : {} });
      if (r.ok && r.conteudo) {
        const arquivo = new File([r.conteudo], "portal-tjmg.csv", { type: "text/csv" });
        await enviarEmolumentos(arquivo);
      } else {
        toast.warning(r.mensagem);
      }
    } catch {
      toast.error("Não foi possível falar com o portal do TJMG.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emolumentos do portal do TJMG</CardTitle>
          <p className="text-sm text-muted-foreground">
            No Portal da Transparência do TJMG, abra a “Lista de serventias”, filtre o mês e o seu
            município e exporte a tabela. Envie aqui o arquivo (CSV ou Excel) com as colunas Nome da
            Serventia, Código CNS, Comarca, Tipo de Serviço, Status, Emolumentos (DAP), Recompe
            (DAP), TFJ (DAP) e Despesa.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES_NOME.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ano</Label>
              <Input
                className="h-9 w-28"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <input
              ref={refEmol}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviarEmolumentos(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => refEmol.current?.click()} disabled={importarEmol.isPending}>
              <FileSpreadsheet className="mr-2 size-4" />
              {importarEmol.isPending ? "Carregando…" : "Enviar lista de serventias"}
            </Button>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Tentar buscar direto no portal</p>
            <p className="text-xs text-muted-foreground">
              O painel do TJMG é protegido e costuma recusar a consulta automática. Se você tiver o
              endereço direto de um arquivo de exportação, cole abaixo.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                className="min-w-64 flex-1"
                placeholder="Endereço do arquivo (opcional)"
                value={urlPortal}
                onChange={(e) => setUrlPortal(e.target.value)}
              />
              <Button variant="outline" onClick={tentarPortal} disabled={buscando}>
                {buscando ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 size-4" />
                )}
                Buscar automaticamente
              </Button>
            </div>
          </div>

          {!!ignoradas.length && (
            <p className="text-xs text-muted-foreground">
              Colunas do arquivo que não foram usadas: {ignoradas.join(", ")}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que o cartório declarou ao município</CardTitle>
          <p className="text-sm text-muted-foreground">
            Envie a planilha do sistema de ISS da prefeitura (com CNS ou nome do cartório, base de
            cálculo, ISS declarado e ISS pago) ou digite os valores direto na aba Fiscalização.
          </p>
        </CardHeader>
        <CardContent>
          <input
            ref={refDecl}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void enviarDeclaracoes(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={() => refDecl.current?.click()}
            disabled={importarDecl.isPending}
          >
            <FileSpreadsheet className="mr-2 size-4" />
            {importarDecl.isPending ? "Carregando…" : "Enviar planilha da prefeitura"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Os valores entram na competência selecionada acima ({MESES_NOME[Number(mes) - 1]} de{" "}
            {ano}), salvo quando a planilha trouxer a própria coluna de mês.
          </p>
        </CardContent>
      </Card>

      {!!competencias?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meses já carregados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {competencias.map((c) => (
              <Badge
                key={`${c.ano}-${c.mes}`}
                variant={
                  competenciaAtual?.ano === c.ano && competenciaAtual?.mes === c.mes
                    ? "default"
                    : "secondary"
                }
                className="gap-1"
              >
                {MESES_NOME[c.mes - 1]}/{c.ano}
                <button
                  type="button"
                  aria-label={`Excluir ${MESES_NOME[c.mes - 1]} de ${c.ano}`}
                  onClick={() =>
                    excluir.mutate(c, {
                      onSuccess: () => toast.success("Mês excluído."),
                      onError: () => toast.error("Não foi possível excluir."),
                    })
                  }
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfiguracaoAliquota() {
  const { data: config } = useCartorioConfig();
  const salvar = useSalvarCartorioConfig();
  const [aliquota, setAliquota] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!config) return;
    setAliquota(String(config.aliquota_iss));
    setObservacao(config.observacao ?? "");
  }, [config]);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Alíquota de ISS dos cartórios</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada município define a sua alíquota em lei, entre 2% e 5%. O valor abaixo é usado para
          calcular o ISS devido sobre os emolumentos publicados pelo TJMG.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Alíquota (%)</Label>
          <Input
            className="w-32"
            value={aliquota}
            onChange={(e) => setAliquota(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-1">
          <Label>Observação</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Lei municipal que fixa a alíquota, por exemplo."
          />
        </div>
        <Button
          onClick={() =>
            salvar.mutate(
              {
                aliquota_iss: Number(aliquota.replace(",", ".")) || 0,
                observacao: observacao.trim() || null,
              },
              {
                onSuccess: () => toast.success("Alíquota salva."),
                onError: () => toast.error("Não foi possível salvar."),
              },
            )
          }
          disabled={salvar.isPending}
        >
          <Save className="mr-2 size-4" />
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
