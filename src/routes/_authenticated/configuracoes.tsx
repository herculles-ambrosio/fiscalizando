import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { CONFIG_VAZIA, useConfiguracao, useSalvarConfiguracao } from "@/hooks/useConfiguracao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const CAMPOS: { chave: keyof ConfiguracaoMunicipio; rotulo: string; dica?: string }[] = [
  { chave: "nome_prefeitura", rotulo: "Nome da prefeitura" },
  { chave: "estado", rotulo: "Estado (linha do cabeçalho)" },
  { chave: "secretaria", rotulo: "Secretaria" },
  { chave: "setor", rotulo: "Setor" },
  { chave: "cidade_data", rotulo: "Cidade/UF da data", dica: "Ex.: Nanuque/MG" },
  { chave: "endereco_rodape", rotulo: "Endereço do rodapé" },
  { chave: "texto_assinatura", rotulo: "Texto acima da assinatura" },
  { chave: "signatario_nome", rotulo: "Nome do signatário" },
  { chave: "signatario_cargo", rotulo: "Cargo do signatário" },
];

function Configuracoes() {
  const { data: perfil } = usePerfil();
  const { municipioId } = useMunicipioAtivo();
  const { data: config, isLoading } = useConfiguracao();
  const salvar = useSalvarConfiguracao();
  const [valores, setValores] = useState<ConfiguracaoMunicipio>(CONFIG_VAZIA);
  const [brasaoPath, setBrasaoPath] = useState<string | null>(null);
  const [brasaoUrl, setBrasaoUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const admin = perfil?.ehConsultoria || perfil?.papel === "prefeitura_admin";

  useEffect(() => {
    if (!config) return;
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
  }, [config]);

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
    await salvar.mutateAsync({ ...valores, brasao_path: caminho });
    toast.success("Brasão atualizado.");
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    try {
      await salvar.mutateAsync({ ...valores, brasao_path: brasaoPath });
      toast.success("Configurações salvas.");
    } catch (erro) {
      toast.error("Não foi possível salvar.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estes dados aparecem no cabeçalho, na assinatura e no rodapé dos ofícios gerados.
        </p>
      </div>

      {!admin && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Apenas administradores da prefeitura podem alterar estas informações.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brasão</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {brasaoUrl ? (
            <img
              src={brasaoUrl}
              alt="Brasão do município"
              className="h-20 w-20 rounded-md border border-border object-contain p-1"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
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
            <p className="mt-2 text-xs text-muted-foreground">PNG ou JPG, fundo claro.</p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={submeter}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados institucionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((campo) => (
              <div key={campo.chave} className="space-y-1.5">
                <Label htmlFor={campo.chave}>{campo.rotulo}</Label>
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
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={!admin || salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
