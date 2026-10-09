import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useEmpresasPrefeitura } from "@/components/empresas/ComparacaoPrefeitura";
import { EmitirNotificacoesView } from "@/components/empresas/EmitirNotificacoesView";
import { ModelosNotificacaoView } from "@/components/empresas/ModelosNotificacaoView";
import { ativasSemCadastro, enderecoEmpresa } from "@/lib/empresas/notificacoes";
import DocumentosPrefeituraView from "@/components/DocumentosPrefeituraView";
import { formatarCnpj } from "@/lib/format";
import type { FonteDestinatario } from "@/lib/documentosPrefeitura";

const PLACEHOLDERS_EMP = [
  { chave: "{{nome_fantasia}}", descricao: "Nome fantasia" },
  { chave: "{{atividade}}", descricao: "CNAE principal e descrição" },
  { chave: "{{situacao}}", descricao: "Situação cadastral na Receita" },
  { chave: "{{inscricao_estadual}}", descricao: "Inscrição estadual" },
];

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
  const fontes = useMemo<FonteDestinatario[]>(() => empresas.map((e) => ({
    id: e.cnpj,
    nome: e.razao_social ?? e.cnpj,
    documento: formatarCnpj(e.cnpj),
    endereco: enderecoEmpresa(e),
    detalhe: e.situacao ?? undefined,
    campos: {
      nome_fantasia: e.nome_fantasia ?? "—",
      atividade: [e.cnae_principal, e.cnae_descricao].filter(Boolean).join(" - ") || "—",
      situacao: e.situacao ?? "—",
      inscricao_estadual: e.inscricao_estadual ?? "—",
    },
  })), [empresas]);

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
          <TabsTrigger value="prefeitura">Documentos da prefeitura</TabsTrigger>
        </TabsList>
        <TabsContent value="emitir"><EmitirNotificacoesView candidatas={candidatas} semPlanilha={isFetched && pref.length === 0} /></TabsContent>
        <TabsContent value="modelos"><ModelosNotificacaoView exemplo={candidatas[0]} /></TabsContent>
        <TabsContent value="prefeitura"><DocumentosPrefeituraView modulo="empresas" fontes={fontes} rotuloFontes="Empresas da base" placeholdersModulo={PLACEHOLDERS_EMP} /></TabsContent>
      </Tabs>
    </div>
  );
}
