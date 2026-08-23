import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useCargasEstatisticas, useLinhasEstatisticas } from "@/hooks/useEstatisticas";
import {
  agregarPorContribuinte,
  anoDaCarga,
  cargasDoExercicio,
  deduplicarCargas,
  periodoDaCarga,
  variacaoPct,
  type FonteExercicio,
} from "@/lib/vaf/estatisticas";
import { formatarMoeda, formatarPercentual } from "@/lib/format";
import { SelecaoCargasContext } from "@/components/estatisticas/selecaoCargas";
import { MaioresContribuintes } from "@/components/estatisticas/MaioresContribuintes";
import { ComparativoAnual } from "@/components/estatisticas/ComparativoAnual";
import { SetoresQualidade } from "@/components/estatisticas/SetoresQualidade";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const ABAS = ["maiores", "anual", "setores"] as const;
type Aba = (typeof ABAS)[number];

/** Critério de comparação escolhido, guardado por prefeitura neste navegador. */
const chaveSelecao = (municipioId: string) => `apuravaf:estatisticas:selecao:${municipioId}`;
/** Fonte do exercício (definitiva x remessas mensais), por prefeitura. */
const chaveFonte = (municipioId: string) => `apuravaf:estatisticas:fonte:${municipioId}`;


export const Route = createFileRoute("/_authenticated/estatisticas")({
  validateSearch: (search: Record<string, unknown>) => ({
    aba: (ABAS as readonly string[]).includes(String(search["aba"]))
      ? (search["aba"] as Aba)
      : ("maiores" as Aba),
  }),
  head: () => ({
    meta: [
      { title: "Estatísticas do VAF — maiores contribuintes e evolução" },
      {
        name: "description",
        content:
          "Gráficos das empresas que mais contribuem para o VAF do município, comparativo ano a ano, concentração por Pareto, setores e qualidade das declarações.",
      },
      { property: "og:title", content: "Estatísticas do VAF" },
      {
        property: "og:description",
        content:
          "Ranking de contribuintes, evolução mensal e anual, concentração do VAF e desempenho por CNAE.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaEstatisticas,
});

function PaginaEstatisticas() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { municipioId } = useMunicipioAtivo();

  const { data: cargasBrutas, isLoading: carregandoCargas } = useCargasEstatisticas(municipioId);
  const todasCargas = useMemo(() => deduplicarCargas(cargasBrutas ?? []), [cargasBrutas]);
  const cargaIds = useMemo(() => todasCargas.map((c) => c.id), [todasCargas]);
  const [selecionadas, setSelecionadas] = useState<string[] | null>(null);
  const [fonte, setFonte] = useState<FonteExercicio>("definitiva");

  // Preferência de fonte do exercício, lembrada por prefeitura.
  useEffect(() => {
    if (!municipioId) return;
    try {
      const salvo = localStorage.getItem(chaveFonte(municipioId));
      setFonte(salvo === "mensais" ? "mensais" : "definitiva");
    } catch {
      setFonte("definitiva");
    }
  }, [municipioId]);

  function alterarFonte(valor: FonteExercicio) {
    setFonte(valor);
    if (!municipioId) return;
    try {
      localStorage.setItem(chaveFonte(municipioId), valor);
    } catch {
      /* armazenamento indisponível: vale só nesta sessão */
    }
  }

  // Ao trocar de prefeitura, recupera o critério salvo daquela prefeitura (se ainda válido).
  useEffect(() => {
    if (!municipioId || !cargaIds.length) {
      setSelecionadas(null);
      return;
    }
    try {
      const bruto = localStorage.getItem(chaveSelecao(municipioId));
      const ids = bruto
        ? (JSON.parse(bruto) as string[]).filter((id) => cargaIds.includes(id))
        : [];
      setSelecionadas(ids.length && ids.length !== cargaIds.length ? ids : null);
    } catch {
      setSelecionadas(null);
    }
  }, [municipioId, cargaIds.join(",")]);

  const cargas = useMemo(() => {
    if (!selecionadas) return todasCargas;
    const set = new Set(selecionadas);
    const filtradas = todasCargas.filter((c) => set.has(c.id));
    return filtradas.length ? filtradas : todasCargas;
  }, [todasCargas, selecionadas]);

  const selecaoCargas = useMemo(
    () => ({
      todas: todasCargas,
      selecionadas: cargas.map((c) => c.id),
      aplicar: (ids: string[]) => {
        const novo = ids.length && ids.length !== cargaIds.length ? ids : null;
        setSelecionadas(novo);
        if (!municipioId) return;
        try {
          if (novo) localStorage.setItem(chaveSelecao(municipioId), JSON.stringify(novo));
          else localStorage.removeItem(chaveSelecao(municipioId));
        } catch {
          /* armazenamento indisponível: a seleção vale só nesta sessão */
        }
      },
    }),
    [todasCargas, cargas, cargaIds, municipioId],
  );

  const { data: linhas, isLoading: carregandoLinhas } = useLinhasEstatisticas(
    municipioId,
    cargaIds,
  );

  const kpis = useMemo(() => {
    if (!linhas?.length) return null;
    const anos = [...new Set(cargas.map(anoDaCarga))].sort((a, b) => b - a);
    const ultimo = anos[0];
    const anterior = anos[1];
    const totalDoAno = (ano: number | undefined) => {
      if (ano == null) return 0;
      const ids = new Set(cargasDoExercicio(cargas, ano).map((c) => c.id));
      return linhas
        .filter((l) => ids.has(l.carga_id))
        .reduce((s, l) => s + Number(l.vaf_atual ?? 0), 0);
    };
    const idsUltimo = new Set(
      ultimo == null ? [] : cargasDoExercicio(cargas, ultimo).map((c) => c.id),
    );
    const linhasUltimo = linhas.filter((l) => idsUltimo.has(l.carga_id));
    const mapa = new Map(cargas.map((c) => [c.id, periodoDaCarga(c)]));
    const ranking = agregarPorContribuinte(linhasUltimo, mapa);
    const total = ranking.reduce((s, c) => s + c.total, 0);
    const top10 = ranking.slice(0, 10).reduce((s, c) => s + c.total, 0);
    return {
      ano: ultimo,
      total,
      declarantes: new Set(
        linhasUltimo.filter((l) => l.entregou_declaracao).map((l) => l.inscricao_estadual),
      ).size,
      participacaoTop10: total > 0 ? (top10 / total) * 100 : 0,
      variacao: variacaoPct(totalDoAno(ultimo), totalDoAno(anterior)),
    };
  }, [cargas, linhas]);

  if (carregandoCargas || carregandoLinhas) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!todasCargas.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma apuração concluída ainda. Comece em “Nova apuração” para gerar as estatísticas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem sustenta o VAF do município, como isso evolui ano a ano e onde está concentrado.
        </p>
      </div>

      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi rotulo={`VAF total ${kpis.ano ?? ""}`} valor={formatarMoeda(kpis.total)} />
          <Kpi rotulo="Declarantes no ano" valor={String(kpis.declarantes)} />
          <Kpi rotulo="Participação do Top 10" valor={`${kpis.participacaoTop10.toFixed(1)}%`} />
          <Kpi rotulo="Variação vs. ano anterior" valor={formatarPercentual(kpis.variacao)} />
        </div>
      )}

      <SelecaoCargasContext.Provider value={selecaoCargas}>
        <Tabs
          value={aba}
          onValueChange={(v) => navigate({ to: ".", search: { aba: v as Aba } })}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="maiores">Maiores contribuintes</TabsTrigger>
            <TabsTrigger value="anual">Comparativo anual</TabsTrigger>
            <TabsTrigger value="setores">Setores e qualidade</TabsTrigger>
          </TabsList>

          <TabsContent value="maiores">
            <MaioresContribuintes cargas={cargas} linhas={linhas ?? []} />
          </TabsContent>
          <TabsContent value="anual">
            <ComparativoAnual cargas={cargas} linhas={linhas ?? []} />
          </TabsContent>
          <TabsContent value="setores">
            <SetoresQualidade cargas={cargas} linhas={linhas ?? []} />
          </TabsContent>
        </Tabs>
      </SelecaoCargasContext.Provider>
    </div>
  );
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{rotulo}</p>
        <p className="mt-2 font-display text-2xl font-bold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}
