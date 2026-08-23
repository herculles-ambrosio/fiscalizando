import { useEffect, useMemo, useState } from "react";
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
  const chaveAtual = useMemo(() => [...aplicadas].sort().join(","), [aplicadas]);
  const [rascunho, setRascunho] = useState<Set<string>>(() => new Set(aplicadas));
  // Sincroniza o rascunho com a seleção aplicada sem atualizar estado durante o
  // render (isso derrubava a árvore do React e deixava a tela branca).
  useEffect(() => {
    setRascunho(new Set(chaveAtual ? chaveAtual.split(",") : []));
  }, [chaveAtual]);


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
                <Detalhe titulo="Ver o que ficou de fora">
                  <TabelaApuracoes cargas={excluidas} resumo={resumoPorCarga} />
                  <p className="mt-2">
                    Gráficos afetados: todos os desta tela (ranking, comparativo anual, setores e
                    qualidade), porque eles somam apenas as apurações marcadas.
                  </p>
                </Detalhe>
              </AlertDescription>
            </Alert>
          )}

          {lacunas.map((l) => {
            const doAno = cargas
              .filter((c) => anoDaCarga(c) === l.ano)
              .sort((a, b) => (remessaDaCarga(a) ?? 99) - (remessaDaCarga(b) ?? 99));
            const comparaveis = [...remessasPorAno.entries()]
              .filter(([ano]) => ano !== l.ano)
              .map(([ano, set]) => ({
                ano,
                faltamAqui: l.faltantes.filter((r) => set.has(r)),
                temAMais: [...set].filter((r) => !l.remessas.includes(r)).sort((a, b) => a - b),
              }))
              .sort((a, b) => b.ano - a.ano);
            return (
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
                  ficar incompletos: {l.graficos.join(", ")}. A comparação entre exercícios só é
                  justa quando os mesmos arquivos estão apurados nos dois lados.
                  <Detalhe titulo={`Ver o que falta no exercício ${l.ano}`}>
                    <p className="mb-1 font-medium text-foreground">Apurações que entram</p>
                    <TabelaApuracoes cargas={doAno} resumo={resumoPorCarga} />

                    <p className="mt-3 mb-1 font-medium text-foreground">Remessas faltantes</p>
                    {l.faltantes.length || l.semFechamento ? (
                      <div className="flex flex-wrap gap-1">
                        {l.faltantes.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] font-normal">
                            Arquivo {r} — não apurado
                          </Badge>
                        ))}
                        {l.semFechamento && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            Arquivo 13 (fechamento) — não apurado
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p>A sequência está completa; o exercício só tem menos arquivos que os demais.</p>
                    )}

                    <p className="mt-3 mb-1 font-medium text-foreground">
                      O que isso impede na comparação temporal
                    </p>
                    {comparaveis.length ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {comparaveis.map((c) => (
                          <li key={c.ano}>
                            Contra o exercício {c.ano}:{" "}
                            {c.temAMais.length
                              ? `${c.ano} tem os arquivos ${c.temAMais.join(", ")} que ${l.ano} não tem — o total de ${l.ano} fica menor por falta de período, não por queda real.`
                              : "mesmos arquivos apurados nos dois lados; a comparação é justa."}
                            {c.faltamAqui.length
                              ? ` Buracos no meio da sequência de ${l.ano}: ${c.faltamAqui.join(", ")}.`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Não há outro exercício apurado para comparar.</p>
                    )}

                    <p className="mt-3 mb-1 font-medium text-foreground">Gráficos afetados</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {l.graficos.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </Detalhe>
                </AlertDescription>
              </Alert>
            );
          })}


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
                    : "Seleção aplicada aos gráficos e salva para esta prefeitura."}
              </span>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            “Arquivo N” é o número da remessa enviada pela SEF dentro do exercício (13 = fechamento
            do ano). Cargas de exercícios com remessas diferentes comparam totais acumulados do que
            já foi apurado em cada exercício. Seu critério fica salvo neste navegador por prefeitura
            e volta automaticamente na próxima visita.
          </p>

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Bloco recolhível usado dentro dos alertas para o detalhamento. */
function Detalhe({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">
          {aberto ? "Ocultar detalhes" : titulo}
          <ChevronDown
            className={`ml-1 h-3 w-3 transition-transform ${aberto ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border bg-background p-2 text-[11px]">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TabelaApuracoes({
  cargas,
  resumo,
}: {
  cargas: CargaEstat[];
  resumo: Map<string, { ies: Set<string>; vaf: number }>;
}) {
  if (!cargas.length) return <p>Nenhuma apuração nesta lista.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 pr-3 font-medium">Apuração</th>
            <th className="py-1 pr-3 font-medium">Tipo</th>
            <th className="py-1 pr-3 font-medium">Contribuintes</th>
            <th className="py-1 font-medium">VAF</th>
          </tr>
        </thead>
        <tbody>
          {cargas.map((c) => {
            const r = resumo.get(c.id);
            return (
              <tr key={c.id} className="border-t border-border/60">
                <td className="py-1 pr-3">{periodoDaCarga(c).rotulo}</td>
                <td className="py-1 pr-3">{rotuloTipo(c.tipo_retorno)}</td>
                <td className="py-1 pr-3 tabular-nums">{r ? r.ies.size : "—"}</td>
                <td className="py-1 tabular-nums">{r ? formatarMoeda(r.vaf) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


