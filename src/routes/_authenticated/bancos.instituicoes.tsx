import { createFileRoute } from "@tanstack/react-router";
import { InstituicoesView } from "@/components/bancos/InstituicoesView";

export const Route = createFileRoute("/_authenticated/bancos/instituicoes")({
  head: () => ({
    meta: [
      { title: "Instituições financeiras — Fiscaliza Banco" },
      { name: "description", content: "Bancos e cooperativas do município, ESTBAN do Banco Central e rendas trimestrais do IF.data." },
      { property: "og:title", content: "Instituições financeiras — Fiscaliza Banco" },
      { property: "og:description", content: "Bancos e cooperativas do município, ESTBAN do Banco Central e rendas trimestrais do IF.data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Instituições financeiras</h1>
        <p className="text-sm text-muted-foreground">Bancos e cooperativas do município, ESTBAN do Banco Central e rendas trimestrais do IF.data.</p>
      </div>
      <InstituicoesView />
    </div>
  );
}
