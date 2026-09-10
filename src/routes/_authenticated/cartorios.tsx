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
import {
  conferirMunicipio,
  lerDeclaracoes,
  lerEmolumentos,
  MESES_NOME,
  type LinhaEmolumento,
} from "@/lib/cartorios/parser";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { usePreferencia } from "@/hooks/usePreferencia";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  buscarServentiasPortal,
  listarCompetenciasPortal,
} from "@/lib/cartorios/portal.functions";
import { formatarMoeda, formatarValorGrid } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import CargasView from "@/components/cartorios/CargasView";
import DocumentosView from "@/components/cartorios/DocumentosView";
import ModelosCartorioView from "@/components/cartorios/ModelosCartorioView";
import ResumoMunicipiosView from "@/components/cartorios/ResumoMunicipiosView";


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
  const { data: todasLinhas, isFetching } = useFiscalizacaoCartorio(competencia);
  const aliquota = config?.aliquota_iss ?? 5;

  /** Alguns municípios não cobram ISS de serventias vagas — a escolha fica gravada no perfil. */
  const { valor: incluirVagos, definir: definirIncluirVagos } = usePreferencia(
    "cartorio-incluir-vagos",
    true,
  );

  const vagos = useMemo(
    () => (todasLinhas ?? []).filter((l) => (l.status ?? "").toLowerCase().includes("vag")).length,
    [todasLinhas],
  );

  const linhas = useMemo(
    () =>
      incluirVagos
        ? todasLinhas
        : (todasLinhas ?? []).filter((l) => !(l.status ?? "").toLowerCase().includes("vag")),
    [todasLinhas, incluirVagos],
  );

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
        <TabsList className="flex-wrap">
          <TabsTrigger value="fiscalizacao">Fiscalização</TabsTrigger>
          <TabsTrigger value="resumo">Resumo por município</TabsTrigger>
          <TabsTrigger value="importar">Carga de dados</TabsTrigger>
          <TabsTrigger value="cargas">Meses carregados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
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
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {MESES_NOME[competencia.mes - 1]} de {competencia.ano}
                    {isFetching && <span className="ml-2 text-xs text-muted-foreground">…</span>}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={incluirVagos ? "com" : "sem"}
                    onValueChange={(v) => definirIncluirVagos(v === "com")}
                  >
                    <SelectTrigger className="h-9 w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="com">
                        Incluir cartórios vagos{vagos ? ` (${vagos})` : ""}
                      </SelectItem>
                      <SelectItem value="sem">Somente cartórios providos</SelectItem>
                    </SelectContent>
                  </Select>
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
                  </div>
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

        <TabsContent value="cargas" className="pt-4">
          <CargasView />
        </TabsContent>

        <TabsContent value="documentos" className="pt-4">
          <DocumentosView competencia={competencia} />
        </TabsContent>

        <TabsContent value="modelos" className="pt-4">
          <ModelosCartorioView competencia={competencia} />
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
  const exibir = (v: number | null | undefined) => (v == null ? "" : formatarValorGrid(v));
  const [base, setBase] = useState(exibir(linha.baseDeclarada));
  const [pago, setPago] = useState(exibir(linha.issPago));

  useEffect(() => {
    setBase(exibir(linha.baseDeclarada));
    setPago(exibir(linha.issPago));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha.baseDeclarada, linha.issPago]);

  /** Aceita "2500,50", "2.500,50", "2500.50" e devolve o número correspondente. */
  const numero = (v: string) => {
    const limpo = v.replace(/[^\d.,-]/g, "");
    if (!limpo) return 0;
    let normalizado: string;
    if (limpo.includes(",")) {
      normalizado = limpo.replace(/\./g, "").replace(",", ".");
    } else {
      const partes = limpo.split(".");
      const ultima = partes[partes.length - 1] ?? "";
      normalizado =
        partes.length > 1 && ultima.length !== 3
          ? `${partes.slice(0, -1).join("")}.${ultima}`
          : partes.join("");

    }
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : 0;
  };

  function gravar() {
    const baseNum = numero(base);
    const pagoNum = numero(pago);
    setBase(base.trim() === "" ? "" : formatarValorGrid(baseNum));
    setPago(pago.trim() === "" ? "" : formatarValorGrid(pagoNum));
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
  const { municipio, municipios, podeTrocar, trocar } = useMunicipioAtivo();
  const listarCompetencias = useServerFn(listarCompetenciasPortal);
  const buscarServentias = useServerFn(buscarServentiasPortal);

  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(anoAtual));
  const [ignoradas, setIgnoradas] = useState<string[]>([]);
  const [competenciasPortal, setCompetenciasPortal] = useState<string[]>([]);
  const [competenciaPortal, setCompetenciaPortal] = useState("");
  const [somenteComarca, setSomenteComarca] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [listando, setListando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<{
    encontrados: string[];
  } | null>(null);
  const refEmol = useRef<HTMLInputElement>(null);
  const refDecl = useRef<HTMLInputElement>(null);

  const competencia = { ano: Number(ano), mes: Number(mes) };

  /**
   * Só aceita planilha da prefeitura ativa. Quando a única referência é a
   * comarca (que abrange cidades vizinhas), bloqueia e oferece trocar de prefeitura.
   */
  function municipioConfere(
    linhas: { municipio?: string | null; comarca?: string | null }[],
  ): boolean {
    const conf = conferirMunicipio(linhas, municipio?.nome);
    if (conf.ok) return true;
    const lista = conf.encontrados.slice(0, 3).join(", ");
    if (conf.base === "municipio") {
      toast.error(
        `Este arquivo é de ${lista}, e a prefeitura ativa é ${municipio?.nome}. Troque a prefeitura ou envie o arquivo correto.`,
      );
      return false;
    }
    setConfirmacao({ encontrados: conf.encontrados });
    return false;
  }

  async function gravarEmolumentos(
    linhas: LinhaEmolumento[],
    comp: { mes: number; ano: number },
    origem: string,
  ) {
    if (!municipioConfere(linhas)) return;
    const total = await importarEmol.mutateAsync({
      linhas,
      competencia: comp,
      arquivoNome: origem,
    });
    setMes(String(comp.mes));
    setAno(String(comp.ano));
    toast.success(`${total} cartório(s) carregados em ${MESES_NOME[comp.mes - 1]}/${comp.ano}.`);
  }

  async function enviarEmolumentos(arquivo: File) {
    try {
      const r = await lerEmolumentos(arquivo);
      setIgnoradas(r.colunasIgnoradas);
      await gravarEmolumentos(r.linhas, r.competencia ?? competencia, arquivo.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }


  async function enviarDeclaracoes(arquivo: File) {
    try {
      const r = await lerDeclaracoes(arquivo);
      const gravar = async () => {
        const total = await importarDecl.mutateAsync({
          linhas: r.linhas,
          competencia,
          arquivoNome: arquivo.name,
        });
        toast.success(`${total} declaração(ões) carregadas.`);
      };
      if (!municipioConfere(r.linhas)) return;
      await gravar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  }


  /** Lê no portal do TJMG quais meses já estão publicados. */
  async function carregarCompetenciasPortal() {
    setListando(true);
    try {
      const r = await listarCompetencias();
      if (!r.ok || !r.competencias.length) {
        toast.warning(r.mensagem || "O portal do TJMG não devolveu as competências.");
        return;
      }
      setCompetenciasPortal(r.competencias);
      setCompetenciaPortal((atual) => atual || r.competencias[0]!);
      toast.success(`${r.competencias.length} competência(s) disponíveis no portal.`);
    } catch {
      toast.error("Não foi possível falar com o portal do TJMG.");
    } finally {
      setListando(false);
    }
  }

  /** Baixa a lista de serventias do painel do TJMG e grava a carga. */
  async function buscarNoPortal() {
    const alvo = competenciaPortal || `${Number(mes)}/${ano}`;
    setBuscando(true);
    try {
      const r = await buscarServentias({
        data: {
          mesAno: alvo,
          municipio: somenteComarca ? (municipio?.nome ?? null) : null,
        },
      });
      if (!r.ok || !r.linhas.length) {
        toast.warning(r.mensagem || "O portal do TJMG não devolveu serventias.");
        return;
      }
      const [mesPortal, anoPortal] = alvo.split("/").map(Number) as [number, number];
      const porNome = r.filtro === "nome";
      const linhas: LinhaEmolumento[] = r.linhas.map((s) => ({
        cns: s.cns,
        nome: s.nome,
        comarca: s.comarca || null,
        // município não é sede de comarca: as serventias foram achadas pelo nome
        municipio: porNome ? (municipio?.nome ?? null) : null,
        tipoServico: "",
        status: s.status || null,
        emolumentos: s.emolumentos,
        recompe: s.recompe,
        tfj: s.tfj,
        despesa: s.despesa,
        outrasReceitas: 0,
        mes: mesPortal,
        ano: anoPortal,
      }));
      setIgnoradas([]);
      if (porNome)
        toast.info(
          `${municipio?.nome} não é sede de comarca (comarca de ${r.comarca ?? "—"}): busquei ${r.linhas.length} cartório(s) pelo nome da serventia.`,
        );
      await gravarEmolumentos(
        linhas,
        { mes: mesPortal, ano: anoPortal },
        `Portal TJMG ${alvo}${
          porNome
            ? ` — serventias de ${municipio?.nome}`
            : r.comarca
              ? ` — comarca ${r.comarca}`
              : ""
        }`,
      );
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
            <p className="text-sm font-medium">Buscar no portal do TJMG</p>
            <p className="text-xs text-muted-foreground">
              Sem exportar nada: o sistema consulta o painel público do TJMG, escolhe o mês e a
              comarca e traz a lista de serventias pronta.
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Competência no portal</Label>
                <Select
                  value={competenciaPortal}
                  onValueChange={setCompetenciaPortal}
                  disabled={!competenciasPortal.length}
                >
                  <SelectTrigger className="h-9 w-44">
                    <SelectValue
                      placeholder={listando ? "Carregando…" : "Buscar competências"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciasPortal.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => void carregarCompetenciasPortal()}
                disabled={listando}
              >
                {listando ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Ver meses disponíveis
              </Button>
              <Button
                onClick={() => void buscarNoPortal()}
                disabled={buscando || (!competenciaPortal && !mes)}
              >
                {buscando ? (
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                ) : (
                  <Globe className="mr-2 size-4" />
                )}
                {buscando ? "Baixando…" : "Buscar no portal do TJMG"}
              </Button>
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={somenteComarca}
                onChange={(e) => setSomenteComarca(e.target.checked)}
              />
              Trazer apenas os cartórios de {municipio?.nome ?? "prefeitura ativa"} — quando o
              município não é sede de comarca, o sistema procura pelo nome da serventia (desmarque
              para trazer o estado inteiro)

            </label>
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

      <AlertDialog open={!!confirmacao} onOpenChange={(a) => !a && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferir a prefeitura do arquivo</AlertDialogTitle>
            <AlertDialogDescription>
              A prefeitura ativa é <strong>{municipio?.nome}</strong>, mas o arquivo traz apenas a
              comarca {confirmacao?.encontrados.slice(0, 3).join(", ")}. A carga foi bloqueada:
              troque para a prefeitura correta e envie o arquivo de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {podeTrocar && (
            <div className="px-1">
              <Select
                onValueChange={(id) => {
                  trocar(id);
                  setConfirmacao(null);
                  toast.success("Prefeitura trocada. Envie o arquivo novamente.");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolher outra prefeitura…" />
                </SelectTrigger>
                <SelectContent>
                  {municipios.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}/{m.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
