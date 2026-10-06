import { createFileRoute } from "@tanstack/react-router";
import { EmpresasView } from "@/components/empresas/EmpresasView";

export const Route = createFileRoute("/_authenticated/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas do município — Apura VAF 2.0" },
      { name: "description", content: "Empresas da prefeitura importadas da Receita Federal e classificadas em MEI, Simples Nacional ou outro regime para fiscalização." },
      { property: "og:title", content: "Empresas do município — Apura VAF 2.0" },
      { property: "og:description", content: "Cadastro de empresas por município com situação na Receita, Simples Nacional e MEI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmpresasView,
});
