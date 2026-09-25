import { createFileRoute } from "@tanstack/react-router";
import PrevisaoCriterios from "@/components/icms/PrevisaoCriterios";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

export const Route = createFileRoute("/_authenticated/icms/previsao-criterios")({
  head: () => ({
    meta: [
      { title: "Previsão por critério do ICMS — repasses do próximo exercício" },
      {
        name: "description",
        content:
          "Impacto de cada índice do ICMS nos repasses do próximo exercício, com o cenário de recuperação do VAF.",
      },
      { property: "og:title", content: "Previsão por critério do ICMS" },
      {
        property: "og:description",
        content: "Previsão de repasse critério a critério, com e sem recuperação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pagina,
});

function Pagina() {
  const { municipioId } = useMunicipioAtivo();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Previsão por critério</h1>
        <p className="text-sm text-muted-foreground">
          Quanto cada critério do ICMS deve render no próximo exercício, com o cenário de recuperação.
        </p>
      </div>
      <PrevisaoCriterios key={municipioId ?? "sem"} />
    </div>
  );
}
