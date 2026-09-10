import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Download,
  FileText,
  Loader2,
  ArrowUpDown,
  Paperclip,
  Target,
} from "lucide-react";

import { toast } from "sonner";
import { useReceitaPorIe } from "@/hooks/useReceitaPorIe";
import {
  BarraSelecaoReceita,
  BotaoConsultarReceita,
  BotaoReconsultarFalhas,
  CaixaSelecaoIe,
  CaixaSelecaoTodas,
  chaveDataSituacao,
  DataSituacaoRf,
  ReceitaIeBadge,
  useSelecaoIes,
  type SelecaoIes,
} from "@/components/analises/ReceitaIe";
import { ProgressoConsultaReceita } from "@/components/receita/ProgressoConsultaReceita";
import { SITUACOES_RECEITA_ENCERRADAS, type RegistroReceita } from "@/lib/receita/normalizar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatarCnpj, formatarMoeda } from "@/lib/format";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useModelos } from "@/hooks/useModelos";
import { baixarBlob, gerarZipOficios, nomeZip, type ProgressoOficios } from "@/lib/oficios/pacote";
import { ROTULO_SITUACAO, type ModeloOficio } from "@/lib/oficios/modelos";
import { hojeIso } from "@/lib/oficios/texto";
import {
  montarPlanoRecuperacao,
  textoPlanoRecuperacao,
  csvIgnorados,
  baixarCsvIgnorados,
  chaveIe,
  potencialConsolidado,
  ROTULO_PRIORIDADE,
  type AcaoRecuperacao,
  type MapaSituacoesCadastrais,
} from "@/lib/vaf/recuperacao";
import type { DiagnosticoEvolucao } from "@/lib/vaf/diagnostico";
import {
  rotuloOrigem,
  type ComparacaoDeclarantes,
  type MovimentoDeclarante,
} from "@/lib/vaf/evolucao";
import {
  chaveStatus,
  useAcoesRecuperacao,
  useSalvarStatusAcao,
  CORES_STATUS_ACAO,
  ROTULO_STATUS_ACAO,
  STATUS_ACAO,
  type EntradaStatus,
  type StatusAcao,
} from "@/hooks/useAcoesRecuperacao";
import { useAnexosAcao } from "@/hooks/useAnexosAcao";
import AnotacoesAcao from "./AnotacoesAcao";

const ROTULO_MOTIVO_IGNORADO: Record<string, string> = {
  CANCELADO: "Cancelado",
  BAIXADO: "Baixado",
  BLOQUEADO: "Bloqueado no exercício",
  NAO_INFORMADA: "Não informada",
};

const CORES_PRIORIDADE: Record<AcaoRecuperacao["prioridade"], string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baixa: "border-border bg-muted text-muted-foreground",
};

type Props = {
  diagnostico: DiagnosticoEvolucao;
  declarantes: ComparacaoDeclarantes;
  exercicio?: number | null;
  /** Nome do município escolhido no seletor da tela (usado nos documentos exportados). */
  municipioNome?: string | null;
  /** Identificador estável da análise (arquivos comparados) para gravar o acompanhamento. */
  referencia?: string | null;
  cargaId?: string | null;
  /** situação cadastral por IE — cancelados/baixados/bloqueados saem das ações */
  situacoesCadastrais?: MapaSituacoesCadastrais | null;
};

export type SalvarStatus = (entradas: EntradaStatus | EntradaStatus[]) => void;

