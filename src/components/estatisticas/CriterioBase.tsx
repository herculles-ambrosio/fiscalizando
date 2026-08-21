import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  anoDaCarga,
  periodoDaCarga,
  remessaDaCarga,
  type CargaEstat,
} from "@/lib/vaf/estatisticas";

const NOME_TIPO: Record<string, string> = {
  mensal: "Mensal",
  provisorio: "Provisório",
  definitivo: "Definitivo",
  indice_definitivo: "Índice definitivo",
};

function rotuloTipo(tipo: string | null): string {
  return NOME_TIPO[tipo ?? ""] ?? (tipo ?? "—");
}

/**
 * Explica, na própria tela, qual é o critério temporal das estatísticas:
 * quais apurações (exercícios) e quais remessas entram em cada gráfico.
 */
export function CriterioBase({
  cargas,
  anoSelecionado = null,
  contexto,
}: {
  cargas: CargaEstat[];
  anoSelecionado?: number | null;
  contexto: string;
}) {
  const [aberto, setAberto] = useState(false);

  const porAno = useMemo(() => {
    const mapa = new Map<number, CargaEstat[]>();
    for (const c of cargas) {
      const ano = anoDaCarga(c);
      mapa.set(ano, [...(mapa.get(ano) ?? []), c]);
    }
    return [...mapa.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([ano, lista]) => ({
        ano,
        cargas: lista.sort(
          (a, b) => (remessaDaCarga(a) ?? 99) - (remessaDaCarga(b) ?? 99),
        ),
      }));
  }, [cargas]);

  const anos = porAno.map((a) => a.ano);

  return (
    <Collapsible
      open={aberto}
      onOpenChange={setAberto}
      className="rounded-lg border border-border bg-muted/30"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Critério de comparação:</span> {contexto} O
          eixo temporal é o <strong>exercício</strong> informado na apuração (não o ano do arquivo).
          Entram apenas apurações concluídas; quando a mesma remessa foi reprocessada, vale a mais
          recente, e o índice definitivo prevalece sobre a mensal equivalente.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            {anos.length} exercício{anos.length === 1 ? "" : "s"} · {cargas.length} apuraç
            {cargas.length === 1 ? "ão" : "ões"}
          </Badge>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              {aberto ? "Ocultar" : "Ver o que entra"}
              <ChevronDown
                className={`ml-1 h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t border-border px-4 py-3">
          {porAno.map(({ ano, cargas: lista }) => (
            <div key={ano} className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-semibold ${
                  anoSelecionado != null && ano === anoSelecionado
                    ? "text-primary"
                    : "text-foreground"
                }`}
              >
                Exercício {ano}
                {anoSelecionado != null && ano === anoSelecionado ? " (em exibição)" : ""}
              </span>
              {lista.map((c) => (
                <Badge key={c.id} variant="outline" className="text-[11px] font-normal">
                  {periodoDaCarga(c).rotulo} · {rotuloTipo(c.tipo_retorno)}
                </Badge>
              ))}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            “Arquivo N” é o número da remessa enviada pela SEF dentro do exercício (13 = fechamento
            do ano). Cargas de exercícios com remessas diferentes comparam totais acumulados do que
            já foi apurado em cada exercício.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
