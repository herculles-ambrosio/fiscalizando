import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EvolucaoView from "@/components/analises/EvolucaoView";
import ComparacaoView from "@/components/analises/ComparacaoView";
import IndiceView from "@/components/analises/IndiceView";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

const ABAS = ["evolucao", "comparacao", "indice"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/_authenticated/analises")({
  validateSearch: (search: Record<string, unknown>) => ({
    aba: (ABAS as readonly string[]).includes(String(search["aba"]))
      ? (search["aba"] as Aba)
      : ("evolucao" as Aba),
  }),
  head: () => ({
    meta: [
      { title: "Análises do VAF — evolução, comparação e índice" },
      {
        name: "description",
        content:
          "Analise a evolução do VAF entre remessas, compare apurações e apure o índice provisório ou definitivo do município.",
      },
      { property: "og:title", content: "Análises do VAF" },
      {
        property: "og:description",
        content:
          "Evolução entre arquivos, comparação de apurações e índice de participação em um único painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaAnalises,
});

function PaginaAnalises() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // trocar de prefeitura remonta as abas, limpando arquivos/filtros da anterior
  const { municipioId } = useMunicipioAtivo();
  const chave = municipioId ?? "sem-municipio";

  return (
    <Tabs
      value={aba}
      onValueChange={(v) => navigate({ to: ".", search: { aba: v as Aba } })}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="evolucao">Evolução do VAF</TabsTrigger>
        <TabsTrigger value="comparacao">Comparar apurações</TabsTrigger>
        <TabsTrigger value="indice">Índice do VAF</TabsTrigger>
      </TabsList>

      {/* forceMount mantém arquivos, buscas e filtros de cada aba ao alternar */}
      <TabsContent value="evolucao" forceMount className="data-[state=inactive]:hidden">
        <EvolucaoView key={chave} />
      </TabsContent>
      <TabsContent value="comparacao" forceMount className="data-[state=inactive]:hidden">
        <ComparacaoView key={chave} />
      </TabsContent>
      <TabsContent value="indice" forceMount className="data-[state=inactive]:hidden">
        <IndiceView key={chave} />
      </TabsContent>
    </Tabs>
  );
}
