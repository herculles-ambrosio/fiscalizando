import { useEffect, useMemo, useRef, useState } from "react";
import { NotaRemessa } from "@/components/NotaRemessa";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileUp,
  FolderOpen,
  HelpCircle,
  Loader2,
  Minus,
  Save,
  Trash2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMunicipioAtivo, useMunicipios } from "@/hooks/useMunicipio";
import {
  useEvolucoesSalvas,
  useExcluirEvolucao,
  useSalvarEvolucao,
} from "@/hooks/useEvolucoesSalvas";
import { formatarCnpj, formatarMoeda, formatarValorGrid } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { decodificarArquivo } from "@/lib/vaf/parser";
import {
  anoDoArquivo,
  codigoMunicipioDoArquivo,
  remessaDoArquivo,
  rotuloRemessa,
} from "@/lib/vaf/tipoRetorno";
import { detectarMunicipioRetorno, normalizarCodigoSef } from "@/lib/vaf/municipioArquivo";
import { nomeMunicipioSef } from "@/lib/vaf/municipiosSef";
import { formatarIndice } from "@/lib/vaf/indice";
import {
  analisarArquivo,
  aplicarCreditoProprio,
  faltaCreditoProprio,
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
import { diagnosticarEvolucao, textoDiagnostico } from "@/lib/vaf/diagnostico";
import DiagnosticoVariacao from "@/components/analises/DiagnosticoVariacao";
import PlanoRecuperacao from "@/components/analises/PlanoRecuperacao";
import { montarPlanoRecuperacao, textoPlanoRecuperacao } from "@/lib/vaf/recuperacao";
import { useSituacoesCadastrais } from "@/hooks/useSituacoesCadastrais";
import CreditoProprioPortal from "@/components/analises/CreditoProprioPortal";
import { type ResumoCreditoPortal } from "@/lib/vaf/creditoPortal";
import OutrasReceitas from "@/components/analises/OutrasReceitas";
import ImpactoContribuintes from "@/components/analises/ImpactoContribuintes";
import {
  useIndiceDaResolucao,
  useResolucoesSef,
  type ResolucaoSef,
} from "@/hooks/useResolucoesSef";

function rotuloArquivo(
  a: ArquivoEvolucao,
  anoApuracao?: number | null,
  anoAplicacao?: number | null,
): string {
  const remessa = remessaDoArquivo(a.nome);
  const rotulo = remessa ? rotuloRemessa(remessa) : "";
  const arquivo = rotulo ? String(rotulo) : a.nome;
  const referencias = [
    anoApuracao ? `apuração ${anoApuracao}` : null,
    anoAplicacao ? `aplicação ${anoAplicacao}` : null,
  ].filter(Boolean);
  return referencias.length > 0 ? `${arquivo} · ${referencias.join(" · ")}` : arquivo;
}

function sugerirAnoApuracao(a: ArquivoEvolucao | null): number | null {
  if (!a) return null;
  return a.anoApuracao ?? anoDoArquivo(a.nome) ?? a.apuracao.anoBase ?? null;
}

function sugerirAnoAplicacao(a: ArquivoEvolucao | null): number | null {
  if (!a) return null;
  if (a.anoAplicacao) return a.anoAplicacao;
  const anoMovimento = sugerirAnoApuracao(a);
  return anoMovimento ? anoMovimento + 1 : null;
}

function formatarValor(valor: number, formato: LinhaEvolucao["formato"]): string {
  if (formato === "indice") return `${formatarIndice(valor)} %`;
  if (formato === "inteiro") return valor.toLocaleString("pt-BR");
  return formatarValorGrid(valor);
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
  anoApuracao,
  anoAplicacao,
  anosDisponiveis,
  onAnoApuracao,
  onAnoAplicacao,
  resolucoes,
  resolucaoNumero,
  onResolucao,
}: {
  titulo: string;
  descricao: string;
  arquivo: ArquivoEvolucao | null;
  carregando: boolean;
  onSelecionar: (f: File) => void;
  anoApuracao: number | null;
  anoAplicacao: number | null;
  anosDisponiveis: number[];
  onAnoApuracao: (ano: number) => void;
  onAnoAplicacao: (ano: number) => void;
  resolucoes?: ResolucaoSef[];
  resolucaoNumero?: string | null;
  onResolucao?: (numero: string | null) => void;
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
        <Button
          variant="outline"
          className="w-full"
          disabled={carregando}
          onClick={() => ref.current?.click()}
        >
          {carregando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {arquivo ? "Trocar arquivo" : "Selecionar arquivo de retorno"}
        </Button>
        {arquivo && (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
            <p className="truncate font-mono text-xs">{arquivo.nome}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{rotuloArquivo(arquivo, anoApuracao, anoAplicacao)}</Badge>
              <Badge variant={arquivo.temIndiceFechado ? "default" : "outline"}>
                {arquivo.temIndiceFechado
                  ? arquivo.apuracao.tipoIndice === "definitivo"
                    ? "Índice definitivo"
                    : "Índice provisório"
                  : "Projeção (mensal)"}
              </Badge>
              <Badge variant="outline">{arquivo.declarantes.length} declarantes</Badge>
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Ano de Apuração</Label>
                <Select
                  value={anoApuracao ? String(anoApuracao) : ""}
                  onValueChange={(valor) => onAnoApuracao(Number(valor))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((ano) => (
                      <SelectItem key={ano} value={String(ano)}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ano de Aplicação</Label>
                <Select
                  value={anoAplicacao ? String(anoAplicacao) : ""}
                  onValueChange={(valor) => onAnoAplicacao(Number(valor))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map((ano) => (
                      <SelectItem key={ano} value={String(ano)}>
                        {ano}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {onResolucao && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Resolução de referência</Label>
                <Select
                  value={resolucaoNumero ?? "nenhuma"}
                  onValueChange={(v) => onResolucao(v === "nenhuma" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem resolução" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Sem resolução</SelectItem>
                    {(resolucoes ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.numero}>
                        Resolução {r.numero} · apuração {r.ano_apuracao} · aplicação{" "}
                        {r.ano_aplicacao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  A média publicada nessa resolução vira a média base da comparação.
                </p>
              </div>
            )}
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
  nomeArquivo,
  ocultarOrigem = false,
  porPagina,
}: {
  linhas: MovimentoDeclarante[];
  colunaBase: string;
  colunaAtual: string;
  vazio: string;
  nomeArquivo: string;
  /** Esconde a coluna "Origem do cadastro" (a exportação continua trazendo o dado). */
  ocultarOrigem?: boolean;
  /** Quando informado, pagina a tabela com navegação página a página. */
  porPagina?: number;
}) {
  const [soIncompletos, setSoIncompletos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const incompletos = useMemo(() => linhas.filter((d) => d.cadastroIncompleto).length, [linhas]);
  const visiveis = soIncompletos ? linhas.filter((d) => d.cadastroIncompleto) : linhas;

  const totalPaginas = porPagina ? Math.max(1, Math.ceil(visiveis.length / porPagina)) : 1;
  const paginaAtual = Math.min(pagina, totalPaginas);
  const naTela = porPagina
    ? visiveis.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina)
    : visiveis;

  useEffect(() => {
    setPagina(1);
  }, [linhas, soIncompletos]);

  const colunas = ocultarOrigem ? 7 : 8;

  // exporta exatamente as linhas visíveis (mesmo filtro da tabela, todas as páginas)
  function exportar() {
    baixarCsv(
      nomeArquivo,
      montarCsv(
        [
          "Inscrição estadual",
          "CNPJ",
          "Contribuinte",
          "Origem do cadastro",
          colunaBase,
          colunaAtual,
          "Diferença",
          "Variação (%)",
        ],
        visiveis.map((d) => [
          d.inscricao_estadual,
          d.cnpj ?? "",
          d.nome ?? "",
          d.cadastroIncompleto
            ? "Cadastro incompleto"
            : `${d.origemNome ?? "—"}/${d.origemCnpj ?? "—"}`,
          d.vafBase,
          d.vafAtual,
          d.diferenca,
          d.variacaoPct ?? "",
        ]),
      ),
    );
  }

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
        <Button
          size="sm"
          variant="outline"
          onClick={exportar}
          disabled={visiveis.length === 0}
          className="ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Exportar visíveis ({visiveis.length})
        </Button>
        {soIncompletos && (
          <span className="w-full text-xs text-muted-foreground">
            Exibindo apenas contribuintes cujo nome/CNPJ não foi localizado nos registros do
            arquivo.
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Inscrição estadual</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Contribuinte</TableHead>
            {!ocultarOrigem && <TableHead>Origem do cadastro</TableHead>}
            <TableHead className="text-right">{colunaBase} (R$)</TableHead>
            <TableHead className="text-right">{colunaAtual} (R$)</TableHead>
            <TableHead className="text-right">Diferença (R$)</TableHead>
            <TableHead className="w-24 text-right">Variação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {naTela.map((d) => (
            <TableRow
              key={d.inscricao_estadual}
              className={d.cadastroIncompleto ? "bg-amber-500/5" : undefined}
            >
              <TableCell className="font-mono">{d.inscricao_estadual}</TableCell>
              <TableCell className="font-mono">{formatarCnpj(d.cnpj)}</TableCell>
              <TableCell className="max-w-[20rem] truncate">{d.nome ?? "—"}</TableCell>
              {!ocultarOrigem && (
                <TableCell className="text-muted-foreground">
                  {d.cadastroIncompleto ? (
                    <MarcaCadastro d={d} />
                  ) : (
                    <span
                      title={`Nome: ${rotuloOrigem(d.origemNome)} · CNPJ: ${rotuloOrigem(d.origemCnpj)}`}
                    >
                      {d.origemNome ?? "—"}/{d.origemCnpj ?? "—"}
                    </span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right font-mono">{formatarValorGrid(d.vafBase)}</TableCell>
              <TableCell className="text-right font-mono">
                {formatarValorGrid(d.vafAtual)}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${d.diferenca < 0 ? "text-destructive" : d.diferenca > 0 ? "text-emerald-600" : ""}`}
              >
                {formatarValorGrid(d.diferenca)}
              </TableCell>
              <TableCell className="text-right">
                <Variacao pct={d.variacaoPct} />
              </TableCell>
            </TableRow>
          ))}
          {visiveis.length === 0 && (
            <TableRow>
              <TableCell colSpan={colunas} className="text-center text-muted-foreground">
                {soIncompletos ? "Nenhum contribuinte com cadastro incompleto." : vazio}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {porPagina && visiveis.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3 text-xs text-muted-foreground">
          <span>
            Mostrando {(paginaAtual - 1) * porPagina + 1}–
            {Math.min(paginaAtual * porPagina, visiveis.length)} de {visiveis.length} contribuintes
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagina(1)}
              disabled={paginaAtual === 1}
            >
              Primeira
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagina((p) => Math.max(1, Math.min(p, totalPaginas) - 1))}
              disabled={paginaAtual === 1}
            >
              Anterior
            </Button>
            <span className="tabular-nums">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setPagina((p) => Math.min(totalPaginas, Math.min(p, totalPaginas) + 1))
              }
              disabled={paginaAtual === totalPaginas}
            >
              Próxima
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPagina(totalPaginas)}
              disabled={paginaAtual === totalPaginas}
            >
              Última
            </Button>
          </div>
        </div>
      )}
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
            prefeitura <strong>{nomeDestino}</strong> (código {bloqueio.codigo}), mas a prefeitura
            ativa é <strong>{municipioAtivo?.nome ?? "—"}</strong>. Para evitar comparar dados de
            municípios diferentes, a carga só é liberada quando o arquivo for da prefeitura ativa.
          </AlertDescription>
        </div>
        {podeResolver ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 shrink-0 sm:mt-0"
            onClick={onResolver}
          >
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

export default function EvolucaoView() {
  // "Nova análise" limpa a tela remontando o painel do zero
  const [resetKey, setResetKey] = useState(0);
  return <PaginaEvolucao key={resetKey} onNovaAnalise={() => setResetKey((k) => k + 1)} />;
}

function PaginaEvolucao({ onNovaAnalise }: { onNovaAnalise: () => void }) {
  const { municipio, municipios: municipiosPermitidos, podeTrocar, trocar } = useMunicipioAtivo();
  const { data: municipios } = useMunicipios();
  const [baseArq, setBase] = useState<ArquivoEvolucao | null>(null);
  const [atualArq, setAtual] = useState<ArquivoEvolucao | null>(null);
  const [anoApuracaoBase, setAnoApuracaoBase] = useState<number | null>(null);
  const [anoApuracaoAtual, setAnoApuracaoAtual] = useState<number | null>(null);
  const [anoAplicacaoBase, setAnoAplicacaoBase] = useState<number | null>(null);
  const [anoAplicacaoAtual, setAnoAplicacaoAtual] = useState<number | null>(null);
  const [resolucaoBase, setResolucaoBase] = useState<string | null>(null);
  const { data: resolucoesSef = [] } = useResolucoesSef();
  const [planilha, setPlanilha] = useState<ResumoCreditoPortal | null>(null);
  const [perguntarPlanilha, setPerguntarPlanilha] = useState(false);
  const base = useMemo(
    () =>
      baseArq && planilha
        ? aplicarCreditoProprio(baseArq, planilha.creditoProprio, planilha.arquivoNome)
        : baseArq,
    [baseArq, planilha],
  );
  const atual = useMemo(
    () =>
      atualArq && planilha
        ? aplicarCreditoProprio(atualArq, planilha.creditoProprio, planilha.arquivoNome)
        : atualArq,
    [atualArq, planilha],
  );
  const faltaCredito = faltaCreditoProprio(baseArq) || faltaCreditoProprio(atualArq);
  const arquivoSemCredito = faltaCreditoProprio(atualArq) ? atualArq?.nome : baseArq?.nome;
  useEffect(() => {
    if (faltaCredito && !planilha) setPerguntarPlanilha(true);
  }, [faltaCredito, planilha]);

  const [carregando, setCarregando] = useState<"base" | "atual" | null>(null);
  const [vafReferencia, setVafReferencia] = useState("");
  const [nomeGravar, setNomeGravar] = useState("");
  const [pendente, setPendente] = useState<ArquivoPendente | null>(null);
  const [bloqueio, setBloqueio] = useState<ArquivoPendente | null>(null);
  const { data: salvas } = useEvolucoesSalvas(municipio?.id ?? null);
  const { data: situacoesCadastrais } = useSituacoesCadastrais(municipio?.id ?? null);
  const salvarEvolucao = useSalvarEvolucao();
  const excluirEvolucao = useExcluirEvolucao(municipio?.id ?? null);

  // Prefeituras cadastradas têm prioridade; o restante vem da tabela oficial da SEF-MG.
  const mapaMunicipiosPorCodigo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of municipios ?? []) {
      const cod = normalizarCodigoSef(m.codigo_sef);
      if (cod) mapa.set(cod, m.nome);
    }
    return {
      get: (codigo: string) =>
        mapa.get(normalizarCodigoSef(codigo) ?? codigo) ?? nomeMunicipioSef(codigo) ?? undefined,
    };
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
          municipiosPermitidos.find((m) => normalizarCodigoSef(m.codigo_sef) === codigoArquivo) ??
          null;
        const estado = {
          file,
          alvo,
          codigo: codigoArquivo,
          nome:
            detectarMunicipioRetorno(texto).nome ??
            mapaMunicipiosPorCodigo.get(codigoArquivo) ??
            null,
          destinoId: destino?.id ?? null,
          destinoNome: destino?.nome ?? null,
        };
        setPendente(estado);
        setBloqueio(estado);
        return;
      }

      const referencia = Number(vafReferencia.replace(/\./g, "").replace(",", "."));
      const analise = analisarArquivo(
        file.name,
        texto,
        referencia > 0 ? { vafEstadualReferencia: referencia } : {},
      );
      if (alvo === "base") {
        setBase(analise);
        setAnoApuracaoBase(sugerirAnoApuracao(analise));
        setAnoAplicacaoBase(sugerirAnoAplicacao(analise));
      } else {
        setAtual(analise);
        setAnoApuracaoAtual(sugerirAnoApuracao(analise));
        setAnoAplicacaoAtual(sugerirAnoAplicacao(analise));
      }
      // Índice definitivo/provisório já traz o VAF estadual: o parâmetro de
      // projeção segue sempre o ARQUIVO ATUAL (exercício em análise).
      const estadualArquivo =
        analise.apuracao.origemVafEstadual === "arquivo" ? analise.apuracao.vafEstadual : 0;
      if (alvo === "atual" && estadualArquivo > 0) {
        setVafReferencia(estadualArquivo.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
      }

      // Limpa bloqueio quando um arquivo da prefeitura ativa é carregado com sucesso.
      setBloqueio(null);
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
    setBloqueio(null);
    trocar(destinoId);
    toast.success(`Prefeitura ativa alterada para ${destinoNome}.`);
    // limpa a comparação anterior: os arquivos eram de outra prefeitura
    setBase(null);
    setAtual(null);
    setAnoApuracaoBase(null);
    setAnoApuracaoAtual(null);
    setAnoAplicacaoBase(null);
    setAnoAplicacaoAtual(null);
    await carregar(file, alvo, true);
  }

  // ---- Filtros do relatório (município e exercício usados nas exportações) ----
  const [municipioRelatorioId, setMunicipioRelatorioId] = useState<string>("");
  const [exercicioRelatorio, setExercicioRelatorio] = useState<string>("");

  useEffect(() => {
    if (municipio?.id) setMunicipioRelatorioId(municipio.id);
  }, [municipio?.id]);

  // O exercício dos documentos acompanha o ano de aplicação escolhido para o
  // arquivo comparado. O ano interno do arquivo permanece apenas como fallback.
  const anoDosArquivos = atualArq?.apuracao.anoBase ?? baseArq?.apuracao.anoBase ?? null;
  useEffect(() => {
    if (anoAplicacaoAtual) setExercicioRelatorio(String(anoAplicacaoAtual));
    else if (anoDosArquivos) setExercicioRelatorio(String(anoDosArquivos));
  }, [anoAplicacaoAtual, anoDosArquivos]);

  const municipioRelatorio =
    municipiosPermitidos.find((m) => m.id === municipioRelatorioId) ?? municipio ?? null;
  const exercicioSelecionado = Number(exercicioRelatorio) || anoDosArquivos || null;

  const anosDisponiveis = useMemo(() => {
    const atualAno = new Date().getFullYear();
    const anos = new Set<number>();
    for (let a = atualAno + 1; a >= atualAno - 6; a--) anos.add(a);
    if (baseArq?.apuracao.anoBase) anos.add(baseArq.apuracao.anoBase);
    if (atualArq?.apuracao.anoBase) anos.add(atualArq.apuracao.anoBase);
    if (anoApuracaoBase) anos.add(anoApuracaoBase);
    if (anoApuracaoAtual) anos.add(anoApuracaoAtual);
    if (anoAplicacaoBase) anos.add(anoAplicacaoBase);
    if (anoAplicacaoAtual) anos.add(anoAplicacaoAtual);
    return [...anos].sort((a, b) => b - a);
  }, [baseArq, atualArq, anoApuracaoBase, anoApuracaoAtual, anoAplicacaoBase, anoAplicacaoAtual]);

  const rotuloBase = base
    ? rotuloArquivo(base, anoApuracaoBase, anoAplicacaoBase)
    : anoAplicacaoBase
      ? `Base ${anoAplicacaoBase}`
      : "Base";
  const rotuloAtual = atual
    ? rotuloArquivo(atual, anoApuracaoAtual, anoAplicacaoAtual)
    : anoAplicacaoAtual
      ? `Comparado ${anoAplicacaoAtual}`
      : "Comparado";
  const referenciaBase = anoAplicacaoBase ? `Base ${anoAplicacaoBase}` : "Base";
  const referenciaAtual = anoAplicacaoAtual
    ? `Comparado/estimado ${anoAplicacaoAtual}`
    : "Comparado/estimado";

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

  // prefixo com o município escolhido: arquivos baixados nunca se confundem entre municípios
  const prefixoArquivo = `evolucao-vaf-${(municipioRelatorio?.nome ?? "municipio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  function baixarComparativoCsv() {
    if (!base || !atual || !declarantes) return;
    const diag = diagnosticarEvolucao(base, atual);
    const analise = textoDiagnostico(diag, rotuloBase, rotuloAtual);
    const plano = textoPlanoRecuperacao(
      montarPlanoRecuperacao(diag, declarantes, {
        exercicio: exercicioSelecionado,
        situacoesCadastrais: situacoesCadastrais ?? null,
      }),
    );
    const csv = csvEvolucao(base.nome, atual.nome, indicadores, declarantes, analise, plano, {
      base: referenciaBase,
      atual: referenciaAtual,
    });
    baixarCsv(`${prefixoArquivo}-comparativo.csv`, csv);
  }

  const perdaSaidas = declarantes?.sairam.reduce((s, d) => s + d.vafBase, 0) ?? 0;
  const ganhoEntradas = declarantes?.entraram.reduce((s, d) => s + d.vafAtual, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Evolução do VAF</h1>
          <p className="text-sm text-muted-foreground">
            Compare duas remessas (mensal, índice provisório ou definitivo) e analise a evolução do
            líquido, dos componentes VAF A/B/C, das declarações e dos contribuintes declarantes.{" "}
            <NotaRemessa className="ml-1" />
          </p>
        </div>
        <Button variant="outline" className="no-print" onClick={onNovaAnalise}>
          Nova análise
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros do relatório</CardTitle>
          <p className="text-xs text-muted-foreground">
            Município e ano de aplicação usados nos documentos exportados (.docx, .pdf e CSV).
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Município</Label>
            <Select
              value={municipioRelatorioId}
              onValueChange={setMunicipioRelatorioId}
              disabled={municipiosPermitidos.length <= 1}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o município" />
              </SelectTrigger>
              <SelectContent>
                {municipiosPermitidos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ano de aplicação dos documentos</Label>
            <Select value={exercicioRelatorio} onValueChange={setExercicioRelatorio}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o exercício" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {bloqueio && (
        <BannerBloqueio
          bloqueio={bloqueio}
          municipioAtivo={municipio}
          onResolver={() => setPendente(bloqueio)}
        />
      )}

      {(faltaCredito || planilha) && (
        <CreditoProprioPortal
          codigoSef={municipio?.codigo_sef ? String(municipio.codigo_sef) : ""}
          planilha={planilha}
          onPlanilha={setPlanilha}
          anoBaseArquivo={atualArq?.apuracao.anoBase ?? baseArq?.apuracao.anoBase ?? null}
          creditoInternoArquivo={
            atualArq?.apuracao.creditoInterno ?? baseArq?.apuracao.creditoInterno
          }
          perguntar={perguntarPlanilha}
          onPerguntarChange={setPerguntarPlanilha}
          contexto={arquivoSemCredito ? `“${arquivoSemCredito}”` : undefined}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <CaixaArquivo
          titulo="Arquivo base (remessa anterior)"
          descricao="Ex.: índice definitivo do ano anterior."
          arquivo={base}
          carregando={carregando === "base"}
          onSelecionar={(f) => carregar(f, "base")}
          anoApuracao={anoApuracaoBase}
          anoAplicacao={anoAplicacaoBase}
          anosDisponiveis={anosDisponiveis}
          onAnoApuracao={setAnoApuracaoBase}
          onAnoAplicacao={setAnoAplicacaoBase}
          resolucoes={resolucoesSef}
          resolucaoNumero={resolucaoBase}
          onResolucao={setResolucaoBase}
        />
        <CaixaArquivo
          titulo="Arquivo atual (remessa a comparar)"
          descricao="Ex.: retorno mensal, provisório ou definitivo do ano atual."
          arquivo={atual}
          carregando={carregando === "atual"}
          onSelecionar={(f) => carregar(f, "atual")}
          anoApuracao={anoApuracaoAtual}
          anoAplicacao={anoAplicacaoAtual}
          anosDisponiveis={anosDisponiveis}
          onAnoApuracao={setAnoApuracaoAtual}
          onAnoAplicacao={setAnoAplicacaoAtual}
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
              onClick={baixarComparativoCsv}
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
              placeholder="Nome da análise (ex.: Definitivo 2024 x Arquivo 7/2025)"
              value={nomeGravar}
              onChange={(e) => setNomeGravar(e.target.value)}
            />
            <Button
              disabled={!base || !atual || !municipio || salvarEvolucao.isPending}
              onClick={() => {
                if (!base || !atual || !municipio) return;
                const nome = nomeGravar.trim() || `${referenciaBase} x ${referenciaAtual}`;
                salvarEvolucao.mutate(
                  {
                    municipioId: municipio.id,
                    nome,
                    vafReferencia,
                    base: {
                      ...base,
                      ...(anoApuracaoBase ? { anoApuracao: anoApuracaoBase } : {}),
                      ...(anoAplicacaoBase ? { anoAplicacao: anoAplicacaoBase } : {}),
                    },
                    atual: {
                      ...atual,
                      ...(anoApuracaoAtual ? { anoApuracao: anoApuracaoAtual } : {}),
                      ...(anoAplicacaoAtual ? { anoAplicacao: anoAplicacaoAtual } : {}),
                    },
                  },
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
                        setAnoApuracaoBase(sugerirAnoApuracao(s.base));
                        setAnoApuracaoAtual(sugerirAnoApuracao(s.atual));
                        setAnoAplicacaoBase(sugerirAnoAplicacao(s.base));
                        setAnoAplicacaoAtual(sugerirAnoAplicacao(s.atual));
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
            Carregue o arquivo da remessa anterior e o da remessa atual para ver o comparativo
            completo.
          </AlertDescription>
        </Alert>
      )}

      {base && atual && declarantes && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo="Declarantes - deixaram de declarar"
                  ajuda={
                    <>
                      <p>
                        Contribuintes com <strong>declaração no arquivo base</strong> ({rotuloBase})
                        e <strong>sem declaração</strong> no arquivo comparado/estimado (
                        {rotuloAtual}).
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
                        Contribuintes presentes apenas no arquivo comparado/estimado ({rotuloAtual}
                        ), sem declaração no arquivo base ({rotuloBase}).
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
                  titulo={`Valor líquido - base${anoAplicacaoBase ? ` ${anoAplicacaoBase}` : ""}`}
                  ajuda={
                    <>
                      <p>
                        <strong>Valor líquido</strong> é o saldo apurado no arquivo base (
                        {rotuloBase}).
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
                <p className="text-xs text-muted-foreground">Arquivo: {rotuloBase}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo={`Valor líquido - comparado/estimado${anoAplicacaoAtual ? ` ${anoAplicacaoAtual}` : ""}`}
                  ajuda={
                    <>
                      <p>
                        <strong>Valor líquido</strong> do arquivo comparado/estimado ({rotuloAtual}
                        ).
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
                <p className="text-xs text-muted-foreground">Arquivo: {rotuloAtual}</p>
                <p className="text-xs">
                  <span className="mr-2">
                    Diferença:{" "}
                    {formatarMoeda(atual.apuracao.valorLiquido - base.apuracao.valorLiquido)}
                  </span>
                  <Variacao
                    pct={indicadores.find((l) => l.chave === "valorLiquido")?.variacaoPct ?? null}
                  />
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo={`Índice de participação - base${anoAplicacaoBase ? ` ${anoAplicacaoBase}` : ""}`}
                  ajuda={
                    <>
                      <p>
                        Participação do município no VAF estadual apurada no arquivo base (
                        {rotuloBase}).
                      </p>
                      <p>
                        <strong>Índice</strong> = valor líquido do município ÷ VAF estadual × 100.
                        Em retornos mensais o resultado é uma projeção, não o índice oficial.
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold">
                  {formatarIndice(base.apuracao.indice)}%
                </p>
                <p className="text-xs text-muted-foreground">Arquivo: {rotuloBase}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo={`Índice de participação - comparado/estimado${anoAplicacaoAtual ? ` ${anoAplicacaoAtual}` : ""}`}
                  ajuda={
                    <>
                      <p>
                        Participação do município no VAF estadual apurada no arquivo
                        comparado/estimado ({rotuloAtual}).
                      </p>
                      <p>
                        <strong>Índice</strong> = valor líquido do município ÷ VAF estadual × 100.
                        Em retornos mensais o resultado é uma projeção, não o índice oficial.
                      </p>
                      <p>
                        <strong>Variação %</strong> comparada ao índice do arquivo base (
                        {rotuloBase}).
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold text-primary">
                  {formatarIndice(atual.apuracao.indice)}%
                </p>
                <p className="text-xs">
                  <Variacao
                    pct={indicadores.find((l) => l.chave === "indice")?.variacaoPct ?? null}
                  />
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo={`Média dos índices${
                    anoAplicacaoBase && anoAplicacaoAtual
                      ? ` ${anoAplicacaoBase}/${anoAplicacaoAtual}`
                      : ""
                  }`}
                  ajuda={
                    <>
                      <p>
                        Média simples entre o índice do arquivo base ({rotuloBase}) e o do arquivo
                        comparado/estimado ({rotuloAtual}).
                      </p>
                      <p>
                        É esse valor que a SEF-MG aplica no repasse do exercício seguinte ao da
                        última apuração.
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold text-primary">
                  {base.apuracao.indice > 0 && atual.apuracao.indice > 0
                    ? `${formatarIndice((base.apuracao.indice + atual.apuracao.indice) / 2)}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {base.apuracao.indice > 0 && atual.apuracao.indice > 0
                    ? "(índice base + índice comparado) ÷ 2"
                    : "Faltam os índices dos dois arquivos para calcular a média."}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-1 p-4">
                <RotuloKpi
                  titulo="VAF estadual"
                  ajuda={
                    <>
                      <p>
                        Total do VAF de Minas Gerais usado como denominador do índice de
                        participação.
                      </p>
                      <p>
                        Nos arquivos de índice (provisório ou definitivo) o valor vem do próprio
                        arquivo da SEF-MG; em retornos mensais é usado o VAF estadual de referência
                        informado no parâmetro de projeção.
                      </p>
                    </>
                  }
                />
                <p className="break-words font-display text-lg font-semibold">
                  {formatarMoeda(atual.apuracao.vafEstadual || base.apuracao.vafEstadual)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Origem:{" "}
                  {(atual.apuracao.vafEstadual ? atual : base).apuracao.origemVafEstadual ===
                  "arquivo"
                    ? "arquivo da SEF-MG"
                    : "referência informada"}
                </p>
                {base.apuracao.vafEstadual > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Base: {formatarMoeda(base.apuracao.vafEstadual)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Índice publicado pelo Estado e aplicado no exercício (só referência) */}
          <IndiceAplicadoBase
            municipioId={municipioRelatorio?.id ?? null}
            exercicioAplicacao={anoAplicacaoAtual}
            indiceApurado={
              base.apuracao.indice > 0 && atual.apuracao.indice > 0
                ? (base.apuracao.indice + atual.apuracao.indice) / 2
                : atual.apuracao.indice
            }
            rotuloApurado="índice médio desta análise"
          />

          <DiagnosticoVariacao
            base={base}
            atual={atual}
            rotuloBase={rotuloBase}
            rotuloAtual={rotuloAtual}
            municipio={municipioRelatorio?.nome ?? null}
            municipioId={municipioRelatorio?.id ?? null}
            exercicio={exercicioSelecionado}
          />

          <PlanoRecuperacao
            diagnostico={diagnosticarEvolucao(base, atual)}
            declarantes={declarantes}
            exercicio={exercicioSelecionado}
            municipioNome={municipioRelatorio?.nome ?? null}
            referencia={`${base.nome}::${atual.nome}`}
            situacoesCadastrais={situacoesCadastrais ?? null}
            indiceProvisorio={atual.apuracao.indice ?? null}
          />

          <Tabs defaultValue="indicadores">
            <TabsList className="flex-wrap">
              <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
              <TabsTrigger value="memoria">Memória de cálculo</TabsTrigger>
              <TabsTrigger value="sairam">
                Deixaram de declarar ({declarantes.sairam.length})
              </TabsTrigger>
              <TabsTrigger value="entraram">Novos ({declarantes.entraram.length})</TabsTrigger>
              <TabsTrigger value="variacao">Variação por contribuinte</TabsTrigger>
              <TabsTrigger value="impacto">Impacto por contribuinte</TabsTrigger>
              <TabsTrigger value="municipios">Municípios</TabsTrigger>
              <TabsTrigger value="outras">Outras receitas</TabsTrigger>
            </TabsList>

            <TabsContent value="outras">
              <OutrasReceitas
                base={base.outrasEntradas}
                atual={atual.outrasEntradas}
                rotuloBase={referenciaBase}
                rotuloAtual={referenciaAtual}
                nomeArquivoCsv={`${prefixoArquivo}-outras-receitas.csv`}
              />
            </TabsContent>

            <TabsContent value="indicadores">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicador</TableHead>
                        <TableHead className="text-right">{rotuloBase}</TableHead>
                        <TableHead className="text-right">{rotuloAtual}</TableHead>
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
                        {i === 0 ? referenciaBase : referenciaAtual} ·{" "}
                        {rotuloArquivo(
                          arq,
                          i === 0 ? anoApuracaoBase : anoApuracaoAtual,
                          i === 0 ? anoAplicacaoBase : anoAplicacaoAtual,
                        )}
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
                    colunaBase={`VAF base${anoAplicacaoBase ? ` ${anoAplicacaoBase}` : ""}`}
                    colunaAtual={`VAF comparado${anoAplicacaoAtual ? ` ${anoAplicacaoAtual}` : ""}`}
                    vazio="Todos os contribuintes da remessa base declararam também na atual."
                    nomeArquivo={`${prefixoArquivo}-deixaram-de-declarar.csv`}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entraram">
              <Card>
                <CardContent className="p-0">
                  <TabelaMovimentos
                    linhas={declarantes.entraram}
                    colunaBase={`VAF base${anoAplicacaoBase ? ` ${anoAplicacaoBase}` : ""}`}
                    colunaAtual={`VAF comparado${anoAplicacaoAtual ? ` ${anoAplicacaoAtual}` : ""}`}
                    vazio="Nenhum declarante novo nesta remessa."
                    nomeArquivo={`${prefixoArquivo}-novos-declarantes.csv`}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="variacao">
              <Card>
                <CardContent className="p-0">
                  <TabelaMovimentos
                    linhas={declarantes.todos}
                    colunaBase={`VAF base${anoAplicacaoBase ? ` ${anoAplicacaoBase}` : ""}`}
                    colunaAtual={`VAF comparado${anoAplicacaoAtual ? ` ${anoAplicacaoAtual}` : ""}`}
                    vazio="Sem contribuintes para comparar."
                    nomeArquivo={`${prefixoArquivo}-variacao-contribuintes.csv`}
                    ocultarOrigem
                    porPagina={20}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="impacto">
              <ImpactoContribuintes
                movimentos={declarantes.todos}
                indiceAtual={atual.apuracao.indice || null}
                nomeArquivo={`${prefixoArquivo}-impacto-contribuintes.csv`}
              />
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
                            <TableHead className="w-16">Código</TableHead>
                            <TableHead>Município</TableHead>
                            <TableHead className="text-right">Base (R$)</TableHead>
                            <TableHead className="text-right">Atual (R$)</TableHead>
                            <TableHead className="text-right">Diferença (R$)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bloco.linhas.slice(0, 100).map((m) => (
                            <TableRow key={m.codigo}>
                              <TableCell className="font-mono">{m.codigo}</TableCell>
                              <TableCell className="max-w-[12rem] truncate">
                                {m.nome ?? (
                                  <span className="text-muted-foreground italic">
                                    Código não encontrado na tabela SEF-MG
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatarValorGrid(m.base)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatarValorGrid(m.atual)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono ${m.diferenca < 0 ? "text-destructive" : m.diferenca > 0 ? "text-emerald-600" : ""}`}
                              >
                                {formatarValorGrid(m.diferenca)}
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
                      Deseja trocar a prefeitura ativa para <strong>{pendente.destinoNome}</strong>{" "}
                      e carregar este arquivo? A comparação atual será limpa.
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
