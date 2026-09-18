import { createFileRoute } from "@tanstack/react-router";
import { SincronizacaoOficial } from "@/components/icms/SincronizacaoOficial";
import { usePerfil } from "@/hooks/usePerfil";

export const Route = createFileRoute("/_authenticated/icms/sincronizacao")({
  head: () => ({
    meta: [
      { title: "Sincronização das tabelas oficiais — critérios do ICMS" },
      {
        name: "description",
        content:
          "Busca automática das tabelas oficiais de pontuação de Esportes, Turismo, Meio Ambiente, Educação e Patrimônio Cultural, com atualização imediata do ranking.",
      },
      {
        property: "og:title",
        content: "Sincronização das tabelas oficiais — critérios do ICMS",
      },
      {
        property: "og:description",
        content:
          "Atualize a pontuação de todos os critérios do ICMS Robin Hood direto das fontes oficiais, sem enviar arquivos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaSincronizacao,
});

function PaginaSincronizacao() {
  const { data: perfil } = usePerfil();
  const consultoria = perfil?.papel === "superadmin" || perfil?.papel === "consultor";

  if (!consultoria) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Apenas a consultoria pode atualizar as tabelas oficiais dos critérios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tabelas oficiais dos critérios</h1>
        <p className="text-sm text-muted-foreground">
          Leitura direta das publicações de cada órgão do Estado, com o ranking atualizado na hora.
        </p>
      </div>
      <SincronizacaoOficial />
    </div>
  );
}
