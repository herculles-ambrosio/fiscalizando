import { createFileRoute } from "@tanstack/react-router";
import { PlanoContasView } from "@/components/bancos/PlanoContasView";

export const Route = createFileRoute("/_authenticated/bancos/contas")({
  head: () => ({
    meta: [
      { title: "Plano de contas e alíquotas — Fiscaliza Banco" },
      { name: "description", content: "Contas COSIF ligadas aos itens da LC 116/2003 e às alíquotas do município." },
      { property: "og:title", content: "Plano de contas e alíquotas — Fiscaliza Banco" },
      { property: "og:description", content: "Contas COSIF ligadas aos itens da LC 116/2003 e às alíquotas do município." },
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
        <h1 className="font-display text-2xl font-semibold">Plano de contas e alíquotas</h1>
        <p className="text-sm text-muted-foreground">Contas COSIF ligadas aos itens da LC 116/2003 e às alíquotas do município.</p>
      </div>
      <PlanoContasView />
    </div>
  );
}
