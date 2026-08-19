import { createFileRoute } from "@tanstack/react-router";
import { ContribuintesGrid } from "@/components/ContribuintesGrid";

export const Route = createFileRoute("/_authenticated/cargas/$cargaId")({
  head: () => ({
    meta: [
      { title: "Contribuintes apurados | VAF" },
      {
        name: "description",
        content:
          "Lista de contribuintes apurados com situação, VAF declarado, variação e data de entrega.",
      },
      { property: "og:title", content: "Contribuintes apurados | VAF" },
      {
        property: "og:description",
        content: "Consulte os contribuintes apurados por situação, VAF e variação percentual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaCarga,
});

function PaginaCarga() {
  const { cargaId } = Route.useParams();
  return <ContribuintesGrid cargaId={cargaId} />;
}
