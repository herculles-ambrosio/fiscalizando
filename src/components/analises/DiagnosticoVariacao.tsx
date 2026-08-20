import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ClipboardCopy, Info, Lightbulb, Minus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarMoeda } from "@/lib/format";
import type { ArquivoEvolucao } from "@/lib/vaf/evolucao";
import {
  diagnosticarEvolucao,
  textoDiagnostico,
  type FatorVariacao,
} from "@/lib/vaf/diagnostico";

function Barra({ fator }: { fator: FatorVariacao }) {
  const positivo = fator.sentido === "aumentou";
  const Icone = fator.sentido === "neutro" ? Minus : positivo ? ArrowUpRight : ArrowDownRight;
  const cor = fator.sentido === "neutro"
    ? "text-muted-foreground"
    : positivo
      ? "text-emerald-600"
      : "text-destructive";
  const fundo = positivo ? "bg-emerald-500/70" : "bg-destructive/70";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium">{fator.rotulo}</p>
        <p className={`inline-flex items-center gap-1 font-mono text-sm ${cor}`}>
          <Icone className="h-3.5 w-3.5" />
          {formatarMoeda(fator.impacto)}
          <span className="text-xs text-muted-foreground">
            ({fator.peso.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
          </span>
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${fundo}`} style={{ width: `${Math.min(100, fator.peso)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{fator.detalhe}</p>
    </div>
  );
}

export default function DiagnosticoVariacao({
  base,
  atual,
  rotuloBase,
  rotuloAtual,
}: {
  base: ArquivoEvolucao;
  atual: ArquivoEvolucao;
  rotuloBase: string;
  rotuloAtual: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const d = useMemo(() => diagnosticarEvolucao(base, atual), [base, atual]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoDiagnostico(d, rotuloBase, rotuloAtual));
      setCopiado(true);
      toast.success("Análise copiada para a área de transferência.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar a análise.");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" />
            Por que variou
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Análise automática da diferença entre {rotuloBase} e {rotuloAtual}.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={copiar}>
          <ClipboardCopy className="h-4 w-4" />
          {copiado ? "Copiado" : "Copiar análise"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed">{d.resumo}</p>

        <Tabs defaultValue="declarantes">
          <TabsList className="flex-wrap">
            <TabsTrigger value="declarantes">Por declarantes</TabsTrigger>
            <TabsTrigger value="componentes">Por componente do VAF</TabsTrigger>
            <TabsTrigger value="contribuintes">Maiores impactos</TabsTrigger>
          </TabsList>

          <TabsContent value="declarantes" className="space-y-3 pt-3">
            {d.fatoresDeclarantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentação relevante.</p>
            ) : (
              d.fatoresDeclarantes.map((f) => <Barra key={f.chave} fator={f} />)
            )}
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Soma dos fatores = variação total do valor líquido:{" "}
              <span className="font-mono">{formatarMoeda(d.diferenca)}</span>
            </p>
          </TabsContent>

          <TabsContent value="componentes" className="space-y-3 pt-3">
            {d.fatores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum componente do valor líquido variou.
              </p>
            ) : (
              d.fatores.map((f) => <Barra key={f.chave} fator={f} />)
            )}
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Valor líquido = VAF próprio + crédito externo + crédito interno + crédito próprio −
              débito + acerto de crédito − acerto de débito.
            </p>
          </TabsContent>

          <TabsContent value="contribuintes" className="grid gap-4 pt-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Maiores quedas
              </p>
              {d.topQuedas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma queda registrada.</p>
              ) : (
                d.topQuedas.map((c) => (
                  <div
                    key={`q-${c.inscricao_estadual}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.nome ?? "(sem nome)"}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        IE {c.inscricao_estadual}
                        {c.situacao === "saiu" ? " · deixou de declarar" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-destructive">
                      {formatarMoeda(c.diferenca)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Maiores altas
              </p>
              {d.topAltas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alta registrada.</p>
              ) : (
                d.topAltas.map((c) => (
                  <div
                    key={`a-${c.inscricao_estadual}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.nome ?? "(sem nome)"}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        IE {c.inscricao_estadual}
                        {c.situacao === "entrou" ? " · novo declarante" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-emerald-600">
                      {formatarMoeda(c.diferenca)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <Info className="h-3.5 w-3.5" />
            Conclusão
          </p>
          <p className="mt-1 text-sm">{d.conclusao}</p>
        </div>

        {d.alertas.length > 0 && (
          <Alert>
            <AlertTitle className="text-sm">Ressalvas de comparabilidade</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                {d.alertas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            Base: {formatarMoeda(d.valorBase)}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            Comparado/estimado: {formatarMoeda(d.valorAtual)}
          </Badge>
          <Badge
            variant="outline"
            className={`font-mono text-xs ${
              d.sentido === "reduziu" ? "text-destructive" : d.sentido === "aumentou" ? "text-emerald-600" : ""
            }`}
          >
            Diferença: {formatarMoeda(d.diferenca)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
