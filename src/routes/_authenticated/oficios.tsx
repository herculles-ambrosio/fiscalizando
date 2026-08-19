import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ModelosView from "@/components/oficios/ModelosView";
import EmissoesView from "@/components/oficios/EmissoesView";

const ABAS = ["modelos", "emitidos"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/_authenticated/oficios")({
  validateSearch: (search: Record<string, unknown>) => ({
    aba: (ABAS as readonly string[]).includes(String(search.aba))
      ? (search.aba as Aba)
      : ("modelos" as Aba),
  }),
  head: () => ({
    meta: [
      { title: "Ofícios do VAF — modelos e emissões" },
      {
        name: "description",
        content:
          "Edite os modelos padrão dos ofícios do VAF e acompanhe o histórico de ofícios emitidos por contribuinte.",
      },
      { property: "og:title", content: "Ofícios do VAF" },
      {
        property: "og:description",
        content: "Modelos de ofício e histórico de emissões em um único lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaOficios,
});

function PaginaOficios() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <Tabs
      value={aba}
      onValueChange={(v) => navigate({ to: ".", search: { aba: v as Aba } })}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="modelos">Modelos de ofício</TabsTrigger>
        <TabsTrigger value="emitidos">Ofícios emitidos</TabsTrigger>
      </TabsList>

      <TabsContent value="modelos">
        <ModelosView />
      </TabsContent>
      <TabsContent value="emitidos">
        <EmissoesView />
      </TabsContent>
    </Tabs>
  );
}
