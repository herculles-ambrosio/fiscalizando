import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Trash2, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { VazioIcms } from "@/components/icms/VazioIcms";
import {
  useApagarAcao,
  useIcmsAcoes,
  useIcmsChecklist,
  useIcmsDados,
  useIcmsExercicios,
  useSalvarAcao,
  useSalvarChecklist,
  type AcaoIcms,
} from "@/hooks/useIcms";
import {
  maioresOportunidades,
  montarPontuacao,
  ROTULO_ITEM,
  type BlocoPontuacao,
  type LinhaItemPontuacao,
  type SituacaoItem,
} from "@/lib/icms/pontuacao";
import { baixarCsv } from "@/lib/csv";
import { formatarMoeda } from "@/lib/format";

const STATUS: { valor: AcaoIcms["status"]; rotulo: string }[] = [
  { valor: "prevista", rotulo: "Prevista" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "concluida", rotulo: "Concluída" },
  { valor: "descartada", rotulo: "Descartada" },
];

const SITUACOES: SituacaoItem[] = [
  "nao_avaliado",
  "atende",
  "parcial",
  "nao_atende",
  "nao_se_aplica",
];

const COR_SITUACAO: Record<SituacaoItem, string> = {
  atende: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  parcial: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  nao_atende: "border-destructive/40 bg-destructive/10 text-destructive",
  nao_se_aplica: "border-border bg-muted text-muted-foreground",
  nao_avaliado: "border-border bg-muted text-muted-foreground",
};

