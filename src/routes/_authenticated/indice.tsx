import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileUp, Printer, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { formatarCnpj, formatarData, formatarMoeda } from "@/lib/format";
import { decodificarArquivo } from "@/lib/vaf/parser";
import {
  apurarIndice,
  conferirLiquido,
  csvIndice,
  formatarIndice,
  type ApuracaoIndice,
  type LinhaContribuinte,
  type LinhaMunicipio,
} from "@/lib/vaf/indice";

export const Route = createFileRoute("/_authenticated/indice")({
  head: () => ({
    meta: [
      { title: "Índice definitivo do VAF — apuração e relatório" },
      {
        name: "description",
        content:
          "Apure o índice provisório ou definitivo do VAF a partir do arquivo da SEF-MG e emita o relatório consolidado do município.",
      },
      { property: "og:title", content: "Índice definitivo do VAF" },
      {
        property: "og:description",
        content: "Relatório consolidado de VAF A, VAF B, VAF C, valor líquido e índice do município.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaIndice,
});

function Kpi({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        destaque
          ? "rounded-xl border border-primary/40 bg-primary/5 p-4"
          : "rounded-xl border border-border bg-card p-4"
      }
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p
        className={
          destaque
            ? "mt-1 font-display text-2xl font-semibold text-primary"
            : "mt-1 font-display text-xl font-semibold"
        }
      >
        {valor}
      </p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function LinhaValor({
  rotulo,
  valor,
  negativo,
}: {
  rotulo: string;
  valor: number;
  negativo?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span
        className={
          negativo
            ? "font-mono text-sm font-medium text-destructive"
            : "font-mono text-sm font-medium"
        }
      >
        {negativo ? "− " : ""}
        {formatarMoeda(valor)}
      </span>
    </div>
  );
}

function TabelaMunicipios({
  linhas,
  titulo,
  nomePorCodigo,
}: {
  linhas: LinhaMunicipio[];
  titulo: string;
  nomePorCodigo: (c: string) => string;
}) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{titulo}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Código</TableHead>
            <TableHead>Município</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-24 text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.codigo}>
              <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
              <TableCell>{nomePorCodigo(l.codigo)}</TableCell>
              <TableCell className="text-right font-mono">{formatarMoeda(l.valor)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {(total ? (l.valor / total) * 100 : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </TableCell>
            </TableRow>
          ))}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum registro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-mono">{formatarMoeda(total)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function TabelaContribuintes({ linhas }: { linhas: LinhaContribuinte[] }) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Inscrição estadual</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Contribuinte</TableHead>
          <TableHead className="w-24">Município</TableHead>
          <TableHead className="w-28">Entrega</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l, i) => (
          <TableRow key={`${l.inscricao_estadual}-${i}`}>
            <TableCell className="font-mono text-xs">{l.inscricao_estadual}</TableCell>
            <TableCell className="font-mono text-xs">{formatarCnpj(l.cnpj)}</TableCell>
            <TableCell className="max-w-[22rem] truncate">{l.nome ?? "—"}</TableCell>
            <TableCell className="font-mono text-xs">{l.municipio}</TableCell>
            <TableCell className="text-xs">{formatarData(l.data)}</TableCell>
            <TableCell className="text-right font-mono">{formatarMoeda(l.valor)}</TableCell>
          </TableRow>
        ))}
        {linhas.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhum registro.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5}>Total ({linhas.length})</TableCell>
          <TableCell className="text-right font-mono">{formatarMoeda(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

const CHAVE_REF = "vaf_indice_referencia";

function PaginaIndice() {
  const { municipio, municipios } = useMunicipioAtivo();
  const { data: config } = useConfiguracao();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [vafEstadualRef, setVafEstadualRef] = useState<string>("");
  const [fator, setFator] = useState<string>("1");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_REF) ?? "null") as {
        vafEstadual?: string;
        fator?: string;
      } | null;
      if (salvo?.vafEstadual) setVafEstadualRef(salvo.vafEstadual);
      if (salvo?.fator) setFator(salvo.fator);
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAVE_REF, JSON.stringify({ vafEstadual: vafEstadualRef, fator }));
  }, [vafEstadualRef, fator]);

  const nomePorCodigo = useMemo(() => {
    const mapa = new Map(
      municipios.map((m) => [String(m.codigo_sef).padStart(3, "0"), `${m.nome}/${m.uf}`]),
    );
    return (codigo: string) => mapa.get(codigo.padStart(3, "0")) ?? "—";
  }, [municipios]);

  const apuracao = useMemo<ApuracaoIndice | null>(() => {
    if (!texto) return null;
    try {
      if (possuiIndice(texto)) return apurarIndice(texto);
      return estimarIndiceProvisorio(texto, {
        vafEstadualReferencia: Number(vafEstadualRef.replace(/[^0-9]/g, "")) || 0,
        fatorCalibragem: Number(fator.replace(",", ".")) || 1,
        codigoMunicipio: municipio?.codigo_sef ? String(municipio.codigo_sef).padStart(3, "0") : "",
      });
    } catch {
      return null;
    }
  }, [texto, vafEstadualRef, fator, municipio?.codigo_sef]);

  async function selecionar(file: File | null) {
    setArquivo(file);
    setTexto(null);
    setErro(null);
    if (!file) return;
    setCarregando(true);
    try {
      setTexto(decodificarArquivo(await file.arrayBuffer()));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(false);
    }
  }

  function baixarCsv() {
    if (!apuracao) return;
    const csv = csvIndice(apuracao, municipio?.nome ?? "");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indice_${apuracao.estimado ? "provisorio_estimado" : apuracao.tipoIndice}_${apuracao.codigoMunicipio}_${apuracao.anoBase ?? ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const conferencia = apuracao && !apuracao.estimado ? conferirLiquido(apuracao) : null;
  const divergente =
    !!apuracao &&
    !!municipio?.codigo_sef &&
    !!apuracao.codigoMunicipio &&
    String(municipio.codigo_sef).padStart(3, "0") !== apuracao.codigoMunicipio.padStart(3, "0");
  const mostrarRelatorio = !!apuracao && !divergente;


  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Índice do VAF</h1>
          <p className="text-sm text-muted-foreground">
            Envie o arquivo de índices da SEF-MG (provisório ou definitivo) para gerar o relatório
            consolidado do município.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            {arquivo ? "Trocar arquivo" : "Selecionar arquivo"}
          </Button>
          <Button variant="outline" disabled={!apuracao} onClick={baixarCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button disabled={!apuracao} onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {arquivo && (
        <p className="no-print text-xs text-muted-foreground">
          Arquivo: <span className="font-mono">{arquivo.name}</span> ·{" "}
          {(arquivo.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo e apurando o arquivo…
        </div>
      )}

      {erro && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>Não foi possível apurar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {divergente && apuracao && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>Arquivo de outro município</AlertTitle>
          <AlertDescription>
            O arquivo é do município de código {apuracao.codigoMunicipio}, diferente da prefeitura
            ativa ({municipio?.codigo_sef} — {municipio?.nome}). Troque a prefeitura ativa para
            apurar este índice.
          </AlertDescription>
        </Alert>
      )}

      {mostrarRelatorio && apuracao && (
        <div id="relatorio-indice" className="space-y-6">
          {/* Cabeçalho institucional */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {config?.estado ?? "Estado de Minas Gerais"}
                </p>
                <h2 className="font-display text-xl font-semibold">
                  {config?.nome_prefeitura || municipio?.nome || "Município"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Declaração Anual do Movimento Econômico Fiscal — Ano base{" "}
                  {apuracao.anoBase ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  VAF — Valor Adicionado Fiscal consolidado · Município {apuracao.codigoMunicipio}{" "}
                  {municipio?.nome ?? ""}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={apuracao.tipoIndice === "definitivo" ? "default" : "secondary"}
                  className="uppercase"
                >
                  Índice {apuracao.tipoIndice}
                </Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Período: {formatarData(apuracao.periodoInicio)} a{" "}
                  {formatarData(apuracao.periodoFim)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Emitido em {new Date().toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              rotulo="Índice do município"
              valor={formatarIndice(apuracao.indice)}
              detalhe="Participação percentual no VAF estadual"
              destaque
            />
            <Kpi rotulo="Valor líquido (VAF municipal)" valor={formatarMoeda(apuracao.valorLiquido)} />
            <Kpi rotulo="VAF estadual" valor={formatarMoeda(apuracao.vafEstadual)} />
            <Kpi
              rotulo="Declarações no arquivo"
              valor={apuracao.totalDeclaracoes.toLocaleString("pt-BR")}
              detalhe={`${apuracao.creditosExternos.length} créditos externos · ${apuracao.simei.length} SIMEI`}
            />
          </div>

          {/* Blocos VAF A / B / C */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">VAF A</CardTitle>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="VAF próprio" valor={apuracao.vafProprio} />
                <LinhaValor rotulo="Crédito externo" valor={apuracao.creditoExterno} />
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(apuracao.vafProprio + apuracao.creditoExterno)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">VAF B</CardTitle>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="Crédito interno" valor={apuracao.creditoInterno} />
                <LinhaValor rotulo="Crédito próprio" valor={apuracao.creditoProprio} />
                <LinhaValor rotulo="Débito" valor={apuracao.debito} negativo />
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(
                      apuracao.creditoInterno + apuracao.creditoProprio - apuracao.debito,
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">VAF C</CardTitle>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="Acerto de crédito" valor={apuracao.acertoCredito} />
                <LinhaValor rotulo="Acerto de débito" valor={apuracao.acertoDebito} negativo />
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(apuracao.acertoCredito - apuracao.acertoDebito)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Memória de cálculo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" /> Memória de cálculo do valor líquido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LinhaValor rotulo="(+) VAF próprio" valor={apuracao.vafProprio} />
              <LinhaValor rotulo="(+) Crédito externo" valor={apuracao.creditoExterno} />
              <LinhaValor rotulo="(+) Crédito interno" valor={apuracao.creditoInterno} />
              <LinhaValor rotulo="(+) Crédito próprio" valor={apuracao.creditoProprio} />
              <LinhaValor rotulo="(−) Débito" valor={apuracao.debito} negativo />
              <LinhaValor rotulo="(+) Acerto de crédito" valor={apuracao.acertoCredito} />
              <LinhaValor rotulo="(−) Acerto de débito" valor={apuracao.acertoDebito} negativo />
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold">
                <span>= Valor líquido</span>
                <span className="font-mono">{formatarMoeda(apuracao.valorLiquido)}</span>
              </div>
              {conferencia && Math.abs(conferencia.diferenca) > 0.5 && (
                <p className="mt-2 text-xs text-destructive">
                  Divergência de {formatarMoeda(conferencia.diferenca)} entre a soma dos blocos e o
                  valor líquido informado no arquivo.
                </p>
              )}
              {conferencia && Math.abs(conferencia.diferenca) <= 0.5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Conferência dos blocos VAF A + B + C bate com o valor líquido do arquivo.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detalhamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="externos">
                <TabsList className="no-print">
                  <TabsTrigger value="externos">
                    Créditos externos ({apuracao.creditosExternos.length})
                  </TabsTrigger>
                  <TabsTrigger value="municipios">Entre municípios</TabsTrigger>
                  <TabsTrigger value="contribuintes">
                    VAF por contribuinte ({apuracao.contribuintesVaf.length})
                  </TabsTrigger>
                  <TabsTrigger value="simei">SIMEI ({apuracao.simei.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="externos" className="mt-4">
                  <TabelaContribuintes linhas={apuracao.creditosExternos} />
                </TabsContent>

                <TabsContent value="municipios" className="mt-4 space-y-6">
                  <TabelaMunicipios
                    titulo="Créditos recebidos de outros municípios"
                    linhas={apuracao.creditosPorMunicipio}
                    nomePorCodigo={nomePorCodigo}
                  />
                  <TabelaMunicipios
                    titulo="Débitos transferidos a outros municípios"
                    linhas={apuracao.debitosPorMunicipio}
                    nomePorCodigo={nomePorCodigo}
                  />
                </TabsContent>

                <TabsContent value="contribuintes" className="mt-4">
                  <TabelaContribuintes linhas={apuracao.contribuintesVaf.slice(0, 300)} />
                  {apuracao.contribuintesVaf.length > 300 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mostrando os 300 maiores. Use o CSV para a lista completa.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="simei" className="mt-4">
                  <TabelaContribuintes linhas={apuracao.simei} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            {config?.endereco_rodape || ""}
          </p>
        </div>
      )}

      {!apuracao && !carregando && !erro && (
        <Card className="no-print border-dashed">
          <CardContent className="py-14 text-center">
            <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Selecione o arquivo de índices (ex.: <span className="font-mono">P443RT…​.txt</span>)
              para apurar VAF A, VAF B, VAF C, valor líquido e índice.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
