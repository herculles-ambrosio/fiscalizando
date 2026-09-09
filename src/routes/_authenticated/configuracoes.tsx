import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { CONFIG_VAZIA, useConfiguracao, useSalvarConfiguracao } from "@/hooks/useConfiguracao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ConfiguracaoMunicipio } from "@/lib/oficios/zerados";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do município — VAF" },
      {
        name: "description",
        content:
          "Dados institucionais da prefeitura usados no cabeçalho e na assinatura dos ofícios de retificação do VAF.",
      },
      { property: "og:title", content: "Configurações do município — VAF" },
      {
        property: "og:description",
        content: "Brasão, endereço e signatário usados nos ofícios gerados pelo sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Configuracoes,
});

type Campo = {
  chave: keyof ConfiguracaoMunicipio;
  rotulo: string;
  dica?: string;
  obrigatorio?: boolean;
};

type Etapa = {
  titulo: string;
  descricao: string;
  campos: Campo[];
};

const ETAPAS: Etapa[] = [
  {
    titulo: "Identificação",
    descricao: "Aparece nas primeiras linhas do cabeçalho dos documentos.",
    campos: [
      { chave: "nome_prefeitura", rotulo: "Nome da prefeitura", obrigatorio: true },
      { chave: "estado", rotulo: "Estado (linha do cabeçalho)", obrigatorio: true },
      { chave: "secretaria", rotulo: "Secretaria", obrigatorio: true },
      { chave: "setor", rotulo: "Setor" },
    ],
  },
  {
    titulo: "Endereço e data",
    descricao: "Usados no rodapé e na linha de data dos documentos.",
    campos: [
      { chave: "cidade_data", rotulo: "Cidade/UF da data", dica: "Ex.: Nanuque/MG", obrigatorio: true },
      { chave: "endereco_rodape", rotulo: "Endereço do rodapé", obrigatorio: true },
    ],
  },
  {
    titulo: "Assinatura",
    descricao: "Bloco impresso no final de cada ofício ou notificação.",
    campos: [
      { chave: "texto_assinatura", rotulo: "Texto acima da assinatura" },
      { chave: "signatario_nome", rotulo: "Nome do signatário", obrigatorio: true },
      { chave: "signatario_cargo", rotulo: "Cargo do signatário", obrigatorio: true },
    ],
  },
];

const TOTAL_ETAPAS = ETAPAS.length + 2; // + brasão + revisão
const ETAPA_BRASAO = ETAPAS.length;
const ETAPA_REVISAO = ETAPAS.length + 1;

const TITULOS = [...ETAPAS.map((e) => e.titulo), "Brasão", "Revisão"];

