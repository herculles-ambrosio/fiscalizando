import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  FileText,
  Loader2,
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

const CORES_PRIORIDADE: Record<AcaoRecuperacao["prioridade"], string> = {
  alta: "border-destructive/40 bg-destructive/10 text-destructive",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baixa: "border-border bg-muted text-muted-foreground",
};

type Props = {
  diagnostico: DiagnosticoEvolucao;
  declarantes: ComparacaoDeclarantes;
  exercicio?: number | null;
};

export default function PlanoRecuperacao({ diagnostico, declarantes, exercicio }: Props) {
  const acoes = useMemo(
    () => montarPlanoRecuperacao(diagnostico, declarantes, { exercicio: exercicio ?? null }),
    [diagnostico, declarantes, exercicio],
  );
  const [acaoEmissao, setAcaoEmissao] = useState<AcaoRecuperacao | null>(null);

  const totalPotencial = acoes.reduce((s, a) => s + a.valorRecuperavel, 0);

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

          <div className="space-y-3">
            {acoes.map((acao, i) => (
              <ItemAcao
                key={acao.chave}
                acao={acao}
                ordem={i + 1}
                onEmitir={() => setAcaoEmissao(acao)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <DialogEmissao
        acao={acaoEmissao}
        exercicio={exercicio ?? null}
        onFechar={() => setAcaoEmissao(null)}
      />
    </>
  );
}

function ItemAcao({
  acao,
  ordem,
  onEmitir,
}: {
  acao: AcaoRecuperacao;
  ordem: number;
  onEmitir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const temLista = acao.contribuintes.length > 0;

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
          <Badge variant="outline" className={CORES_PRIORIDADE[acao.prioridade]}>
            {ROTULO_PRIORIDADE[acao.prioridade]}
          </Badge>
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
    </div>
  );
}

function DialogEmissao({
  acao,
  exercicio,
  onFechar,
}: {
  acao: AcaoRecuperacao | null;
  exercicio: number | null;
  onFechar: () => void;
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
