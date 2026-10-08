import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ComparacaoPrefeitura } from "@/components/empresas/ComparacaoPrefeitura";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

export const Route = createFileRoute("/_authenticated/empresas/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar com cadastro da prefeitura — Apura VAF 2.0" },
      { name: "description", content: "Compara o cadastro econômico da prefeitura com as empresas importadas da Receita Federal, destacando divergências de regime, Simples Nacional, MEI e situação." },
      { property: "og:title", content: "Comparar com cadastro da prefeitura — Apura VAF 2.0" },
      { property: "og:description", content: "Cruzamento por CNPJ entre o cadastro municipal e a base da Receita Federal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompararPrefeituraPage,
});

function CompararPrefeituraPage() {
  const navigate = useNavigate();
  const { municipioId, municipio } = useMunicipioAtivo();
  const { data: empresas = [] } = useEmpresas(municipioId);

  if (!municipioId) {
    return <p className="text-sm text-muted-foreground">Selecione uma prefeitura ativa para comparar os cadastros.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Comparar com cadastro da prefeitura — {municipio?.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Cruzamento por CNPJ entre a planilha da prefeitura e a base da Receita Federal.
        </p>
      </div>
      <ComparacaoPrefeitura
        municipioId={municipioId}
        municipioNome={municipio?.nome ?? ""}
        empresas={empresas}
        onClose={() => navigate({ to: "/empresas" })}
      />
    </div>
  );
}