function Configuracoes() {
  const { data: perfil } = usePerfil();
  const { municipioId, municipio } = useMunicipioAtivo();
  const { data: config, isLoading } = useConfiguracao();
  const salvar = useSalvarConfiguracao();
  const [valores, setValores] = useState<ConfiguracaoMunicipio>(CONFIG_VAZIA);
  const [brasaoPath, setBrasaoPath] = useState<string | null>(null);
  const [brasaoUrl, setBrasaoUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const admin = perfil?.ehConsultoria || perfil?.papel === "prefeitura_admin";

  useEffect(() => {
    if (isLoading) return;
    setEtapa(0);
    if (!config) {
      // Prefeitura sem configuração salva: limpa o formulário para não
      // reaproveitar (e regravar) os dados da prefeitura anterior.
      setValores({ ...CONFIG_VAZIA });
      setBrasaoPath(null);
      return;
    }
    setValores({
      nome_prefeitura: config.nome_prefeitura,
      estado: config.estado,
      secretaria: config.secretaria,
      setor: config.setor,
      endereco_rodape: config.endereco_rodape,
      cidade_data: config.cidade_data,
      signatario_nome: config.signatario_nome,
      signatario_cargo: config.signatario_cargo,
      texto_assinatura: config.texto_assinatura,
    });
    setBrasaoPath(config.brasao_path);
  }, [config, isLoading, municipioId]);

  useEffect(() => {
    let ativo = true;
    if (!brasaoPath) {
      setBrasaoUrl(null);
      return;
    }
    supabase.storage
      .from("brasoes")
      .createSignedUrl(brasaoPath, 3600)
      .then(({ data }) => {
        if (ativo) setBrasaoUrl(data?.signedUrl ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [brasaoPath]);

  const faltando = useMemo(() => {
    const atual = ETAPAS[etapa];
    if (!atual) return [] as Campo[];
    return atual.campos.filter((c) => c.obrigatorio && !valores[c.chave].trim());
  }, [etapa, valores]);

  const pendenciasGerais = useMemo(
    () =>
      ETAPAS.flatMap((e) => e.campos).filter(
        (c) => c.obrigatorio && !valores[c.chave].trim(),
      ),
    [valores],
  );

  async function enviarBrasao(arquivo: File) {
    if (!municipioId) return;
    setEnviando(true);
    const extensao = arquivo.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
    const caminho = `${municipioId}/brasao.${extensao}`;
    const { error } = await supabase.storage
      .from("brasoes")
      .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar o brasão.", { description: error.message });
      return;
    }
    setBrasaoPath(caminho);
    toast.success("Brasão carregado. Conclua o preenchimento para salvar.");
  }

  async function concluir() {
    if (pendenciasGerais.length > 0) {
      toast.error("Ainda faltam informações obrigatórias.");
      return;
    }
    try {
      await salvar.mutateAsync({ ...valores, brasao_path: brasaoPath });
      toast.success("Configurações salvas.");
    } catch (erro) {
      toast.error("Não foi possível salvar.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  function avancar() {
    if (faltando.length > 0) {
      toast.error("Preencha os campos obrigatórios desta etapa.");
      return;
    }
    setEtapa((e) => Math.min(e + 1, TOTAL_ETAPAS - 1));
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const etapaAtual = ETAPAS[etapa];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preenchimento guiado dos dados de{" "}
          <span className="font-medium text-foreground">
            {municipio ? `${municipio.nome}/${municipio.uf}` : "sua prefeitura"}
          </span>
          . Eles aparecem no cabeçalho, na assinatura e no rodapé dos documentos gerados.
        </p>
      </div>

      {!admin && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Apenas administradores da prefeitura podem alterar estas informações.
        </p>
      )}

      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {TITULOS.map((titulo, i) => {
          const concluida = i < etapa;
          const ativa = i === etapa;
          return (
            <li key={titulo}>
              <button
                type="button"
                onClick={() => setEtapa(i)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
                  ativa
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : concluida
                      ? "border-border text-foreground"
                      : "border-dashed border-border text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    ativa || concluida ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {concluida ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {titulo}
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Etapa {etapa + 1} de {TOTAL_ETAPAS} — {TITULOS[etapa]}
          </CardTitle>
          {etapaAtual && (
            <p className="text-sm text-muted-foreground">{etapaAtual.descricao}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {etapaAtual && (
            <div className="grid gap-4 sm:grid-cols-2">
              {etapaAtual.campos.map((campo) => (
                <div key={campo.chave} className="space-y-1.5">
                  <Label htmlFor={campo.chave}>
                    {campo.rotulo}
                    {campo.obrigatorio && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  <Input
                    id={campo.chave}
                    value={valores[campo.chave]}
                    disabled={!admin}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [campo.chave]: e.target.value }))
                    }
                  />
                  {campo.dica && (
                    <p className="text-xs text-muted-foreground">{campo.dica}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {etapa === ETAPA_BRASAO && (
            <div className="flex items-center gap-4">
              {brasaoUrl ? (
                <img
                  src={brasaoUrl}
                  alt="Brasão do município"
                  className="h-20 w-20 rounded-md border border-border object-contain p-1"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-muted-foreground">
                  Sem imagem
                </div>
              )}
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) void enviarBrasao(arquivo);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!admin || enviando}
                  onClick={() => inputRef.current?.click()}
                >
                  {enviando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Enviar brasão
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  PNG ou JPG, fundo claro. Esta etapa é opcional.
                </p>
              </div>
            </div>
          )}

          {etapa === ETAPA_REVISAO && (
            <div className="space-y-4">
              {pendenciasGerais.length > 0 && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  Faltam preencher: {pendenciasGerais.map((c) => c.rotulo).join(", ")}.
                </p>
              )}
              <dl className="divide-y divide-border rounded-md border border-border">
                {ETAPAS.flatMap((e) => e.campos).map((campo) => (
                  <div
                    key={campo.chave}
                    className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[220px_1fr]"
                  >
                    <dt className="text-muted-foreground">{campo.rotulo}</dt>
                    <dd className="font-medium">
                      {valores[campo.chave].trim() || (
                        <span className="font-normal text-muted-foreground">Não informado</span>
                      )}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-1 px-3 py-2 text-sm sm:grid-cols-[220px_1fr]">
                  <dt className="text-muted-foreground">Brasão</dt>
                  <dd className="font-medium">
                    {brasaoPath ? (
                      "Enviado"
                    ) : (
                      <span className="font-normal text-muted-foreground">Não enviado</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={etapa === 0}
          onClick={() => setEtapa((e) => Math.max(e - 1, 0))}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {etapa < ETAPA_REVISAO ? (
          <Button type="button" onClick={avancar} disabled={!admin}>
            Continuar
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void concluir()}
            disabled={!admin || salvar.isPending || pendenciasGerais.length > 0}
          >
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar configurações
          </Button>
        )}
      </div>
    </div>
  );
}
