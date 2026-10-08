import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useEmpresasPrefeitura } from "@/components/empresas/ComparacaoPrefeitura";
import { EmitirNotificacoesView } from "@/components/empresas/EmitirNotificacoesView";
import { ModelosNotificacaoView } from "@/components/empresas/ModelosNotificacaoView";
import { ativasSemCadastro } from "@/lib/empresas/notificacoes";

export const Route = createFileRoute("/_authenticated/empresas/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações de empresas — Apura VAF 2.0" },
      { name: "description", content: "Emita notificações para empresas ativas na Receita Federal sem cadastro na prefeitura, com modelos editáveis." },
      { property: "og:title", content: "Notificações de empresas — Apura VAF 2.0" },
      { property: "og:description", content: "Notificações e modelos editáveis para regularização do cadastro econômico municipal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const { municipioId, municipio } = useMunicipioAtivo();
  const { data: empresas = [] } = useEmpresas(municipioId);
  const { data: pref = [], isFetched } = useEmpresasPrefeitura(municipioId);
  const candidatas = useMemo(() => ativasSemCadastro(empresas, pref), [empresas, pref]);

  if (!municipioId) return <p className="text-sm text-muted-foreground">Selecione uma prefeitura ativa.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Notificações — {municipio?.nome}</h1>
        <p className="text-sm text-muted-foreground">Emita notificações a partir das observações da comparação com o cadastro da prefeitura.</p>
      </div>
      <Tabs defaultValue="emitir">
        <TabsList>
          <TabsTrigger value="emitir">Emitir</TabsTrigger>
          <TabsTrigger value="modelos">Modelos</TabsTrigger>
        </TabsList>
        <TabsContent value="emitir"><EmitirNotificacoesView candidatas={candidatas} semPlanilha={isFetched && pref.length === 0} /></TabsContent>
        <TabsContent value="modelos"><ModelosNotificacaoView exemplo={candidatas[0]} /></TabsContent>
      </Tabs>
    </div>
  );
}