export default function PlanoRecuperacao({
  diagnostico,
  declarantes,
  exercicio,
  municipioNome,
  referencia,
  cargaId,
  situacoesCadastrais,
}: Props) {
  const acoes = useMemo(
    () =>
      montarPlanoRecuperacao(diagnostico, declarantes, {
        exercicio: exercicio ?? null,
        situacoesCadastrais: situacoesCadastrais ?? null,
      }),
    [diagnostico, declarantes, exercicio, situacoesCadastrais],
  );
  const [filtroMotivo, setFiltroMotivo] = useState<string>("todos");
  const [baixandoDocx, setBaixandoDocx] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  /** formato pendente de confirmação no diálogo de seleção (baixados por data) */
  const [exportacaoPendente, setExportacaoPendente] = useState<"docx" | "pdf" | null>(null);
  const { municipio } = useMunicipioAtivo();
  const nomeMunicipioRelatorio = municipioNome ?? municipio?.nome ?? null;

  /** situação cadastral na Receita Federal dos contribuintes citados no plano */
  const entradasReceita = useMemo(() => {
    const mapa = new Map<string, { inscricao_estadual: string; cnpj: string | null }>();
    for (const a of acoes)
      for (const c of [...a.contribuintes, ...a.ignorados])
        if (!mapa.has(c.inscricao_estadual))
          mapa.set(c.inscricao_estadual, {
            inscricao_estadual: c.inscricao_estadual,
            cnpj: c.cnpj,
          });
    return [...mapa.values()];
  }, [acoes]);
  const receita = useReceitaPorIe(municipio?.id ?? null, entradasReceita);
  const sel = useSelecaoIes();

  const motivoDe = (c: { inscricao_estadual: string }) =>
    (situacoesCadastrais?.[chaveIe(c.inscricao_estadual)] || "NAO_INFORMADA").toUpperCase();

  /** contagem por motivo de exclusão (IEs distintas), recalculada a cada mudança do plano */
  const contagemMotivos = useMemo(() => {
    const porMotivo = new Map<string, Set<string>>();
    const todas = new Set<string>();
    for (const a of acoes)
      for (const c of a.ignorados) {
        const m = motivoDe(c);
        if (!porMotivo.has(m)) porMotivo.set(m, new Set());
        porMotivo.get(m)!.add(c.inscricao_estadual);
        todas.add(c.inscricao_estadual);
      }
    return { porMotivo, total: todas.size };
  }, [acoes, situacoesCadastrais]);

  /** ações com a lista de ignorados já filtrada pelo motivo escolhido */
  const acoesFiltradas = useMemo(
    () =>
      acoes.map((a) => ({
        ...a,
        ignorados:
          filtroMotivo === "todos"
            ? a.ignorados
            : a.ignorados.filter((c) => motivoDe(c) === filtroMotivo),
      })),
    [acoes, filtroMotivo, situacoesCadastrais],
  );

  const totalIgnorados = useMemo(() => {
    const ies = new Set<string>();
    for (const a of acoesFiltradas) for (const c of a.ignorados) ies.add(c.inscricao_estadual);
    return ies.size;
  }, [acoesFiltradas]);
  const [acaoEmissao, setAcaoEmissao] = useState<AcaoRecuperacao | null>(null);

  const ref = referencia ?? null;
  const { data: registros } = useAcoesRecuperacao(ref);
  const salvar = useSalvarStatusAcao();

  const statusPorChave = useMemo(() => {
    const m = new Map<string, StatusAcao>();
    for (const r of registros ?? [])
      m.set(chaveStatus(r.acao_chave, r.inscricao_estadual), r.status);
    return m;
  }, [registros]);

  const obsPorChave = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of registros ?? [])
      m.set(chaveStatus(r.acao_chave, r.inscricao_estadual), r.observacao);
    return m;
  }, [registros]);

  const { data: anexos } = useAnexosAcao(ref);
  const anexosPorChave = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of anexos ?? []) {
      const k = chaveStatus(a.acao_chave, a.inscricao_estadual);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [anexos]);

  const salvarStatus: SalvarStatus = (entradas) => {
    if (!ref) {
      toast.error("Análise sem referência para gravar o acompanhamento.");
      return;
    }
    salvar.mutate(entradas, {
      onSuccess: () => toast.success("Acompanhamento atualizado."),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
    });
  };

  const totalPotencial = potencialConsolidado(acoes);
  const concluidas = acoes.filter(
    (a) => statusPorChave.get(chaveStatus(a.chave)) === "concluida",
  ).length;
  const emAndamento = acoes.filter((a) => {
    const s = statusPorChave.get(chaveStatus(a.chave));
    return s === "oficio_enviado" || s === "resposta_recebida";
  }).length;

  function copiar() {
    void navigator.clipboard
      .writeText(textoPlanoRecuperacao(acoes, receita.rotulosPorIe))
      .then(() => toast.success("Plano de recuperação copiado."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  /**
   * Leva os contribuintes com achados (ou apenas os marcados) para a tela de
   * impugnação do índice provisório, sem duplicar quem aparece em mais de uma ação.
   */
  function montarImpugnacao() {
    const marcadas = new Set(sel.marcadas);
    const porIe = new Map<string, ItemImpugnacao>();
    for (const a of acoes) {
      if (a.agregadora) continue;
      for (const c of a.contribuintes) {
        const ie = chaveIe(c.inscricao_estadual);
        if (marcadas.size && !marcadas.has(ie)) continue;
        const valor = Math.abs(a.campoValor === "vafBase" ? c.vafBase : c.diferenca);
        const atual = porIe.get(ie);
        if (atual && diferencaItem(atual) >= valor) continue;
        porIe.set(ie, {
          ie: c.inscricao_estadual,
          cnpj: c.cnpj,
          nome: c.nome,
          motivo: a.motivo,
          vafApurado: Math.abs(c.vafAtual),
          vafCorreto: Math.abs(c.vafAtual) + valor,
          observacao: a.titulo,
        });
      }
    }
    const itens = [...porIe.values()];
    if (!itens.length) {
      toast.error("Nenhum contribuinte para impugnar nesta análise.");
      return;
    }
    window.sessionStorage.setItem(CHAVE_ITENS_IMPUGNACAO, JSON.stringify(itens));
    void navigate({
      to: "/impugnacao",
      search: exercicio ? { exercicio } : {},
    });
  }

  const contextoRelatorio = () => ({
    municipio: nomeMunicipioRelatorio,
    exercicio: exercicio ?? null,
    referencia: referencia ?? null,
    situacoesReceita: receita.rotulosPorIe,
  });

  /** aplica a seleção do diálogo: filtra contribuintes e recalcula o valor das ações afetadas */
  function filtrarAcoesPorIes(ies: Set<string>): AcaoRecuperacao[] {
    return acoes
      .map((a) => {
        if (!a.contribuintes.length) return a;
        const mantidos = a.contribuintes.filter((c) => ies.has(c.inscricao_estadual));
        if (mantidos.length === a.contribuintes.length) return a;
        const valor = mantidos.reduce((s, c) => s + Math.abs(c.diferenca), 0);
        return { ...a, contribuintes: mantidos, valorRecuperavel: valor };
      })
      .filter((a) => a.contribuintes.length > 0 || !acoes.find((o) => o.chave === a.chave)?.contribuintes.length);
  }

  async function baixarDocx(acoesRelatorio: AcaoRecuperacao[]) {
    setBaixandoDocx(true);
    try {
      const { baixarDocPlano } = await import("@/lib/vaf/planoDocx");
      await baixarDocPlano(acoesRelatorio, contextoRelatorio());
      toast.success("Análise baixada em .docx (abre no Word e exporta em PDF).");
    } catch {
      toast.error("Não foi possível gerar o documento do plano.");
    } finally {
      setBaixandoDocx(false);
    }
  }

  async function baixarPdf(acoesRelatorio: AcaoRecuperacao[]) {
    setBaixandoPdf(true);
    try {
      const { baixarPdfPlano } = await import("@/lib/vaf/relatorioPdf");
      await baixarPdfPlano(acoesRelatorio, contextoRelatorio());
      toast.success("Análise baixada em .pdf com o papel timbrado.");
    } catch {
      toast.error("Não foi possível gerar o PDF do plano.");
    } finally {
      setBaixandoPdf(false);
    }
  }

  function confirmarExportacao(ies: string[]) {
    const formato = exportacaoPendente;
    setExportacaoPendente(null);
    if (!formato) return;
    const acoesRelatorio = filtrarAcoesPorIes(new Set(ies));
    if (!acoesRelatorio.length) {
      toast.error("Nenhuma ação restante com a seleção feita — ajuste os contribuintes.");
      return;
    }
    if (formato === "docx") void baixarDocx(acoesRelatorio);
    else void baixarPdf(acoesRelatorio);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />O que fazer para recuperar
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Ações sugeridas a partir dos fatores da variação, ordenadas por prioridade e valor
              potencialmente recuperável.
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <BotaoConsultarReceita
              onConsultar={() => receita.consultar(false)}
              consultando={receita.consultando}
              totalCnpjs={receita.totalCnpjs}
              pendentes={receita.pendentes}
              semCnpj={receita.semCnpj}
            />
            <BotaoReconsultarFalhas
              total={receita.semResposta}
              onReconsultar={receita.reconsultarFalhas}
              reconsultando={receita.reconsultando}
            />
            <Button variant="outline" size="sm" className="gap-2" onClick={copiar}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copiar plano
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={montarImpugnacao}>
              <Gavel className="h-3.5 w-3.5" />
              Montar impugnação
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setExportacaoPendente("docx")}
              disabled={baixandoDocx || baixandoPdf}
            >
              {baixandoDocx ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Baixar a Análise (.docx)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => setExportacaoPendente("pdf")}
              disabled={baixandoPdf || baixandoDocx}
            >
              {baixandoPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Baixar a Análise (.pdf)
            </Button>
          </div>
        </CardHeader>
        <ProgressoConsultaReceita progresso={receita.progresso} />

        <CardContent className="space-y-4">
          <BarraSelecaoReceita
            sel={sel}
            consultando={receita.consultando}
            onConsultar={(ies) => receita.consultarIes(ies)}
            resumo={receita.resumoSelecao}
            onFecharResumo={receita.limparResumoSelecao}
          />
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Potencial mapeado: {formatarMoeda(totalPotencial)}</AlertTitle>
            <AlertDescription className="text-xs">
              Cada contribuinte é contado uma única vez, mesmo quando aparece em mais de uma ação
              (diligência, queda expressiva, omissão), pelo maior valor em jogo. Não é cumulativo
              com o índice já publicado: parte depende de retificação dentro do prazo da SEFAZ.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Acompanhamento:</span>
            <Badge variant="outline" className={CORES_STATUS_ACAO.concluida}>
              {concluidas} concluída(s)
            </Badge>
            <Badge variant="outline" className={CORES_STATUS_ACAO.oficio_enviado}>
              {emAndamento} em andamento
            </Badge>
            <Badge variant="outline" className={CORES_STATUS_ACAO.prevista}>
              {acoes.length - concluidas - emAndamento} prevista(s)
            </Badge>
            {!ref && <span>· salve/carregue a evolução para gravar o status.</span>}
          </div>

          {contagemMotivos.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Ignorados por motivo:</span>
              <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
                <SelectTrigger className="h-7 w-[260px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os motivos ({contagemMotivos.total})</SelectItem>
                  {[...contagemMotivos.porMotivo.entries()]
                    .sort((a, b) => b[1].size - a[1].size)
                    .map(([motivo, ies]) => (
                      <SelectItem key={motivo} value={motivo}>
                        {ROTULO_MOTIVO_IGNORADO[motivo] ?? motivo} ({ies.size})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {filtroMotivo !== "todos" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setFiltroMotivo("todos")}
                >
                  Limpar filtro
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {totalIgnorados > 0 ? (
              <>
                <span>
                  {totalIgnorados} contribuinte(s)
                  {filtroMotivo === "todos"
                    ? " foram retirados automaticamente das ações por estarem cancelados, baixados ou bloqueados na SEF/MG"
                    : ` no filtro "${ROTULO_MOTIVO_IGNORADO[filtroMotivo] ?? filtroMotivo}"`}{" "}
                  — não recebem ofício nem entram no valor recuperável.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() =>
                    baixarCsvIgnorados(
                      csvIgnorados(acoesFiltradas, situacoesCadastrais ?? null),
                      "contribuintes-ignorados-plano.csv",
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar ignorados (CSV)
                </Button>
              </>
            ) : (
              <>Nenhum contribuinte ignorado com o motivo selecionado.</>
            )}
          </div>

          <div className="space-y-3">
            {acoesFiltradas.map((acao, i) => (
              <ItemAcao
                key={acao.chave}
                acao={acao}
                ordem={i + 1}
                onEmitir={() => setAcaoEmissao(acao)}
                referencia={ref}
                cargaId={cargaId ?? null}
                exercicio={exercicio ?? null}
                statusPorChave={statusPorChave}
                obsPorChave={obsPorChave}
                anexosPorChave={anexosPorChave}
                salvarStatus={salvarStatus}
                situacoesCadastrais={situacoesCadastrais ?? null}
                receitaDe={receita.registroDe}
                cnpjDe={receita.cnpjDe}
                origemDe={receita.origemDe}
                sel={sel}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <DialogExportacaoRelatorio
        formato={exportacaoPendente}
        acoes={acoes}
        exercicio={exercicio ?? null}
        receitaDe={receita.registroDe}
        baixando={baixandoDocx || baixandoPdf}
        onFechar={() => setExportacaoPendente(null)}
        onConfirmar={confirmarExportacao}
      />

      <DialogEmissao
        acao={acaoEmissao}
        exercicio={exercicio ?? null}
        receitaDe={receita.registroDe}
        onFechar={() => setAcaoEmissao(null)}
        onEmitido={(acao, exercicioNum, ies) => {
          if (!ref) return;
          const base = {
            referencia: ref,
            cargaId: cargaId ?? null,
            exercicio: exercicioNum,
            acaoChave: acao.chave,
            acaoTitulo: acao.titulo,
            status: "oficio_enviado" as StatusAcao,
          };
          salvarStatus([
            { ...base, valorRecuperavel: acao.valorRecuperavel },
            ...acao.contribuintes
              .filter((c) => ies.includes(c.inscricao_estadual))
              .map((c) => ({
                ...base,
                inscricaoEstadual: c.inscricao_estadual,
                nomeContribuinte: c.nome,
                cnpj: c.cnpj,
                valorRecuperavel: Math.abs(c.diferenca),
              })),
          ]);
        }}
      />
    </>
  );
}

function SeletorStatus({
  valor,
  onChange,
  className,
}: {
  valor: StatusAcao;
  onChange: (s: StatusAcao) => void;
  className?: string;
}) {
  return (
    <Select value={valor} onValueChange={(v) => onChange(v as StatusAcao)}>
      <SelectTrigger className={`h-7 w-[170px] text-xs ${className ?? ""}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ACAO.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {ROTULO_STATUS_ACAO[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemAcao({
  acao,
  ordem,
  onEmitir,
  referencia,
  cargaId,
  exercicio,
  statusPorChave,
  obsPorChave,
  anexosPorChave,
  salvarStatus,
  situacoesCadastrais,
  receitaDe,
  cnpjDe,
  origemDe,
  sel,
}: {
  acao: AcaoRecuperacao;
  ordem: number;
  onEmitir: () => void;
  referencia: string | null;
  cargaId: string | null;
  exercicio: number | null;
  statusPorChave: Map<string, StatusAcao>;
  obsPorChave: Map<string, string | null>;
  anexosPorChave: Map<string, number>;
  salvarStatus: SalvarStatus;
  situacoesCadastrais: MapaSituacoesCadastrais | null;
  receitaDe: (ie: string | null | undefined) => RegistroReceita | undefined;
  cnpjDe: (ie: string | null | undefined) => string | null;
  origemDe: (ie: string | null | undefined) => "cadastro" | "retorno" | null;
  sel: SelecaoIes;
}) {
  const [aberto, setAberto] = useState(false);
  /** ordenação opcional da lista pela data da situação na Receita Federal */
  const [ordemData, setOrdemData] = useState<"asc" | "desc" | null>(null);
  /** null = fechado; "" = anotação da ação; IE = anotação do contribuinte */
  const [anotando, setAnotando] = useState<string | null>(null);
  const [ignoradoAberto, setIgnoradoAberto] = useState<MovimentoDeclarante | null>(null);
  const temLista = acao.contribuintes.length > 0;
  const statusAcao = statusPorChave.get(chaveStatus(acao.chave)) ?? "prevista";
  const contribuinteAnotado = anotando
    ? (acao.contribuintes.find((c) => c.inscricao_estadual === anotando) ?? null)
    : null;

  const visiveis = (() => {
    const base = acao.contribuintes.slice(0, 25);
    if (!ordemData) return base;
    const sinal = ordemData === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const da = chaveDataSituacao(receitaDe(a.inscricao_estadual));
      const db = chaveDataSituacao(receitaDe(b.inscricao_estadual));
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sinal * da.localeCompare(db);
    });
  })();

  const baseEntrada = {
    referencia: referencia ?? "",
    cargaId,
    exercicio,
    acaoChave: acao.chave,
    acaoTitulo: acao.titulo,
  };

  return (
    <div className="rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {ordem}. {acao.titulo}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{acao.motivo}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={CORES_STATUS_ACAO[statusAcao]}>
              {ROTULO_STATUS_ACAO[statusAcao]}
            </Badge>
            <Badge variant="outline" className={CORES_PRIORIDADE[acao.prioridade]}>
              {ROTULO_PRIORIDADE[acao.prioridade]}
            </Badge>
          </div>
          <SeletorStatus
            valor={statusAcao}
            onChange={(status) =>
              salvarStatus({
                ...baseEntrada,
                valorRecuperavel: acao.valorRecuperavel,
                observacao: obsPorChave.get(chaveStatus(acao.chave)) ?? null,
                status,
              })
            }
          />

          {acao.valorRecuperavel > 0 && (
            <span className="font-mono text-sm tabular-nums">
              {formatarMoeda(acao.valorRecuperavel)}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs">
        <span className="font-medium">Como fazer: </span>
        <span className="text-muted-foreground">{acao.comoFazer}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Prazo sugerido: {acao.prazoSugerido}
        {acao.fundamento ? ` · ${acao.fundamento}` : ""}
      </p>

      {obsPorChave.get(chaveStatus(acao.chave)) && (
        <p className="mt-2 rounded-lg bg-muted/60 p-2 text-xs">
          <span className="font-medium">Observação: </span>
          <span className="text-muted-foreground">{obsPorChave.get(chaveStatus(acao.chave))}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {acao.situacaoOficio && temLista ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onEmitir}
          >
            <FileText className="h-3.5 w-3.5" />
            Emitir ofícios ({acao.contribuintes.length})
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {acao.situacaoOficio
              ? "Sem contribuintes listados — ação de rotina interna."
              : "Ação sem documento automático (diligência/procedimento)."}
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setAnotando("")}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Observações e anexos
          {anexosPorChave.get(chaveStatus(acao.chave))
            ? ` (${anexosPorChave.get(chaveStatus(acao.chave))})`
            : ""}
        </Button>

        {temLista && (
          <Collapsible open={aberto} onOpenChange={setAberto}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
                />
                {aberto ? "Ocultar contribuintes" : "Ver contribuintes"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 w-full overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <CaixaSelecaoTodas
                        ies={visiveis.map((c) => c.inscricao_estadual)}
                        sel={sel}
                      />
                    </TableHead>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>Receita Federal</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        title="Ordenar pela data da situação cadastral informada pela Receita Federal"
                        onClick={() =>
                          setOrdemData((o) => (o === "desc" ? "asc" : o === "asc" ? null : "desc"))
                        }
                      >
                        Data da situação (RF)
                        <ArrowUpDown className="h-3 w-3" />
                        {ordemData ? (ordemData === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">VAF base</TableHead>
                    <TableHead className="text-right">Comparado/estimado</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.map((c) => (
                    <TableRow key={c.inscricao_estadual}>
                      <TableCell>
                        <CaixaSelecaoIe ie={c.inscricao_estadual} sel={sel} rotulo={c.nome} />
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-medium">{c.nome ?? "(sem nome)"}</p>
                        <p className="text-muted-foreground">
                          IE {c.inscricao_estadual}
                          {(cnpjDe(c.inscricao_estadual) ?? c.cnpj)
                            ? ` · ${formatarCnpj((cnpjDe(c.inscricao_estadual) ?? c.cnpj)!)}`
                            : ""}
                        </p>
                        {obsPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual)) && (
                          <p className="mt-1 text-muted-foreground italic">
                            {obsPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual))}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <ReceitaIeBadge
                          registro={receitaDe(c.inscricao_estadual)}
                          cnpj={cnpjDe(c.inscricao_estadual) ?? c.cnpj}
                          origem={origemDe(c.inscricao_estadual)}
                        />
                      </TableCell>
                      <TableCell>
                        <DataSituacaoRf registro={receitaDe(c.inscricao_estadual)} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatarMoeda(c.vafBase)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatarMoeda(c.vafAtual)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {formatarMoeda(c.diferenca)}
                      </TableCell>
                      <TableCell>
                        <SeletorStatus
                          valor={
                            statusPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual)) ??
                            "prevista"
                          }
                          onChange={(status) =>
                            salvarStatus({
                              ...baseEntrada,
                              inscricaoEstadual: c.inscricao_estadual,
                              nomeContribuinte: c.nome,
                              cnpj: c.cnpj,
                              valorRecuperavel: Math.abs(c.diferenca),
                              observacao:
                                obsPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual)) ??
                                null,
                              status,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => setAnotando(c.inscricao_estadual)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {anexosPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual)) ?? ""}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {acao.contribuintes.length > 25 && (
                <p className="border-t p-2 text-xs text-muted-foreground">
                  Exibindo os 25 maiores de {acao.contribuintes.length} — a lista completa vai no
                  CSV da evolução.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
        {acao.ignorados.length > 0 && (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {acao.ignorados.length} contribuinte(s) desta ação foram ignorados por situação
                cadastral (cancelado/baixado/bloqueado) — clique em um nome para ver o motivo
                completo:
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() =>
                  baixarCsvIgnorados(
                    csvIgnorados(acao, situacoesCadastrais),
                    `ignorados-${acao.chave}.csv`,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                CSV dos ignorados ({acao.ignorados.length})
              </Button>
            </div>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {acao.ignorados.map((c) => (
                <button
                  key={c.inscricao_estadual}
                  type="button"
                  onClick={() => setIgnoradoAberto(c)}
                  className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {c.nome ?? c.inscricao_estadual}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnotacoesAcao
        aberto={anotando !== null}
        onFechar={() => setAnotando(null)}
        titulo={acao.titulo}
        subtitulo={
          contribuinteAnotado
            ? `${contribuinteAnotado.nome ?? "(sem nome)"} — IE ${contribuinteAnotado.inscricao_estadual}`
            : undefined
        }
        referencia={referencia}
        acaoChave={acao.chave}
        inscricaoEstadual={anotando ?? ""}
        observacaoAtual={obsPorChave.get(chaveStatus(acao.chave, anotando ?? "")) ?? null}
        onSalvarObservacao={(texto) =>
          salvarStatus({
            ...baseEntrada,
            ...(contribuinteAnotado
              ? {
                  inscricaoEstadual: contribuinteAnotado.inscricao_estadual,
                  nomeContribuinte: contribuinteAnotado.nome,
                  cnpj: contribuinteAnotado.cnpj,
                  valorRecuperavel: Math.abs(contribuinteAnotado.diferenca),
                }
              : { valorRecuperavel: acao.valorRecuperavel }),
            observacao: texto,
            status: statusPorChave.get(chaveStatus(acao.chave, anotando ?? "")) ?? "prevista",
          })
        }
      />

      <DetalheIgnorado
        contribuinte={ignoradoAberto}
        onFechar={() => setIgnoradoAberto(null)}
        acao={acao}
        exercicio={exercicio}
        cargaId={cargaId}
        referencia={referencia}
        situacaoCadastral={
          ignoradoAberto
            ? (situacoesCadastrais?.[chaveIe(ignoradoAberto.inscricao_estadual)] ?? null)
            : null
        }
      />
    </div>
  );
}

/** Modal com o motivo completo da exclusão e as evidências do contribuinte ignorado. */
function DetalheIgnorado({
  contribuinte,
  onFechar,
  acao,
  exercicio,
  cargaId,
  referencia,
  situacaoCadastral,
}: {
  contribuinte: MovimentoDeclarante | null;
  onFechar: () => void;
  acao: AcaoRecuperacao;
  exercicio: number | null;
  cargaId: string | null;
  referencia: string | null;
  situacaoCadastral: string | null;
}) {
  const c = contribuinte;
  const motivoRotulo = c
    ? (ROTULO_MOTIVO_IGNORADO[(situacaoCadastral || "NAO_INFORMADA").toUpperCase()] ??
      situacaoCadastral ??
      "Não informada")
    : "";
  const origem =
    c?.situacao === "saiu"
      ? "Deixou de declarar (constava na base, sumiu no arquivo atual)"
      : c?.situacao === "entrou"
        ? "Novo declarante no arquivo atual"
        : "Declarou nos dois arquivos comparados";

  const linhas: Array<[string, string]> = c
    ? [
        ["Inscrição estadual", c.inscricao_estadual],
        ["CNPJ", c.cnpj ? formatarCnpj(c.cnpj) : "não informado"],
        ["Situação cadastral (SEF/MG)", motivoRotulo],
        ["Origem na apuração", origem],
        ["Origem do nome", rotuloOrigem(c.origemNome)],
        ["Origem do CNPJ", rotuloOrigem(c.origemCnpj)],
        ["Exercício", exercicio ? String(exercicio) : "não informado"],
        ["Carga", cargaId ?? "não vinculada"],
        ["Referência da análise", referencia ?? "análise não salva"],
        ["VAF base", formatarMoeda(c.vafBase)],
        ["VAF atual", formatarMoeda(c.vafAtual)],
        ["Diferença", formatarMoeda(c.diferenca)],
        [
          "Variação",
          c.variacaoPct === null ? "—" : `${c.variacaoPct.toFixed(1).replace(".", ",")}%`,
        ],
        ["Ação do plano", acao.titulo],
      ]
    : [];

  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{c?.nome ?? c?.inscricao_estadual ?? ""}</DialogTitle>
          <DialogDescription>
            Contribuinte retirado desta ação do plano de recuperação.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Motivo da exclusão: {motivoRotulo}</AlertTitle>
          <AlertDescription className="text-xs">
            A inscrição está {motivoRotulo.toLowerCase()} na SEF/MG, portanto não recebe ofício nem
            notificação e o valor não entra no potencial recuperável desta ação. Se a situação
            estiver desatualizada, reprocesse a apuração com o arquivo de ativos mais recente.
          </AlertDescription>
        </Alert>

        <dl className="max-h-72 space-y-1 overflow-y-auto text-xs">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-3 border-b py-1 last:border-0">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="text-right font-medium tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Diálogo exibido antes de baixar a análise (DOCX/PDF): permite escolher, pela data da
 * situação na Receita Federal, quais contribuintes baixados/nulos entram no relatório.
 * Baixados com data da baixa anterior à data de referência do movimento já saem desmarcados.
 */
function DialogExportacaoRelatorio({
  formato,
  acoes,
  exercicio,
  receitaDe,
  baixando,
  onFechar,
  onConfirmar,
}: {
  formato: "docx" | "pdf" | null;
  acoes: AcaoRecuperacao[];
  exercicio: number | null;
  receitaDe: (ie: string | null | undefined) => RegistroReceita | undefined;
  baixando: boolean;
  onFechar: () => void;
  onConfirmar: (ies: string[]) => void;
}) {
  const [dataMovimento, setDataMovimento] = useState<string>(
    `${exercicio ?? new Date().getFullYear()}-12-31`,
  );
  /** IEs desmarcadas/marcadas manualmente (o restante segue a sugestão automática) */
  const [manuais, setManuais] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!formato) return;
    setManuais({});
    setDataMovimento(`${exercicio ?? new Date().getFullYear()}-12-31`);
  }, [formato, exercicio]);

  /** contribuintes citados no plano, sem repetição de IE */
  const linhas = useMemo(() => {
    const mapa = new Map<string, MovimentoDeclarante>();
    for (const a of acoes)
      for (const c of a.contribuintes)
        if (!mapa.has(c.inscricao_estadual)) mapa.set(c.inscricao_estadual, c);
    return [...mapa.values()];
  }, [acoes]);

  const encerradoAntes = (ie: string) => {
    const reg = receitaDe(ie);
    if (!reg || !SITUACOES_RECEITA_ENCERRADAS.includes(reg.situacao)) return false;
    if (!reg.situacao_data) return true;
    return reg.situacao_data < dataMovimento;
  };

  const linhasRelatorio = linhas.map((c) => {
    const reg = receitaDe(c.inscricao_estadual);
    const bloqueado = encerradoAntes(c.inscricao_estadual);
    const marcado = manuais[c.inscricao_estadual] ?? !bloqueado;
    return { c, reg, bloqueado, marcado };
  });
  const selecionadas = linhasRelatorio.filter((l) => l.marcado);
  const encerradosNaLista = linhasRelatorio.filter(
    (l) => l.reg && SITUACOES_RECEITA_ENCERRADAS.includes(l.reg.situacao),
  ).length;

  return (
    <Dialog open={!!formato} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Baixar a análise (.{formato ?? "docx"})</DialogTitle>
          <DialogDescription>
            Escolha quais contribuintes entram no relatório. Baixados/nulos na Receita Federal
            cuja baixa é anterior à data de referência do movimento já vêm desmarcados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="data-movimento-relatorio">Data de referência do movimento</Label>
            <Input
              id="data-movimento-relatorio"
              type="date"
              value={dataMovimento}
              onChange={(e) => setDataMovimento(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se a data da baixa for <strong>anterior</strong> ao movimento, o contribuinte não
              entra no relatório; se for <strong>posterior</strong>, ele permanece. Você pode
              marcar ou desmarcar qualquer um manualmente.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label>Contribuintes no relatório</Label>
              <span className="text-xs text-muted-foreground">
                {selecionadas.length}/{linhasRelatorio.length} incluído(s)
                {encerradosNaLista ? ` · ${encerradosNaLista} baixado(s)/nulo(s)` : ""}
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
              {linhasRelatorio.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum contribuinte listado nas ações deste plano.
                </p>
              ) : (
                linhasRelatorio.map(({ c, reg, bloqueado, marcado }) => (
                  <label
                    key={c.inscricao_estadual}
                    className="flex items-start gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(v) =>
                        setManuais((a) => ({ ...a, [c.inscricao_estadual]: v === true }))
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.nome ?? "(sem nome)"}</span>
                      <span className="block text-muted-foreground">
                        IE {c.inscricao_estadual}
                        {c.cnpj ? ` · ${formatarCnpj(c.cnpj)}` : ""}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2">
                        <ReceitaIeBadge registro={reg} cnpj={c.cnpj} />
                        <DataSituacaoRf registro={reg} />
                        {bloqueado ? (
                          <span className="text-destructive">
                            baixa anterior ao movimento — fora do relatório
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={baixando}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirmar(selecionadas.map(({ c }) => c.inscricao_estadual))}
            disabled={baixando || !selecionadas.length}
            className="gap-2"
          >
            {baixando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar {formato === "pdf" ? "PDF" : "DOCX"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogEmissao({
  acao,
  exercicio,
  receitaDe,
  onFechar,
  onEmitido,
}: {
  acao: AcaoRecuperacao | null;
  exercicio: number | null;
  receitaDe: (ie: string | null | undefined) => RegistroReceita | undefined;
  onFechar: () => void;
  onEmitido: (acao: AcaoRecuperacao, exercicio: number, ies: string[]) => void;
}) {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelos();
  const [chaveModelo, setChaveModelo] = useState<string>("");
  const [dataOficio, setDataOficio] = useState(hojeIso());
  const [ano, setAno] = useState<string>(String(exercicio ?? new Date().getFullYear()));
  const [progresso, setProgresso] = useState<ProgressoOficios | null>(null);
  /** data de referência do movimento: baixas anteriores a ela não recebem ofício */
  const [dataMovimento, setDataMovimento] = useState<string>(
    `${exercicio ?? new Date().getFullYear()}-12-31`,
  );
  /** IEs desmarcadas manualmente (o restante segue a sugestão automática) */
  const [manuais, setManuais] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setManuais({});
    setAno(String(exercicio ?? new Date().getFullYear()));
    setDataMovimento(`${exercicio ?? new Date().getFullYear()}-12-31`);
  }, [acao, exercicio]);

  /** baixado/nulo com data da baixa anterior ao movimento → fora do ofício por padrão */
  const encerradoAntes = (ie: string) => {
    const reg = receitaDe(ie);
    if (!reg || !SITUACOES_RECEITA_ENCERRADAS.includes(reg.situacao)) return false;
    if (!reg.situacao_data) return true;
    return reg.situacao_data < dataMovimento;
  };

  const linhasEmissao = (acao?.contribuintes ?? []).map((c) => {
    const reg = receitaDe(c.inscricao_estadual);
    const bloqueado = encerradoAntes(c.inscricao_estadual);
    const marcado = manuais[c.inscricao_estadual] ?? !bloqueado;
    return { c, reg, bloqueado, marcado };
  });
  const selecionadas = linhasEmissao.filter((l) => l.marcado);
  const encerradosNaLista = linhasEmissao.filter(
    (l) => l.reg && SITUACOES_RECEITA_ENCERRADAS.includes(l.reg.situacao),
  ).length;

  const ativos = (modelos ?? []).filter((m) => m.ativo);
  const sugeridos = acao?.situacaoOficio
    ? ativos.filter((m) => m.situacao === acao.situacaoOficio || m.situacao === "GERAL")
    : ativos;
  const disponiveis = sugeridos.length ? sugeridos : ativos;
  const modelo: ModeloOficio | null =
    disponiveis.find((m) => m.chave === chaveModelo) ?? disponiveis[0] ?? null;
  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;

  async function gerar() {
    if (!acao || !modelo || !config) return;
    const exercicioNum = Number(ano);
    if (!Number.isInteger(exercicioNum) || exercicioNum < 2000) {
      toast.error("Informe um exercício válido.");
      return;
    }
    if (!selecionadas.length) {
      toast.error("Selecione ao menos um contribuinte para emitir o ofício.");
      return;
    }
    try {
      setProgresso({ fase: "documentos", feitos: 0, total: selecionadas.length });
      const blob = await gerarZipOficios({
        contribuintes: selecionadas.map(({ c }) => ({
          nome: c.nome,
          cnpj: c.cnpj,
          inscricao_estadual: c.inscricao_estadual,
          endereco: null,
        })),
        modelo,
        config,
        exercicio: exercicioNum,
        dataOficio,
        brasaoPath: config.brasao_path ?? null,
        onProgresso: setProgresso,
      });
      baixarBlob(blob, nomeZip(modelo.chave, config.cidade_data, exercicioNum));
      toast.success(`${selecionadas.length} ofício(s) gerados.`);
      onEmitido(
        acao,
        exercicioNum,
        selecionadas.map(({ c }) => c.inscricao_estadual),
      );
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar os ofícios.");
    } finally {
      setProgresso(null);
    }
  }

  const pct =
    progresso && progresso.total > 0 ? Math.round((progresso.feitos / progresso.total) * 100) : 0;

  return (
    <Dialog open={!!acao} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir ofícios — {acao?.titulo}</DialogTitle>
          <DialogDescription>
            {selecionadas.length} de {acao?.contribuintes.length ?? 0} contribuinte(s) desta ação
            {acao?.situacaoOficio
              ? ` · situação sugerida: ${ROTULO_SITUACAO[acao.situacaoOficio]}`
              : ""}
            .
          </DialogDescription>
        </DialogHeader>

        {!configOk ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configuração incompleta</AlertTitle>
            <AlertDescription className="text-xs">
              Preencha os dados da prefeitura em Configurações antes de emitir ofícios.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Modelo de ofício</Label>
              <Select value={modelo?.chave ?? ""} onValueChange={setChaveModelo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {disponiveis.map((m) => (
                    <SelectItem key={m.chave} value={m.chave}>
                      {m.nome} · {ROTULO_SITUACAO[m.situacao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="exercicio-recuperacao">Exercício</Label>
                <Input
                  id="exercicio-recuperacao"
                  value={ano}
                  inputMode="numeric"
                  onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="data-recuperacao">Data do ofício</Label>
                <Input
                  id="data-recuperacao"
                  type="date"
                  value={dataOficio}
                  onChange={(e) => setDataOficio(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="data-movimento">Data de referência do movimento</Label>
              <Input
                id="data-movimento"
                type="date"
                value={dataMovimento}
                onChange={(e) => setDataMovimento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Contribuintes baixados ou nulos na Receita Federal com data da baixa{" "}
                <strong>anterior</strong> a esta data já saem desmarcados (não recebem ofício). Se a
                baixa for <strong>posterior</strong> ao movimento, o ofício continua marcado. Você
                pode marcar ou desmarcar qualquer um manualmente.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label>Contribuintes do ofício</Label>
                <span className="text-xs text-muted-foreground">
                  {selecionadas.length}/{linhasEmissao.length} selecionado(s)
                  {encerradosNaLista ? ` · ${encerradosNaLista} baixado(s)/nulo(s)` : ""}
                </span>
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {linhasEmissao.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum contribuinte nesta ação.</p>
                ) : (
                  linhasEmissao.map(({ c, reg, bloqueado, marcado }) => (
                    <label
                      key={c.inscricao_estadual}
                      className="flex items-start gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(v) =>
                          setManuais((a) => ({ ...a, [c.inscricao_estadual]: v === true }))
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.nome ?? "(sem nome)"}</span>
                        <span className="block text-muted-foreground">
                          IE {c.inscricao_estadual}
                          {c.cnpj ? ` · ${formatarCnpj(c.cnpj)}` : ""}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2">
                          <ReceitaIeBadge registro={reg} cnpj={c.cnpj} />
                          <DataSituacaoRf registro={reg} />
                          {bloqueado ? (
                            <span className="text-destructive">
                              baixa anterior ao movimento — fora do ofício e da análise
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {progresso && (
              <div className="space-y-1">
                <Progress value={progresso.fase === "compactando" ? 100 : pct} />
                <p className="text-xs text-muted-foreground">
                  {progresso.fase === "compactando"
                    ? "Compactando o pacote..."
                    : `Gerando ${progresso.feitos}/${progresso.total}${
                        progresso.nomeAtual ? ` — ${progresso.nomeAtual}` : ""
                      }`}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={gerar} disabled={!configOk || !modelo || !!progresso} className="gap-2">
            {progresso ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Gerar ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
