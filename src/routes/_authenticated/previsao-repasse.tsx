import { createFileRoute } from "@tanstack/react-router";
import PrevisaoRepasse from "@/components/analises/PrevisaoRepasse";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

export const Route = createFileRoute("/_authenticated/previsao-repasse")({
  head: () => ({
    meta: [
      { title: "Previsão de repasse do VAF — quanto o município deve receber" },
      {
        name: "description",
        content:
          "Projete o repasse de ICMS pelo critério VAF do próximo exercício a partir do índice apurado e dos valores já recebidos.",
      },
      { property: "og:title", content: "Previsão de repasse do VAF" },
      {
        property: "og:description",
        content:
          "Simulação mês a mês do repasse do VAF com o índice projetado e a receita estimada do critério.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaPrevisao,
});

function PaginaPrevisao() {
  const { municipioId } = useMunicipioAtivo();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Previsão de repasse do VAF</h1>
        <p className="text-sm text-muted-foreground">
          Quanto o município deve receber no próximo exercício com o índice que está alcançando
          agora.
        </p>
      </div>
      <PrevisaoRepasse key={municipioId ?? "sem-municipio"} />
    </div>
  );
}
