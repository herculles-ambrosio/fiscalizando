import { createFileRoute } from "@tanstack/react-router";
import TransferenciasEstado from "@/components/icms/TransferenciasEstado";

export const Route = createFileRoute("/_authenticated/icms/transferencias")({
  head: () => ({
    meta: [
      { title: "Transferências do Estado — bolada do VAF | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Cadastre mês a mês a transferência líquida de ICMS e os 75% repassados pelo VAF, usados nas previsões de repasse.",
      },
      { property: "og:title", content: "Transferências do Estado — bolada do VAF" },
      {
        property: "og:description",
        content: "Valores mensais da FJP que formam a bolada do VAF rateada pelos índices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Transferências do Estado</h1>
        <p className="text-sm text-muted-foreground">
          Valores mensais da tabela da FJP. A linha “75% repassado pelo VAF” é a bolada rateada
          entre os municípios pelos índices.
        </p>
      </div>
      <TransferenciasEstado />
    </div>
  );
}
