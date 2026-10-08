import { createFileRoute } from "@tanstack/react-router";
import { ConferenciaView } from "@/components/bancos/ConferenciaView";

export const Route = createFileRoute("/_authenticated/bancos/")({
  head: () => ({
    meta: [
      { title: "Conferência do ISS bancário — Fiscaliza Banco" },
      { name: "description", content: "Confronta as declarações dos bancos com o plano de contas COSIF e com os dados do Banco Central (ESTBAN e IF.data)." },
      { property: "og:title", content: "Conferência do ISS bancário — Fiscaliza Banco" },
      { property: "og:description", content: "Confronta as declarações dos bancos com o plano de contas COSIF e com os dados do Banco Central (ESTBAN e IF.data)." },
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
        <h1 className="font-display text-2xl font-semibold">Conferência do ISS bancário</h1>
        <p className="text-sm text-muted-foreground">Confronta as declarações dos bancos com o plano de contas COSIF e com os dados do Banco Central (ESTBAN e IF.data).</p>
      </div>
      <ConferenciaView />
    </div>
  );
}
