import { createFileRoute } from "@tanstack/react-router";
import { MuralNoticias } from "@/components/noticias/MuralNoticias";

export const Route = createFileRoute("/_authenticated/noticias")({
  head: () => ({
    meta: [
      { title: "Notícias tributárias — Apura VAF 2.0" },
      { name: "description", content: "Mural diário de notícias tributárias para os municípios mineiros: VAF, ICMS, ITBI, ISS e nota fiscal." },
      { property: "og:title", content: "Notícias tributárias — Apura VAF 2.0" },
      { property: "og:description", content: "As principais notícias tributárias para prefeituras de Minas Gerais, com links para as matérias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MuralNoticias,
});
