import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, FileUp, FolderOpen, HelpCircle, Loader2, Minus, Save, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMunicipioAtivo, useMunicipios } from "@/hooks/useMunicipio";
import {
  useEvolucoesSalvas,
  useExcluirEvolucao,
  useSalvarEvolucao,
} from "@/hooks/useEvolucoesSalvas";
import { formatarCnpj, formatarMoeda } from "@/lib/format";
import { decodificarArquivo } from "@/lib/vaf/parser";
import { anoDoArquivo, codigoMunicipioDoArquivo, remessaDoArquivo, rotuloMes } from "@/lib/vaf/tipoRetorno";
import { detectarMunicipioRetorno, normalizarCodigoSef } from "@/lib/vaf/municipioArquivo";
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

/** Rótulo padronizado dos cards de KPI: "TÍTULO - QUALIFICADOR" + tooltip explicativo. */
function RotuloKpi({ titulo, ajuda }: { titulo: string; ajuda: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="flex cursor-help items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            {titulo}
            <HelpCircle className="h-3 w-3" />
          </p>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">{ajuda}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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


type ArquivoPendente = {
  file: File;
  alvo: "base" | "atual";
  codigo: string;
  nome: string | null;
  destinoId: string | null;
  destinoNome: string | null;
};

function BannerBloqueio({
  bloqueio,
  municipioAtivo,
  onResolver,
}: {
  bloqueio: ArquivoPendente;
  municipioAtivo: { nome?: string | null } | null | undefined;
  onResolver: () => void;
}) {
  const nomeDestino = bloqueio.destinoNome ?? bloqueio.nome ?? `código ${bloqueio.codigo}`;
  const podeResolver = bloqueio.destinoId;
  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <AlertTitle className="text-sm">Arquivo de outra prefeitura — carga bloqueada</AlertTitle>
          <AlertDescription className="text-xs">
            O arquivo <span className="font-mono font-medium">{bloqueio.file.name}</span> pertence à
            prefeitura <strong>{nomeDestino}</strong> (código {bloqueio.codigo}), mas a prefeitura ativa
            é <strong>{municipioAtivo?.nome ?? "—"}</strong>. Para evitar comparar dados de municípios
            diferentes, a carga só é liberada quando o arquivo for da prefeitura ativa.
          </AlertDescription>
        </div>
        {podeResolver ? (
          <Button size="sm" variant="outline" className="mt-2 shrink-0 sm:mt-0" onClick={onResolver}>
            Trocar para {nomeDestino} e analisar
          </Button>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground sm:mt-0 sm:max-w-[40%]">
            Prefeitura não cadastrada ou indisponível para o seu usuário. Selecione um arquivo da
            prefeitura ativa.
          </p>
        )}
      </div>
    </Alert>
  );
}

export default function PaginaEvolucao() {
  const { municipio, municipios: municipiosPermitidos, podeTrocar, trocar } = useMunicipioAtivo();
  const { data: municipios } = useMunicipios();
  const [base, setBase] = useState<ArquivoEvolucao | null>(null);
  const [atual, setAtual] = useState<ArquivoEvolucao | null>(null);
  const [carregando, setCarregando] = useState<"base" | "atual" | null>(null);
  const [vafReferencia, setVafReferencia] = useState("");
  const [nomeGravar, setNomeGravar] = useState("");
  const [pendente, setPendente] = useState<ArquivoPendente | null>(null);
  const { data: salvas } = useEvolucoesSalvas(municipio?.id ?? null);
  const salvarEvolucao = useSalvarEvolucao();
  const excluirEvolucao = useExcluirEvolucao(municipio?.id ?? null);

  const mapaMunicipiosPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of municipios ?? []) {
      if (m.codigo_sef) mapa.set(m.codigo_sef, m.nome);
    }
    return mapa;
  }, [municipios]);

  async function carregar(file: File, alvo: "base" | "atual", forcar = false) {
    setCarregando(alvo);
    try {
      const texto = decodificarArquivo(await file.arrayBuffer());

      // Consistência: o arquivo precisa ser da prefeitura ativa.
      const codigoArquivo =
        detectarMunicipioRetorno(texto).codigo ??
        normalizarCodigoSef(codigoMunicipioDoArquivo(file.name));
      const codigoAtivo = normalizarCodigoSef(municipio?.codigo_sef);
      if (!forcar && codigoArquivo && codigoAtivo && codigoArquivo !== codigoAtivo) {
        const destino =
          municipiosPermitidos.find(
            (m) => normalizarCodigoSef(m.codigo_sef) === codigoArquivo,
          ) ?? null;
        setPendente({
          file,
          alvo,
          codigo: codigoArquivo,
          nome: detectarMunicipioRetorno(texto).nome ?? mapaMunicipiosPorCodigo.get(codigoArquivo) ?? null,
          destinoId: destino?.id ?? null,
          destinoNome: destino?.nome ?? null,
        });
        return;
      }

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

  async function confirmarTroca() {
    if (!pendente?.destinoId) return;
    const { file, alvo, destinoId, destinoNome } = pendente;
    setPendente(null);
    trocar(destinoId);
    toast.success(`Prefeitura ativa alterada para ${destinoNome}.`);
    // limpa a comparação anterior: os arquivos eram de outra prefeitura
    setBase(null);
    setAtual(null);
    await carregar(file, alvo, true);
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
        ? compararMunicipios(
            base.apuracao.creditosPorMunicipio.map((m) => ({
              ...m,
              nome: mapaMunicipiosPorCodigo.get(m.codigo),
            })),
            atual.apuracao.creditosPorMunicipio.map((m) => ({
              ...m,
              nome: mapaMunicipiosPorCodigo.get(m.codigo),
            })),
          )
        : [],
    [base, atual, mapaMunicipiosPorCodigo],
  );
  const debitosMunicipios = useMemo(
    () =>
      base && atual
        ? compararMunicipios(
            base.apuracao.debitosPorMunicipio.map((m) => ({
              ...m,
              nome: mapaMunicipiosPorCodigo.get(m.codigo),
            })),
            atual.apuracao.debitosPorMunicipio.map((m) => ({
              ...m,
              nome: mapaMunicipiosPorCodigo.get(m.codigo),
            })),
          )
        : [],
    [base, atual, mapaMunicipiosPorCodigo],
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Evoluções gravadas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Grave o comparativo atual para recarregá-lo depois sem precisar dos arquivos.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nome da análise (ex.: Definitivo 2024 x Mensal 07/2025)"
              value={nomeGravar}
              onChange={(e) => setNomeGravar(e.target.value)}
            />
            <Button
              disabled={!base || !atual || !municipio || salvarEvolucao.isPending}
              onClick={() => {
                if (!base || !atual || !municipio) return;
                const nome =
                  nomeGravar.trim() || `${rotuloArquivo(base)} x ${rotuloArquivo(atual)}`;
                salvarEvolucao.mutate(
                  { municipioId: municipio.id, nome, vafReferencia, base, atual },
                  {
                    onSuccess: () => {
                      setNomeGravar("");
                      toast.success("Evolução gravada.");
                    },
                    onError: (e) =>
                      toast.error(e instanceof Error ? e.message : "Não foi possível gravar."),
                  },
                );
              }}
            >
              {salvarEvolucao.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Gravar evolução
            </Button>
          </div>

          {(salvas?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma evolução gravada ainda.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {salvas!.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.nome}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {s.arquivo_base_nome} → {s.arquivo_atual_nome} ·{" "}
                      {new Date(s.criado_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBase(s.base);
                        setAtual(s.atual);
                        setVafReferencia(s.vaf_referencia ?? "");
                        toast.success("Evolução carregada.");
                      }}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Carregar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => excluirEvolucao.mutate(s.id)}
                      disabled={excluirEvolucao.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                <RotuloKpi
                  titulo="Declarantes - deixaram de declarar"
                  ajuda={
                    <>
                      <p>
                        Contribuintes com <strong>declaração no arquivo base</strong> (
                        {rotuloArquivo(base)}) e <strong>sem declaração</strong> no arquivo
                        comparado/estimado ({rotuloArquivo(atual)}).
                      </p>
                      <p>
                        <strong>VAF que saiu</strong> = soma do VAF que esses contribuintes tinham
                        na base.
                      </p>
                    </>
                  }
                />
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
                <RotuloKpi
                  titulo="Declarantes - novos"
                  ajuda={
                    <>
                      <p>
                        Contribuintes presentes apenas no arquivo comparado/estimado (
                        {rotuloArquivo(atual)}), sem declaração no arquivo base (
                        {rotuloArquivo(base)}).
                      </p>
                      <p>
                        <strong>VAF que entrou</strong> = soma do VAF declarado por eles no arquivo
                        comparado/estimado.
                      </p>
                    </>
                  }
                />
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
                <RotuloKpi
                  titulo="Valor líquido - base"
                  ajuda={
                    <>
                      <p>
                        <strong>Valor líquido</strong> é o saldo apurado no arquivo base (
                        {rotuloArquivo(base)}).
                      </p>
                      <p>
                        Para arquivos com índice fechado (registro 16/17), o valor vem diretamente
                        do arquivo da SEF-MG.
                      </p>
                      <p>
                        Para retornos mensais sem índice fechado, o sistema projeta: VAF próprio
                        (soma dos registros 10 × fator de calibragem) + crédito externo (11/35) +
                        crédito interno (12) − débito (13).
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold">
                  {formatarMoeda(base.apuracao.valorLiquido)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivo: {rotuloArquivo(base)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo="Valor líquido - comparado/estimado"
                  ajuda={
                    <>
                      <p>
                        <strong>Valor líquido</strong> do arquivo comparado/estimado (
                        {rotuloArquivo(atual)}).
                      </p>
                      <p>
                        Índice fechado (registro 16/17): valor da SEF-MG. Retorno mensal: projeção
                        VAF próprio (registros 10 × fator de calibragem) + crédito externo (11/35) +
                        crédito interno (12) − débito (13).
                      </p>
                      <p>
                        <strong>Diferença</strong> = comparado/estimado − base.{" "}
                        <strong>Variação %</strong> = (comparado/estimado − base) ÷ |base| × 100.
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold">
                  {formatarMoeda(atual.apuracao.valorLiquido)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Arquivo: {rotuloArquivo(atual)}
                </p>
                <p className="text-xs">
                  <span className="mr-2">
                    Diferença: {formatarMoeda(
                      atual.apuracao.valorLiquido - base.apuracao.valorLiquido
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
                <RotuloKpi
                  titulo="Índice de participação - comparado/estimado"
                  ajuda={
                    <>
                      <p>
                        Participação do município no VAF estadual apurada no arquivo
                        comparado/estimado ({rotuloArquivo(atual)}).
                      </p>
                      <p>
                        <strong>Índice</strong> = valor líquido do município ÷ VAF estadual × 100.
                        Em retornos mensais o resultado é uma projeção, não o índice oficial.
                      </p>
                      <p>
                        <strong>Variação %</strong> comparada ao índice do arquivo base (
                        {rotuloArquivo(base)}).
                      </p>
                    </>
                  }
                />
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
                            <TableHead>Município</TableHead>
                            <TableHead className="text-right">Base</TableHead>
                            <TableHead className="text-right">Atual</TableHead>
                            <TableHead className="text-right">Diferença</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bloco.linhas.slice(0, 100).map((m) => (
                            <TableRow key={m.codigo}>
                              <TableCell className="font-mono text-xs">{m.codigo}</TableCell>
                              <TableCell className="max-w-[12rem] truncate text-sm">
                                {m.nome ?? (
                                  <span className="text-muted-foreground italic">Não cadastrado</span>
                                )}
                              </TableCell>
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
                              <TableCell colSpan={5} className="text-center text-muted-foreground">
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
      <AlertDialog open={!!pendente} onOpenChange={(o) => !o && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivo de outra prefeitura</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  O arquivo <span className="font-mono">{pendente?.file.name}</span> é da prefeitura{" "}
                  <strong>
                    {pendente?.destinoNome ?? pendente?.nome ?? `código ${pendente?.codigo}`}
                  </strong>{" "}
                  (código {pendente?.codigo}), mas a prefeitura ativa é{" "}
                  <strong>{municipio?.nome ?? "—"}</strong>.
                </p>
                {pendente?.destinoId ? (
                  podeTrocar ? (
                    <p>
                      Deseja trocar a prefeitura ativa para{" "}
                      <strong>{pendente.destinoNome}</strong> e carregar este arquivo? A comparação
                      atual será limpa.
                    </p>
                  ) : (
                    <p>
                      Você não tem permissão para trocar de prefeitura. Só é possível carregar
                      arquivos da prefeitura ativa.
                    </p>
                  )
                ) : (
                  <p>
                    Essa prefeitura não está cadastrada ou não está disponível para o seu usuário.
                    Só é possível carregar arquivos da prefeitura ativa.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {pendente?.destinoId && podeTrocar && (
              <AlertDialogAction onClick={confirmarTroca}>
                Trocar para {pendente.destinoNome} e analisar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
