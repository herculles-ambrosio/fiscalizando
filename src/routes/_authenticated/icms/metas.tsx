import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { VazioIcms } from "@/components/icms/VazioIcms";
import { useIcmsDados, useIcmsExercicios } from "@/hooks/useIcms";
import { montarMetas, ROTULO_STATUS_META, type StatusMeta } from "@/lib/icms/metas";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/icms/metas")({
  head: () => ({
    meta: [
      { title: "Metas por critério — ICMS Robin Hood" },
      {
        name: "description",
        content:
          "Quanto o município precisa de cada critério da Lei 18.030/2009 para atingir o percentual previsto na lei, com status e valor em reais.",
      },
      { property: "og:title", content: "Metas por critério — ICMS Robin Hood" },
      {
        property: "og:description",
        content: "Painel de metas do ICMS: percentual da lei, realizado e o que falta por critério.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetasIcms,
});

const COR_STATUS: Record<StatusMeta, string> = {
  atingida: "bg-emerald-100 text-emerald-800 border-emerald-200",
  proxima: "bg-amber-100 text-amber-800 border-amber-200",
  abaixo: "bg-orange-100 text-orange-800 border-orange-200",
  zerada: "bg-red-100 text-red-800 border-red-200",
  sem_meta: "bg-muted text-muted-foreground",
};

function MetasIcms() {
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0] ?? null);
    }
  }, [exercicios, exercicio]);

  const { data: dados } = useIcmsDados(exercicio);
  const painel = useMemo(
    () => (dados && exercicio ? montarMetas(dados, exercicio) : null),
    [dados, exercicio],
  );

  // Modo de conferência: /icms/metas?debug=1
  const [depurar, setDepurar] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDepurar(new URLSearchParams(window.location.search).get("debug") === "1");
    }
  }, []);


  if (exercicios && !exercicios.length) {
    return (
      <VazioIcms mensagem="Ainda não há dados do ICMS. Sincronize com o portal Robin Hood ou importe os extratos na tela de Cargas." />
    );
  }
  if (!painel) return null;

  function exportar() {
    if (!painel) return;
    baixarCsv(
      `metas-icms-${painel.exercicio}.csv`,
      montarCsv(
        [
          "Critério",
          "Índice do critério (FJP)",
          "% da lei (informativo)",
          "% realizado",
          "Meta (R$)",
          "Recebido (R$)",
          "Falta (R$)",
          "Falta (pontos de índice)",
          "Status",
          "Órgão",
        ],
        painel.linhas.map((l) => [
          l.criterio.nome,
          l.indiceCriterio?.toFixed(7) ?? "",
          l.pesoLegalPct ?? "",
          l.realPct.toFixed(4),
          l.metaValor?.toFixed(2) ?? "",
          l.valorAno.toFixed(2),
          l.faltaValor.toFixed(2),
          l.faltaIndice?.toFixed(6) ?? "",
          ROTULO_STATUS_META[l.status],
          l.criterio.orgao,
        ]),
      ),
    );
  }


  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Metas por critério</h1>
          <p className="text-sm text-muted-foreground">
            O que o município precisa em cada critério para alcançar o percentual que a Lei
            18.030/2009 destina a ele.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <SeletorExercicio
            exercicios={exercicios ?? []}
            valor={exercicio}
            aoTrocar={setExercicio}
          />
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Repasse no exercício
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {formatarMoeda(painel.totalAno)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Metas atingidas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {painel.atingidas} de {painel.comMeta}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Potencial a recuperar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-emerald-700">
            {formatarMoeda(painel.potencialTotal)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Valor de 1 ponto de índice
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {painel.valorPorPontoIndice ? formatarMoeda(painel.valorPorPontoIndice) : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Situação de cada critério
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Critério</TableHead>
                <TableHead className="text-right">Índice do critério</TableHead>
                <TableHead className="text-right">% realizado</TableHead>

                <TableHead className="w-40">Cumprimento</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">Falta</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {painel.linhas.map((l) => (
                <TableRow key={l.criterio.slug}>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help font-medium">{l.criterio.nome}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm space-y-1">
                        <p>{l.criterio.oQueMede}</p>
                        <p className="text-xs opacity-80">
                          {l.criterio.orgao} — {l.criterio.periodicidade}
                        </p>
                        {l.recomendacoes[0] && (
                          <p className="text-xs opacity-80">{l.recomendacoes[0]}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    {l.estrutural && (
                      <span className="ml-2 text-xs text-muted-foreground">(estrutural)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.indiceCriterio != null
                      ? l.indiceCriterio.toLocaleString("pt-BR", { maximumFractionDigits: 7 })
                      : "—"}
                  </TableCell>

                  <TableCell className="text-right">
                    {l.realPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                  </TableCell>
                  <TableCell>
                    {l.cumprimento != null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(l.cumprimento * 100, 100)} className="h-2" />
                        <span className="w-10 text-right text-xs text-muted-foreground">
                          {Math.round(l.cumprimento * 100)}%
                        </span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {l.metaValor != null ? formatarMoeda(l.metaValor) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatarMoeda(l.valorAno)}</TableCell>
                  <TableCell className="text-right">
                    {l.faltaValor > 0 ? (
                      <span className="font-medium text-orange-700">
                        {formatarMoeda(l.faltaValor)}
                        {l.faltaIndice != null && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {l.faltaIndice.toLocaleString("pt-BR", { maximumFractionDigits: 5 })}{" "}
                            pontos
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={COR_STATUS[l.status]}>
                      {ROTULO_STATUS_META[l.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            A meta de cada critério é o índice de participação do município naquele critério
            (publicado pela FJP) multiplicado pelo peso do Anexo I da Lei 18.030/2009 e pelo valor
            de 1 ponto de índice do exercício. A meta não usa o repasse total do próprio município
            como base. Critérios estruturais (cota
            mínima, área, municípios mineradores) ficam fora do potencial a recuperar.
          </p>
        </CardContent>
      </Card>

      {depurar && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Depuração do cálculo da meta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              Valor do ponto de índice: {painel.valorPorPontoIndice ?? "—"} (
              {painel.origemValorPonto ?? "sem origem"}). Peso legal aplicado: sim. Quando
              meta ÷ recebido ficar perto de 1, a fórmula está aderente ao repasse real.
            </p>
            <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(painel.depuracao, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

    </div>
    </TooltipProvider>
  );
}
