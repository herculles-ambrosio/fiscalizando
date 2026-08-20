import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Loader2,
  Paperclip,
  Target,
} from "lucide-react";

import { toast } from "sonner";
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
import { useModelos } from "@/hooks/useModelos";
import { baixarBlob, gerarZipOficios, nomeZip, type ProgressoOficios } from "@/lib/oficios/pacote";
import { ROTULO_SITUACAO, type ModeloOficio } from "@/lib/oficios/modelos";
import { hojeIso } from "@/lib/oficios/texto";
import {
  montarPlanoRecuperacao,
  textoPlanoRecuperacao,
  ROTULO_PRIORIDADE,
  type AcaoRecuperacao,
} from "@/lib/vaf/recuperacao";
import type { DiagnosticoEvolucao } from "@/lib/vaf/diagnostico";
import type { ComparacaoDeclarantes } from "@/lib/vaf/evolucao";
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


const CORES_PRIORIDADE: Record<AcaoRecuperacao["prioridade"], string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baixa: "border-border bg-muted text-muted-foreground",
};

type Props = {
  diagnostico: DiagnosticoEvolucao;
  declarantes: ComparacaoDeclarantes;
  exercicio?: number | null;
  /** Identificador estável da análise (arquivos comparados) para gravar o acompanhamento. */
  referencia?: string | null;
  cargaId?: string | null;
};

export type SalvarStatus = (entradas: EntradaStatus | EntradaStatus[]) => void;

export default function PlanoRecuperacao({
  diagnostico,
  declarantes,
  exercicio,
  referencia,
  cargaId,
}: Props) {
  const acoes = useMemo(
    () => montarPlanoRecuperacao(diagnostico, declarantes, { exercicio: exercicio ?? null }),
    [diagnostico, declarantes, exercicio],
  );
  const [acaoEmissao, setAcaoEmissao] = useState<AcaoRecuperacao | null>(null);

  const ref = referencia ?? null;
  const { data: registros } = useAcoesRecuperacao(ref);
  const salvar = useSalvarStatusAcao();

  const statusPorChave = useMemo(() => {
    const m = new Map<string, StatusAcao>();
    for (const r of registros ?? []) m.set(chaveStatus(r.acao_chave, r.inscricao_estadual), r.status);
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


  const totalPotencial = acoes.reduce((s, a) => s + a.valorRecuperavel, 0);
  const concluidas = acoes.filter(
    (a) => statusPorChave.get(chaveStatus(a.chave)) === "concluida",
  ).length;
  const emAndamento = acoes.filter((a) => {
    const s = statusPorChave.get(chaveStatus(a.chave));
    return s === "oficio_enviado" || s === "resposta_recebida";
  }).length;

  function copiar() {
    void navigator.clipboard
      .writeText(textoPlanoRecuperacao(acoes))
      .then(() => toast.success("Plano de recuperação copiado."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              O que fazer para recuperar
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Ações sugeridas a partir dos fatores da variação, ordenadas por prioridade e valor
              potencialmente recuperável.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={copiar}>
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copiar plano
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Potencial mapeado: {formatarMoeda(totalPotencial)}</AlertTitle>
            <AlertDescription className="text-xs">
              O valor soma o que cada ação pode recuperar ou preservar. Ele não é cumulativo com o
              índice já publicado: parte depende de retificação dentro do prazo da SEFAZ.
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

          <div className="space-y-3">
            {acoes.map((acao, i) => (
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
              />

            ))}
          </div>
        </CardContent>
      </Card>

      <DialogEmissao
        acao={acaoEmissao}
        exercicio={exercicio ?? null}
        onFechar={() => setAcaoEmissao(null)}
        onEmitido={(acao, exercicioNum) => {
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
            ...acao.contribuintes.map((c) => ({
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
}) {
  const [aberto, setAberto] = useState(false);
  /** null = fechado; "" = anotação da ação; IE = anotação do contribuinte */
  const [anotando, setAnotando] = useState<string | null>(null);
  const temLista = acao.contribuintes.length > 0;
  const statusAcao = statusPorChave.get(chaveStatus(acao.chave)) ?? "prevista";
  const contribuinteAnotado =
    anotando ? acao.contribuintes.find((c) => c.inscricao_estadual === anotando) ?? null : null;


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
          <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs" onClick={onEmitir}>
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
                    <TableHead>Contribuinte</TableHead>
                    <TableHead className="text-right">VAF base</TableHead>
                    <TableHead className="text-right">Comparado/estimado</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acao.contribuintes.slice(0, 25).map((c) => (
                    <TableRow key={c.inscricao_estadual}>
                      <TableCell className="text-xs">
                        <p className="font-medium">{c.nome ?? "(sem nome)"}</p>
                        <p className="text-muted-foreground">
                          IE {c.inscricao_estadual}
                          {c.cnpj ? ` · ${formatarCnpj(c.cnpj)}` : ""}
                        </p>
                        {obsPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual)) && (
                          <p className="mt-1 text-muted-foreground italic">
                            {obsPorChave.get(chaveStatus(acao.chave, c.inscricao_estadual))}
                          </p>
                        )}
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
                  Exibindo os 25 maiores de {acao.contribuintes.length} — a lista completa vai no CSV
                  da evolução.
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
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
            status:
              statusPorChave.get(chaveStatus(acao.chave, anotando ?? "")) ?? "prevista",
          })
        }
      />
    </div>

  );
}

function DialogEmissao({
  acao,
  exercicio,
  onFechar,
  onEmitido,
}: {
  acao: AcaoRecuperacao | null;
  exercicio: number | null;
  onFechar: () => void;
  onEmitido: (acao: AcaoRecuperacao, exercicio: number) => void;
}) {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelos();
  const [chaveModelo, setChaveModelo] = useState<string>("");
  const [dataOficio, setDataOficio] = useState(hojeIso());
  const [ano, setAno] = useState<string>(String(exercicio ?? new Date().getFullYear()));
  const [progresso, setProgresso] = useState<ProgressoOficios | null>(null);

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
    try {
      setProgresso({ fase: "documentos", feitos: 0, total: acao.contribuintes.length });
      const blob = await gerarZipOficios({
        contribuintes: acao.contribuintes.map((c) => ({
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
      toast.success(`${acao.contribuintes.length} ofício(s) gerados.`);
      onEmitido(acao, exercicioNum);
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar os ofícios.");
    } finally {
      setProgresso(null);
    }
  }

  const pct =
    progresso && progresso.total > 0
      ? Math.round((progresso.feitos / progresso.total) * 100)
      : 0;

  return (
    <Dialog open={!!acao} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir ofícios — {acao?.titulo}</DialogTitle>
          <DialogDescription>
            {acao?.contribuintes.length ?? 0} contribuinte(s) desta ação
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
