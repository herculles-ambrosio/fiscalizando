import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, FileUp, HelpCircle, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMunicipioAtivo, useMunicipios } from "@/hooks/useMunicipio";
import { formatarCnpj, formatarMoeda } from "@/lib/format";
import { decodificarArquivo } from "@/lib/vaf/parser";
import { anoDoArquivo, remessaDoArquivo, rotuloMes } from "@/lib/vaf/tipoRetorno";
import { formatarIndice } from "@/lib/vaf/indice";
import {
  analisarArquivo,
  compararDeclarantes,
  compararMunicipios,
  csvEvolucao,
  linhasEvolucao,
  memoriaCalculo,
  rotuloOrigem,
  type ArquivoEvolucao,
  type LinhaEvolucao,
  type MovimentoDeclarante,
} from "@/lib/vaf/evolucao";

export const Route = createFileRoute("/_authenticated/evolucao")({
  head: () => ({
    meta: [
      { title: "Evolução do VAF — comparar competências" },
      {
        name: "description",
        content:
          "Compare dois arquivos de retorno da SEF-MG (mensal, provisório ou definitivo) e analise a evolução do VAF, do índice e dos declarantes.",
      },
      { property: "og:title", content: "Evolução do VAF" },
      {
        property: "og:description",
        content:
          "Quem deixou de declarar, quem entrou, variação do líquido, VAF A, VAF B, VAF C e memória de cálculo lado a lado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaEvolucao,
});

function rotuloArquivo(a: ArquivoEvolucao): string {
  const remessa = remessaDoArquivo(a.nome);
  const ano = anoDoArquivo(a.nome);
  const competencia = remessa ? `${rotuloMes(remessa)}${ano ? `/${ano}` : ""}` : (ano ?? "");
  return competencia ? String(competencia) : a.nome;
}

function formatarValor(valor: number, formato: LinhaEvolucao["formato"]): string {
  if (formato === "indice") return `${formatarIndice(valor)} %`;
  if (formato === "inteiro") return valor.toLocaleString("pt-BR");
  return formatarMoeda(valor);
}

function Variacao({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const zero = Math.abs(pct) < 0.005;
  const Icone = zero ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight;
  const cor = zero ? "text-muted-foreground" : pct > 0 ? "text-emerald-600" : "text-destructive";
  return (
    <span className={`inline-flex items-center justify-end gap-1 font-mono ${cor}`}>
      <Icone className="h-3.5 w-3.5" />
      {pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
    </span>
  );
}

function CaixaArquivo({
  titulo,
  descricao,
  arquivo,
  carregando,
  onSelecionar,
}: {
  titulo: string;
  descricao: string;
  arquivo: ArquivoEvolucao | null;
  carregando: boolean;
  onSelecionar: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={ref}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelecionar(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="w-full" disabled={carregando} onClick={() => ref.current?.click()}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {arquivo ? "Trocar arquivo" : "Selecionar arquivo de retorno"}
        </Button>
        {arquivo && (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
            <p className="truncate font-mono text-xs">{arquivo.nome}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{rotuloArquivo(arquivo)}</Badge>
              <Badge variant={arquivo.temIndiceFechado ? "default" : "outline"}>
                {arquivo.temIndiceFechado
                  ? arquivo.apuracao.tipoIndice === "definitivo"
                    ? "Índice definitivo"
                    : "Índice provisório"
                  : "Projeção (mensal)"}
              </Badge>
              <Badge variant="outline">{arquivo.declarantes.length} declarantes</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarcaCadastro({ d }: { d: MovimentoDeclarante }) {
  if (!d.cadastroIncompleto) return null;
  const faltas = [!d.nome ? "sem nome" : null, !d.cnpj ? "sem CNPJ" : null]
    .filter(Boolean)
    .join(" e ");
  const detalhe = [
    `Nome: ${d.nome ? rotuloOrigem(d.origemNome) : "não localizado em 01/11/35/40"}`,
    `CNPJ: ${d.cnpj ? rotuloOrigem(d.origemCnpj) : "não localizado em 10/11/35/40"}`,
  ].join(" · ");
  return (
    <Badge
      variant="outline"
      title={detalhe}
      className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
    >
      <AlertTriangle className="h-3 w-3" />
      {faltas}
    </Badge>
  );
}

function TabelaMovimentos({
  linhas,
  colunaBase,
  colunaAtual,
  vazio,
}: {
  linhas: MovimentoDeclarante[];
  colunaBase: string;
  colunaAtual: string;
  vazio: string;
}) {
  const [soIncompletos, setSoIncompletos] = useState(false);
  const incompletos = useMemo(() => linhas.filter((d) => d.cadastroIncompleto).length, [linhas]);
  const visiveis = soIncompletos ? linhas.filter((d) => d.cadastroIncompleto) : linhas;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Button
          size="sm"
          variant={soIncompletos ? "default" : "outline"}
          onClick={() => setSoIncompletos((v) => !v)}
          disabled={incompletos === 0}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Sem CNPJ ou sem nome
          <Badge variant="secondary" className="ml-1">
            {incompletos}
          </Badge>
        </Button>
        {soIncompletos && (
          <span className="text-xs text-muted-foreground">
            Exibindo apenas contribuintes cujo nome/CNPJ não foi localizado nos registros do arquivo.
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inscrição estadual</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Contribuinte</TableHead>
            <TableHead>Origem do cadastro</TableHead>
            <TableHead className="text-right">{colunaBase}</TableHead>
            <TableHead className="text-right">{colunaAtual}</TableHead>
            <TableHead className="text-right">Diferença</TableHead>
            <TableHead className="w-28 text-right">Variação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiveis.map((d) => (
            <TableRow key={d.inscricao_estadual} className={d.cadastroIncompleto ? "bg-amber-500/5" : undefined}>
              <TableCell className="font-mono text-xs">{d.inscricao_estadual}</TableCell>
              <TableCell className="font-mono text-xs">{formatarCnpj(d.cnpj)}</TableCell>
              <TableCell className="max-w-[20rem] truncate">{d.nome ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {d.cadastroIncompleto ? (
                  <MarcaCadastro d={d} />
                ) : (
                  <span title={`Nome: ${rotuloOrigem(d.origemNome)} · CNPJ: ${rotuloOrigem(d.origemCnpj)}`}>
                    {d.origemNome ?? "—"}/{d.origemCnpj ?? "—"}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{formatarMoeda(d.vafBase)}</TableCell>
              <TableCell className="text-right font-mono">{formatarMoeda(d.vafAtual)}</TableCell>
              <TableCell
                className={`text-right font-mono ${d.diferenca < 0 ? "text-destructive" : d.diferenca > 0 ? "text-emerald-600" : ""}`}
              >
                {formatarMoeda(d.diferenca)}
              </TableCell>
              <TableCell className="text-right">
                <Variacao pct={d.variacaoPct} />
              </TableCell>
            </TableRow>
          ))}
          {visiveis.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {soIncompletos ? "Nenhum contribuinte com cadastro incompleto." : vazio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}


function PaginaEvolucao() {
  const { municipio } = useMunicipioAtivo();
  const [base, setBase] = useState<ArquivoEvolucao | null>(null);
  const [atual, setAtual] = useState<ArquivoEvolucao | null>(null);
  const [carregando, setCarregando] = useState<"base" | "atual" | null>(null);
  const [vafReferencia, setVafReferencia] = useState("");

  async function carregar(file: File, alvo: "base" | "atual") {
    setCarregando(alvo);
    try {
      const texto = decodificarArquivo(await file.arrayBuffer());
      const referencia = Number(vafReferencia.replace(/\./g, "").replace(",", "."));
      const analise = analisarArquivo(
        file.name,
        texto,
        referencia > 0 ? { vafEstadualReferencia: referencia } : {},
      );
      if (alvo === "base") setBase(analise);
      else setAtual(analise);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(null);
    }
  }

  const indicadores = useMemo(
    () => (base && atual ? linhasEvolucao(base.apuracao, atual.apuracao) : []),
    [base, atual],
  );
  const declarantes = useMemo(
    () => (base && atual ? compararDeclarantes(base.declarantes, atual.declarantes) : null),
    [base, atual],
  );
  const creditosMunicipios = useMemo(
    () =>
      base && atual
        ? compararMunicipios(base.apuracao.creditosPorMunicipio, atual.apuracao.creditosPorMunicipio)
        : [],
    [base, atual],
  );
  const debitosMunicipios = useMemo(
    () =>
      base && atual
        ? compararMunicipios(base.apuracao.debitosPorMunicipio, atual.apuracao.debitosPorMunicipio)
        : [],
    [base, atual],
  );

  function baixarCsv() {
    if (!base || !atual || !declarantes) return;
    const csv = csvEvolucao(base.nome, atual.nome, indicadores, declarantes);
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `evolucao-vaf-${municipio?.nome ?? "municipio"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const perdaSaidas = declarantes?.sairam.reduce((s, d) => s + d.vafBase, 0) ?? 0;
  const ganhoEntradas = declarantes?.entraram.reduce((s, d) => s + d.vafAtual, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Evolução do VAF</h1>
        <p className="text-sm text-muted-foreground">
          Compare duas competências (mensal, índice provisório ou definitivo) e analise a evolução do
          líquido, dos componentes VAF A/B/C, das declarações e dos contribuintes declarantes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CaixaArquivo
          titulo="Arquivo base (competência anterior)"
          descricao="Ex.: índice definitivo do ano anterior."
          arquivo={base}
          carregando={carregando === "base"}
          onSelecionar={(f) => carregar(f, "base")}
        />
        <CaixaArquivo
          titulo="Arquivo atual (competência a comparar)"
          descricao="Ex.: retorno mensal, provisório ou definitivo do ano atual."
          arquivo={atual}
          carregando={carregando === "atual"}
          onSelecionar={(f) => carregar(f, "atual")}
        />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Parâmetro de projeção</CardTitle>
            <p className="text-xs text-muted-foreground">
              Usado apenas quando o arquivo não traz o VAF estadual (retornos mensais).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="vaf-ref" className="text-xs">
                VAF estadual de referência (R$)
              </Label>
              <Input
                id="vaf-ref"
                inputMode="decimal"
                placeholder="Ex.: 500000000000"
                value={vafReferencia}
                onChange={(e) => setVafReferencia(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              className="w-full"
              disabled={!base || !atual}
              onClick={baixarCsv}
            >
              <Download className="h-4 w-4" />
              Exportar comparativo (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>

      {(!base || !atual) && (
        <Alert>
          <AlertTitle>Selecione os dois arquivos</AlertTitle>
          <AlertDescription>
            Carregue o arquivo da competência anterior e o da competência atual para ver o
            comparativo completo.
          </AlertDescription>
        </Alert>
      )}

      {base && atual && declarantes && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Deixaram de declarar
                </p>
                <p className="font-display text-2xl font-semibold text-destructive">
                  {declarantes.sairam.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  VAF que saiu: {formatarMoeda(perdaSaidas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Novos declarantes
                </p>
                <p className="font-display text-2xl font-semibold text-emerald-600">
                  {declarantes.entraram.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  VAF que entrou: {formatarMoeda(ganhoEntradas)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground cursor-help">
                        Valor líquido do arquivo mensal comparado
                        <HelpCircle className="h-3 w-3" />
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1.5">
                        <p>
                          <strong>Valor líquido</strong> é o saldo apurado no arquivo atual.
                        </p>
                        <p>
                          Para arquivos com índice fechado (registro 16/17), o valor vem diretamente do arquivo da SEF-MG.
                        </p>
                        <p>
                          Para retornos mensais sem índice fechado, o sistema projeta: VAF próprio (soma dos registros 10 × fator de calibragem) + crédito externo (11/35) + crédito interno (12) − débito (13).
                        </p>
                        <p>
                          <strong>Diferença</strong> = atual − base. <strong>Variação %</strong> = (atual − base) ÷ |base| × 100.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <p className="break-words font-display text-lg font-semibold">
                  {formatarMoeda(atual.apuracao.valorLiquido)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Base: {formatarMoeda(base.apuracao.valorLiquido)}
                </p>
                <p className="text-xs">
                  <span className="mr-2">
                    Diferença: {formatarMoeda(
                      (indicadores.find((l) => l.chave === "valorLiquido")?.atual ?? 0) -
                      (indicadores.find((l) => l.chave === "valorLiquido")?.base ?? 0)
                    )}
                  </span>
                  <Variacao
                    pct={
                      indicadores.find((l) => l.chave === "valorLiquido")?.variacaoPct ?? null
                    }
                  />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Valor líquido
                </p>
                <p className="break-words font-display text-lg font-semibold">
                  {formatarMoeda(atual.apuracao.valorLiquido)}
                </p>
                <p className="text-xs">
                  <Variacao
                    pct={
                      indicadores.find((l) => l.chave === "valorLiquido")?.variacaoPct ?? null
                    }
                  />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Índice de participação
                </p>
                <p className="break-words font-display text-lg font-semibold text-primary">
                  {formatarIndice(atual.apuracao.indice)}%
                </p>
                <p className="text-xs">
                  <Variacao pct={indicadores.find((l) => l.chave === "indice")?.variacaoPct ?? null} />
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="indicadores">
            <TabsList className="flex-wrap">
              <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
              <TabsTrigger value="memoria">Memória de cálculo</TabsTrigger>
              <TabsTrigger value="sairam">Deixaram de declarar ({declarantes.sairam.length})</TabsTrigger>
              <TabsTrigger value="entraram">Novos ({declarantes.entraram.length})</TabsTrigger>
              <TabsTrigger value="variacao">Variação por contribuinte</TabsTrigger>
              <TabsTrigger value="municipios">Municípios</TabsTrigger>
            </TabsList>

            <TabsContent value="indicadores">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead className="text-right">{rotuloArquivo(base)}</TableHead>
                        <TableHead className="text-right">{rotuloArquivo(atual)}</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                        <TableHead className="w-32 text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indicadores.map((l) => (
                        <TableRow key={l.chave}>
                          <TableCell>{l.rotulo}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarValor(l.base, l.formato)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarValor(l.atual, l.formato)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${l.diferenca < 0 ? "text-destructive" : l.diferenca > 0 ? "text-emerald-600" : ""}`}
                          >
                            {formatarValor(l.diferenca, l.formato)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Variacao pct={l.variacaoPct} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="memoria">
              <div className="grid gap-4 lg:grid-cols-2">
                {[base, atual].map((arq, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {i === 0 ? "Base" : "Atual"} · {rotuloArquivo(arq)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {arq.temIndiceFechado
                          ? "Valores do registro de índice fechado pela SEF-MG."
                          : "Projeção a partir dos registros 10/11/12/13/35/40."}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {memoriaCalculo(arq.apuracao).map((m) => (
                        <div
                          key={m.rotulo}
                          className={`flex items-baseline justify-between gap-3 border-b border-dashed border-border py-2 last:border-0 ${m.operador === "=" ? "font-semibold" : ""}`}
                        >
                          <span className="text-sm text-muted-foreground">
                            <span className="mr-2 font-mono">{m.operador || " "}</span>
                            {m.rotulo}
                          </span>
                          <span className="font-mono text-sm">{formatarMoeda(m.valor)}</span>
                        </div>
                      ))}
                      <div className="flex items-baseline justify-between gap-3 pt-2 text-sm">
                        <span className="text-muted-foreground">
                          Índice = líquido ÷ VAF estadual × 100
                        </span>
                        <span className="font-mono font-semibold text-primary">
                          {formatarIndice(arq.apuracao.indice)}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                        <span>Declarações no arquivo</span>
                        <span className="font-mono">
                          {arq.apuracao.totalDeclaracoes.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="sairam">
              <Card>
                <CardContent className="p-0">
                  <TabelaMovimentos
                    linhas={declarantes.sairam}
                    colunaBase="VAF anterior"
                    colunaAtual="VAF atual"
                    vazio="Todos os contribuintes da competência base declararam também na atual."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entraram">
              <Card>
                <CardContent className="p-0">
                  <TabelaMovimentos
                    linhas={declarantes.entraram}
                    colunaBase="VAF anterior"
                    colunaAtual="VAF atual"
                    vazio="Nenhum declarante novo nesta competência."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="variacao">
              <Card>
                <CardContent className="p-0">
                  <TabelaMovimentos
                    linhas={declarantes.todos.slice(0, 300)}
                    colunaBase="VAF anterior"
                    colunaAtual="VAF atual"
                    vazio="Sem contribuintes para comparar."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="municipios">
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  { titulo: "Créditos por município (registro 12)", linhas: creditosMunicipios },
                  { titulo: "Débitos por município (registro 13)", linhas: debitosMunicipios },
                ].map((bloco) => (
                  <Card key={bloco.titulo}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{bloco.titulo}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-20">Código</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">Atual</TableHead>
                            <TableHead className="text-right">Diferença</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bloco.linhas.slice(0, 100).map((m) => (
                            <TableRow key={m.codigo}>
                              <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatarMoeda(m.base)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatarMoeda(m.atual)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono ${m.diferenca < 0 ? "text-destructive" : m.diferenca > 0 ? "text-emerald-600" : ""}`}
                              >
                                {formatarMoeda(m.diferenca)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {bloco.linhas.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                Nenhum registro.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
