import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  anoDaCarga,
  periodoDaCarga,
  remessaDaCarga,
  type CargaEstat,
  type LinhaEstat,
} from "@/lib/vaf/estatisticas";
import { formatarMoeda } from "@/lib/format";
import { useSelecaoCargas } from "@/components/estatisticas/selecaoCargas";
import { descreverLacuna, detectarLacunas } from "@/lib/vaf/lacunas";


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
  linhas = [],
}: {
  cargas: CargaEstat[];
  anoSelecionado?: number | null;
  contexto: string;
  /** Contribuintes de todas as apurações, para medir o impacto de cada alerta. */
  linhas?: LinhaEstat[];
}) {
  const [aberto, setAberto] = useState(false);
  const selecao = useSelecaoCargas();
  const universo = selecao?.todas ?? cargas;
  const aplicadas = useMemo(
    () => new Set(selecao ? selecao.selecionadas : cargas.map((c) => c.id)),
    [selecao, cargas],
  );
  const [rascunho, setRascunho] = useState<Set<string>>(aplicadas);
  const [chaveSync, setChaveSync] = useState("");
  const chaveAtual = [...aplicadas].sort().join(",");
  if (chaveAtual !== chaveSync) {
    setChaveSync(chaveAtual);
    setRascunho(new Set(aplicadas));
  }

  /** Contribuintes distintos e VAF somado por apuração. */
  const resumoPorCarga = useMemo(() => {
    const mapa = new Map<string, { ies: Set<string>; vaf: number }>();
    for (const l of linhas) {
      const atual = mapa.get(l.carga_id) ?? { ies: new Set<string>(), vaf: 0 };
      atual.ies.add(l.inscricao_estadual);
      atual.vaf += Number(l.vaf_atual ?? 0);
      mapa.set(l.carga_id, atual);
    }
    return mapa;
  }, [linhas]);

  const porAno = useMemo(() => {
    const mapa = new Map<number, CargaEstat[]>();
    for (const c of universo) {
      const ano = anoDaCarga(c);
      mapa.set(ano, [...(mapa.get(ano) ?? []), c]);
    }
    return [...mapa.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([ano, lista]) => ({
        ano,
        cargas: lista.sort((a, b) => (remessaDaCarga(a) ?? 99) - (remessaDaCarga(b) ?? 99)),
      }));
  }, [universo]);

  const lacunas = useMemo(() => detectarLacunas(cargas), [cargas]);
  const foraDoCalculo = universo.length - cargas.length;
  const excluidas = useMemo(
    () => universo.filter((c) => !aplicadas.has(c.id)),
    [universo, aplicadas],
  );

  /** Remessas apuradas por exercício, para mostrar o que impede a comparação. */
  const remessasPorAno = useMemo(() => {
    const mapa = new Map<number, Set<number>>();
    for (const c of cargas) {
      const r = remessaDaCarga(c);
      if (r == null) continue;
      const set = mapa.get(anoDaCarga(c)) ?? new Set<number>();
      set.add(r);
      mapa.set(anoDaCarga(c), set);
    }
    return mapa;
  }, [cargas]);

  const anos = [...new Set(cargas.map(anoDaCarga))];
  const alterado = chaveAtual !== [...rascunho].sort().join(",");


  function alternar(id: string, marcado: boolean) {
    setRascunho((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(id);
      else proximo.delete(id);
      return proximo;
    });
  }

  function alternarAno(ano: number, marcado: boolean) {
    const ids = porAno.find((a) => a.ano === ano)?.cargas.map((c) => c.id) ?? [];
    setRascunho((atual) => {
      const proximo = new Set(atual);
      for (const id of ids) {
        if (marcado) proximo.add(id);
        else proximo.delete(id);
      }
      return proximo;
    });
  }

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
            {anos.length} exercício{anos.length === 1 ? "" : "s"} · {cargas.length} de{" "}
            {universo.length} apuraç{universo.length === 1 ? "ão" : "ões"}
          </Badge>
          {(lacunas.length > 0 || foraDoCalculo > 0) && (
            <Badge
              variant="outline"
              className="gap-1 border-[var(--omisso-foreground)] text-[11px] text-[var(--omisso-foreground)]"
            >
              <AlertTriangle className="h-3 w-3" />
              {lacunas.length > 0
                ? `${lacunas.length} exercício(s) incompleto(s)`
                : `${foraDoCalculo} apuração(ões) fora do cálculo`}
            </Badge>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              {aberto ? "Ocultar" : selecao ? "Escolher o que entra" : "Ver o que entra"}
              <ChevronDown
                className={`ml-1 h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-3 border-t border-border px-4 py-3">
          {foraDoCalculo > 0 && (
            <Alert className="border-[var(--omisso-foreground)]/40 bg-[var(--omisso-foreground)]/10">
              <AlertTriangle className="h-4 w-4 text-[var(--omisso-foreground)]" />
              <AlertTitle className="text-xs">
                {foraDoCalculo} apuração(ões) desmarcada(s)
              </AlertTitle>
              <AlertDescription className="text-[11px]">
                Todos os gráficos desta tela desconsideram essas apurações. Marque-as abaixo e
                clique em “Aplicar aos gráficos” para voltar ao conjunto completo.
              </AlertDescription>
            </Alert>
          )}

          {lacunas.map((l) => (
            <Alert
              key={l.ano}
              className="border-[var(--omisso-foreground)]/40 bg-[var(--omisso-foreground)]/10"
            >
              <AlertTriangle className="h-4 w-4 text-[var(--omisso-foreground)]" />
              <AlertTitle className="text-xs">
                Exercício {l.ano} incompleto — {descreverLacuna(l)}
              </AlertTitle>
              <AlertDescription className="text-[11px]">
                Remessas consideradas: {l.remessas.map((r) => `Arquivo ${r}`).join(", ")}. Podem
                ficar incompletos: {l.graficos.join(", ")}. A comparação entre exercícios só é justa
                quando os mesmos arquivos estão apurados nos dois lados.
              </AlertDescription>
            </Alert>
          ))}

          {porAno.map(({ ano, cargas: lista }) => {
            const todosDoAno = lista.every((c) => rascunho.has(c.id));
            return (
              <div key={ano} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex items-center gap-2">
                  {selecao && (
                    <Checkbox
                      checked={todosDoAno}
                      onCheckedChange={(v) => alternarAno(ano, v === true)}
                      aria-label={`Selecionar todo o exercício ${ano}`}
                    />
                  )}
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
                </label>
                {lista.map((c) =>
                  selecao ? (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                    >
                      <Checkbox
                        checked={rascunho.has(c.id)}
                        onCheckedChange={(v) => alternar(c.id, v === true)}
                        aria-label={`${periodoDaCarga(c).rotulo} ${rotuloTipo(c.tipo_retorno)}`}
                      />
                      {periodoDaCarga(c).rotulo} · {rotuloTipo(c.tipo_retorno)}
                    </label>
                  ) : (
                    <Badge key={c.id} variant="outline" className="text-[11px] font-normal">
                      {periodoDaCarga(c).rotulo} · {rotuloTipo(c.tipo_retorno)}
                    </Badge>
                  ),
                )}
              </div>
            );
          })}

          {selecao && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!alterado || rascunho.size === 0}
                onClick={() => selecao.aplicar([...rascunho])}
              >
                Aplicar aos gráficos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setRascunho(new Set(universo.map((c) => c.id)))}
              >
                Selecionar todas
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={!alterado}
                onClick={() => setRascunho(new Set(aplicadas))}
              >
                Desfazer
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {rascunho.size === 0
                  ? "Selecione ao menos uma apuração."
                  : alterado
                    ? `${rascunho.size} apuração(ões) marcadas — clique em Aplicar para recalcular.`
                    : "Seleção aplicada aos gráficos."}
              </span>
            </div>
          )}

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

