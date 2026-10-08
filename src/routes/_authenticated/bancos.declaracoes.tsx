import { createFileRoute } from "@tanstack/react-router";
import { DeclaracoesView } from "@/components/bancos/DeclaracoesView";

export const Route = createFileRoute("/_authenticated/bancos/declaracoes")({
  head: () => ({
    meta: [
      { title: "Declarações dos bancos — Fiscaliza Banco" },
      { name: "description", content: "Importação da DES-IF, de planilhas ou lançamento manual da base e do ISS declarados." },
      { property: "og:title", content: "Declarações dos bancos — Fiscaliza Banco" },
      { property: "og:description", content: "Importação da DES-IF, de planilhas ou lançamento manual da base e do ISS declarados." },
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
        <h1 className="font-display text-2xl font-semibold">Declarações dos bancos</h1>
        <p className="text-sm text-muted-foreground">Importação da DES-IF, de planilhas ou lançamento manual da base e do ISS declarados.</p>
      </div>
      <DeclaracoesView />
    </div>
  );
}
