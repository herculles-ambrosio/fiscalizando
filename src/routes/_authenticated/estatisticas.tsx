import { createFileRoute } from "@tanstack/react-router";
import { ComparacaoResolucao } from "@/components/estatisticas/ComparacaoResolucao";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — comparação das resoluções do VAF" },
      {
        name: "description",
        content:
          "Compare as médias oficiais de duas resoluções do VAF para todas as prefeituras cadastradas.",
      },
      { property: "og:title", content: "Estatísticas das resoluções do VAF" },
      {
        property: "og:description",
        content: "Panorama municipal das médias oficiais publicadas nas resoluções da SEF-MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaEstatisticas,
});

function PaginaEstatisticas() {
  return <ComparacaoResolucao />;
}