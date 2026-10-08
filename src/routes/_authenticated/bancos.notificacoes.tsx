import { createFileRoute } from "@tanstack/react-router";
import { NotificacoesBancoView } from "@/components/bancos/NotificacoesBancoView";

export const Route = createFileRoute("/_authenticated/bancos/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações aos bancos — Fiscaliza Banco" },
      { name: "description", content: "Modelos editáveis e emissão de notificações às instituições financeiras." },
      { property: "og:title", content: "Notificações aos bancos — Fiscaliza Banco" },
      { property: "og:description", content: "Modelos editáveis e emissão de notificações às instituições financeiras." },
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
        <h1 className="font-display text-2xl font-semibold">Notificações aos bancos</h1>
        <p className="text-sm text-muted-foreground">Modelos editáveis e emissão de notificações às instituições financeiras.</p>
      </div>
      <NotificacoesBancoView />
    </div>
  );
}
