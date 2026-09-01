import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { VazioIcms } from "@/components/icms/VazioIcms";
import {
  useApagarAcao,
  useIcmsAcoes,
  useIcmsDados,
  useIcmsExercicios,
  useSalvarAcao,
  type AcaoIcms,
} from "@/hooks/useIcms";
import { montarDiagnostico } from "@/lib/icms/diagnostico";
import { formatarMoeda } from "@/lib/format";

const STATUS: { valor: AcaoIcms["status"]; rotulo: string }[] = [
  { valor: "prevista", rotulo: "Prevista" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "concluida", rotulo: "Concluída" },
  { valor: "descartada", rotulo: "Descartada" },
];

export const Route = createFileRoute("/_authenticated/icms/plano")({
  head: () => ({
    meta: [
      { title: "Plano de melhoria do ICMS" },
      {
        name: "description",
        content:
          "Ações por critério para recuperar índice de participação e aumentar o repasse de ICMS do município.",
      },
      { property: "og:title", content: "Plano de melhoria do ICMS" },
      {
        property: "og:description",
        content: "Acompanhe as ações de melhoria em cada critério da Lei Robin Hood.",
      },
    ],
  }),
  component: PlanoIcms,
});

function PlanoIcms() {
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0]);
    }
  }, [exercicios, exercicio]);

  const { data: dados } = useIcmsDados(exercicio);
  const { data: acoes } = useIcmsAcoes(exercicio);
  const salvar = useSalvarAcao();
  const apagar = useApagarAcao();

  const diag = useMemo(
    () => (dados && exercicio ? montarDiagnostico(dados, exercicio) : null),
    [dados, exercicio],
  );

  const sugestoes = useMemo(() => {
    if (!diag) return [];
    return [...diag.oportunidades, ...diag.quedas].flatMap((l) =>
      l.criterio.comoMelhorar.map((titulo) => ({
        criterio: l.criterio.slug,
        nomeCriterio: l.criterio.nome,
        titulo,
        orgao: l.criterio.orgao,
        impacto: l.potencialAnual,
      })),
    );
  }, [diag]);

  if (dados && !dados.series.size) return <VazioIcms />;

  const jaAdicionada = (criterio: string, titulo: string) =>
    (acoes ?? []).some((a) => a.criterio === criterio && a.titulo === titulo);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Plano de melhoria do ICMS</h1>
          <p className="text-sm text-muted-foreground">
            Ações sugeridas a partir dos critérios zerados ou em queda, com acompanhamento de
            status.
          </p>
        </div>
        <SeletorExercicio exercicios={exercicios ?? []} valor={exercicio} aoTrocar={setExercicio} />
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ações sugeridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!sugestoes.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum critério zerado ou em queda no exercício selecionado.
            </p>
          )}
          {sugestoes.map((s) => (
            <div
              key={`${s.criterio}-${s.titulo}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm">{s.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {s.nomeCriterio} · {s.orgao}
                  {s.impacto ? ` · potencial ${formatarMoeda(s.impacto)}/ano` : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!exercicio || jaAdicionada(s.criterio, s.titulo)}
                onClick={() =>
                  salvar.mutate(
                    {
                      exercicio: exercicio!,
                      criterio: s.criterio,
                      titulo: s.titulo,
                      orgao: s.orgao,
                      impacto_estimado: s.impacto,
                      status: "prevista",
                    },
                    { onSuccess: () => toast.success("Ação incluída no plano.") },
                  )
                }
              >
                <Plus className="h-4 w-4" />
                {jaAdicionada(s.criterio, s.titulo) ? "No plano" : "Incluir"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Plano em execução</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {STATUS.find((s) => s.valor === a.status)?.rotulo ?? a.status}
                  </Badge>
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
        </CardContent>
      </Card>
    </div>
  );
}