export const Route = createFileRoute("/_authenticated/icms/plano")({
  head: () => ({
    meta: [
      { title: "Plano de melhoria do ICMS por pontuação" },
      {
        name: "description",
        content:
          "Checklist dos itens pontuáveis da Lei 18.030/2009: o que o município já pontua, o que falta lançar e quanto isso vale em reais.",
      },
      { property: "og:title", content: "Plano de melhoria do ICMS por pontuação" },
      {
        property: "og:description",
        content:
          "Avalie item a item os quadros da Lei Robin Hood e transforme as lacunas em ações com prazo e responsável.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanoIcms,
});

function PlanoIcms() {
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0] ?? null);
    }
  }, [exercicios, exercicio]);

  const { data: dados } = useIcmsDados(exercicio);
  const { data: checklist } = useIcmsChecklist(exercicio);
  const { data: acoes } = useIcmsAcoes(exercicio);
  const salvarItem = useSalvarChecklist();
  const salvar = useSalvarAcao();
  const apagar = useApagarAcao();

  const painel = useMemo(
    () =>
      dados && exercicio
        ? montarPontuacao(dados, exercicio, (checklist ?? []).map((r) => ({ ...r })))
        : null,
    [dados, exercicio, checklist],
  );

  const oportunidades = useMemo(
    () => (painel ? maioresOportunidades(painel, 10) : []),
    [painel],
  );

  if (dados && !dados.series.size) return <VazioIcms />;

  const jaNoPlano = (criterio: string, codigo: string) =>
    (acoes ?? []).some((a) => a.criterio === criterio && a.item_codigo === codigo);

  const incluirAcao = (bloco: BlocoPontuacao, linha: LinhaItemPontuacao) => {
    if (!exercicio) return;
    salvar.mutate(
      {
        exercicio,
        criterio: bloco.criterio.slug,
        item_codigo: linha.item.codigo,
        titulo: `${linha.item.codigo} — ${linha.item.titulo}`,
        descricao: `${linha.item.ondeLancar}. Prazo: ${linha.item.prazo}. Comprovar: ${linha.item.documentos.join("; ")}.`,
        orgao: bloco.criterio.orgao,
        impacto_estimado: linha.potencial || null,
        status: "prevista",
      },
      { onSuccess: () => toast.success("Ação incluída no plano.") },
    );
  };

  const exportarCsv = () => {
    if (!painel) return;
    baixarCsv(
      `plano-icms-${painel.exercicio}.csv`,
      painel.blocos.flatMap((b) =>
        b.linhas.map((l) => ({
          Critério: b.criterio.nome,
          Item: l.item.codigo,
          Descrição: l.item.titulo,
          Nota: l.item.nota ?? "",
          "Parcela (%)": l.item.parcelaPct ?? "",
          Situação: ROTULO_ITEM[l.situacao],
          "Onde lançar": l.item.ondeLancar,
          Prazo: l.item.prazo,
          Documentos: l.item.documentos.join("; "),
          "Potencial R$/ano": l.potencial ? l.potencial.toFixed(2) : "",
          Observação: l.registro?.observacao ?? "",
        })),
      ),
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Plano de melhoria do ICMS</h1>
            <p className="text-sm text-muted-foreground">
              Cada critério da Lei 18.030/2009 tem um quadro de itens pontuáveis. Marque o que o
              município já faz e o sistema mostra a nota perdida, onde lançar e quanto vale.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!painel}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <SeletorExercicio
              exercicios={exercicios ?? []}
              valor={exercicio}
              aoTrocar={setExercicio}
            />
          </div>
        </header>

        {painel && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Potencial estimado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold">
                  {formatarMoeda(painel.potencialTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  por ano, se os critérios chegarem ao percentual do Anexo I
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Itens pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold">
                  {painel.itensPendentes}
                  <span className="text-base text-muted-foreground"> / {painel.itensTotal}</span>
                </p>
                <p className="text-xs text-muted-foreground">itens sem pontuação plena</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Ações no plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold">{acoes?.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">
                  {(acoes ?? []).filter((a) => a.status === "concluida").length} concluídas
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="oportunidades">
          <TabsList>
            <TabsTrigger value="oportunidades">Onde ganhar mais</TabsTrigger>
            <TabsTrigger value="checklist">Checklist por critério</TabsTrigger>
            <TabsTrigger value="plano">Plano em execução</TabsTrigger>
          </TabsList>

          <TabsContent value="oportunidades" className="mt-4 space-y-2">
            {!oportunidades.length && (
              <p className="text-sm text-muted-foreground">
                Nada pendente nos quadros avaliados — comece marcando os itens no checklist.
              </p>
            )}
            {oportunidades.map(({ bloco, linha }) => (
              <div
                key={`${bloco.criterio.slug}-${linha.item.codigo}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">
                    {linha.item.codigo} — {linha.item.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bloco.criterio.nome} · {linha.item.ondeLancar} · prazo: {linha.item.prazo}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className={COR_SITUACAO[linha.situacao]}>
                      {ROTULO_ITEM[linha.situacao]}
                    </Badge>
                    {linha.item.nota != null && (
                      <Badge variant="secondary">nota {linha.item.nota.toLocaleString("pt-BR")}</Badge>
                    )}
                    {linha.potencial > 0 && (
                      <Badge variant="secondary">
                        até {formatarMoeda(linha.potencial)}/ano
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!exercicio || jaNoPlano(bloco.criterio.slug, linha.item.codigo)}
                  onClick={() => incluirAcao(bloco, linha)}
                >
                  <Plus className="h-4 w-4" />
                  {jaNoPlano(bloco.criterio.slug, linha.item.codigo) ? "No plano" : "Incluir"}
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="checklist" className="mt-4">
            <Accordion type="multiple" className="space-y-2">
              {painel?.blocos.map((bloco) => (
                <AccordionItem
                  key={bloco.criterio.slug}
                  value={bloco.criterio.slug}
                  className="rounded-lg border border-border px-3"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-wrap items-center justify-between gap-3 pr-3 text-left">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{bloco.criterio.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {bloco.criterio.baseLegal} · {bloco.criterio.orgao}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-28">
                          <Progress value={Math.round(bloco.aproveitamento * 100)} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(bloco.aproveitamento * 100)}% da nota
                        </span>
                        {bloco.potencial > 0 && (
                          <Badge variant="secondary">
                            {formatarMoeda(bloco.potencial)}/ano
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-4">
                    <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                      {bloco.quadro.formula}
                    </p>
                    {bloco.linhas.map((linha) => (
                      <ItemChecklist
                        key={linha.item.codigo}
                        bloco={bloco}
                        linha={linha}
                        onSituacao={(situacao) =>
                          exercicio &&
                          salvarItem.mutate({
                            exercicio,
                            criterio: bloco.criterio.slug,
                            item_codigo: linha.item.codigo,
                            situacao,
                          })
                        }
                        onObservacao={(observacao) =>
                          exercicio &&
                          salvarItem.mutate({
                            exercicio,
                            criterio: bloco.criterio.slug,
                            item_codigo: linha.item.codigo,
                            situacao: linha.situacao,
                            observacao,
                          })
                        }
                        onResponsavel={(responsavel) =>
                          exercicio &&
                          salvarItem.mutate({
                            exercicio,
                            criterio: bloco.criterio.slug,
                            item_codigo: linha.item.codigo,
                            situacao: linha.situacao,
                            responsavel,
                          })
                        }
                        noPlano={jaNoPlano(bloco.criterio.slug, linha.item.codigo)}
                        onIncluir={() => incluirAcao(bloco, linha)}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="plano" className="mt-4 space-y-3">
            {!acoes?.length && (
              <p className="text-sm text-muted-foreground">Nenhuma ação no plano ainda.</p>
            )}
            {acoes?.map((a) => (
              <div key={a.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.orgao ?? "—"}
                      {a.impacto_estimado
                        ? ` · potencial ${formatarMoeda(a.impacto_estimado)}/ano`
                        : ""}
                    </p>
                    {a.descricao && (
                      <p className="pt-1 text-xs text-muted-foreground">{a.descricao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={a.status}
                      onValueChange={(v) =>
                        salvar.mutate({
                          id: a.id,
                          exercicio: a.exercicio,
                          criterio: a.criterio,
                          titulo: a.titulo,
                          status: v as AcaoIcms["status"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => (
                          <SelectItem key={s.valor} value={s.valor}>
                            {s.rotulo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => apagar.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  defaultValue={a.observacao ?? ""}
                  placeholder="Observações, responsável, prazo…"
                  className="min-h-16 text-sm"
                  onBlur={(e) => {
                    if (e.target.value === (a.observacao ?? "")) return;
                    salvar.mutate({
                      id: a.id,
                      exercicio: a.exercicio,
                      criterio: a.criterio,
                      titulo: a.titulo,
                      observacao: e.target.value,
                    });
                  }}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function ItemChecklist({
  bloco,
  linha,
  onSituacao,
  onObservacao,
  onResponsavel,
  noPlano,
  onIncluir,
}: {
  bloco: BlocoPontuacao;
  linha: LinhaItemPontuacao;
  onSituacao: (s: SituacaoItem) => void;
  onObservacao: (v: string) => void;
  onResponsavel: (v: string) => void;
  noPlano: boolean;
  onIncluir: () => void;
}) {
  const { item } = linha;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {item.codigo} — {item.titulo}
            {item.detalhe && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{item.detalhe}</TooltipContent>
              </Tooltip>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.nota != null
              ? `Nota ${item.nota.toLocaleString("pt-BR")}`
              : item.parcelaPct != null
                ? `Parcela de ${item.parcelaPct}% do critério`
                : "Compõe o indicador"}{" "}
            · {item.ondeLancar} · prazo: {item.prazo}
          </p>
          <p className="flex items-start gap-1 pt-1 text-xs text-muted-foreground">
            <FileText className="mt-0.5 h-3 w-3 shrink-0" />
            {item.documentos.join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={linha.situacao} onValueChange={(v) => onSituacao(v as SituacaoItem)}>
            <SelectTrigger className={`h-8 w-40 text-xs ${COR_SITUACAO[linha.situacao]}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ROTULO_ITEM[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={noPlano} onClick={onIncluir}>
            <Plus className="h-4 w-4" />
            {noPlano ? "No plano" : "Ação"}
          </Button>
        </div>
      </div>
      {linha.potencial > 0 && linha.situacao !== "atende" && (
        <p className="text-xs text-muted-foreground">
          Pontuar este item vale até{" "}
          <span className="font-medium text-foreground">{formatarMoeda(linha.potencial)}</span> por
          ano em {bloco.criterio.nome}.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <Textarea
          defaultValue={linha.registro?.observacao ?? ""}
          placeholder="O que já existe, o que falta, nº do processo…"
          className="min-h-14 text-sm"
          onBlur={(e) => {
            if (e.target.value === (linha.registro?.observacao ?? "")) return;
            onObservacao(e.target.value);
          }}
        />
        <Input
          defaultValue={linha.registro?.responsavel ?? ""}
          placeholder="Responsável / secretaria"
          className="h-9 text-sm"
          onBlur={(e) => {
            if (e.target.value === (linha.registro?.responsavel ?? "")) return;
            onResponsavel(e.target.value);
          }}
        />
      </div>
    </div>
  );
}
