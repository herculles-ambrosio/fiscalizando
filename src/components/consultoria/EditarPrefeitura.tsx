import { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CONFIG_VAZIA, useConfiguracao, useSalvarConfiguracao } from "@/hooks/useConfiguracao";
import type { ConfiguracaoMunicipio } from "@/lib/oficios/zerados";
import { chaveNome } from "@/lib/vaf/resolucao";

export type PrefeituraEdicao = {
  id: string;
  nome: string;
  uf: string;
  codigo_sef: string;
  cliente: boolean;
  fonte_indice: string;
};

const CAMPOS: { chave: keyof ConfiguracaoMunicipio; rotulo: string }[] = [
  { chave: "nome_prefeitura", rotulo: "Nome da prefeitura" },
  { chave: "estado", rotulo: "Estado" },
  { chave: "secretaria", rotulo: "Secretaria" },
  { chave: "setor", rotulo: "Setor" },
  { chave: "endereco_rodape", rotulo: "Endereço (rodapé)" },
  { chave: "cidade_data", rotulo: "Cidade da data" },
  { chave: "signatario_nome", rotulo: "Nome de quem assina" },
  { chave: "signatario_cargo", rotulo: "Cargo de quem assina" },
  { chave: "texto_assinatura", rotulo: "Texto da assinatura" },
];

export default function EditarPrefeitura({
  prefeitura,
  onOpenChange,
}: {
  prefeitura: PrefeituraEdicao | null;
  onOpenChange: (aberto: boolean) => void;
}) {
  const municipioId = prefeitura?.id ?? null;
  const { data: config, isLoading } = useConfiguracao(municipioId);
  const salvarConfig = useSalvarConfiguracao(municipioId);
  const queryClient = useQueryClient();

  const [valores, setValores] = useState<ConfiguracaoMunicipio>(CONFIG_VAZIA);
  const [brasaoPath, setBrasaoPath] = useState<string | null>(null);
  const [cliente, setCliente] = useState("nao");
  const [fonte, setFonte] = useState("apuracao");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!prefeitura) return;
    setCliente(prefeitura.cliente ? "sim" : "nao");
    setFonte(prefeitura.fonte_indice);
  }, [prefeitura]);

  useEffect(() => {
    if (!prefeitura) return;
    if (config) {
      const { id: _id, municipio_id: _m, brasao_path, ...resto } = config;
      setValores(resto);
      setBrasaoPath(brasao_path);
    } else {
      setValores({
        ...CONFIG_VAZIA,
        nome_prefeitura: `PREFEITURA MUNICIPAL DE ${prefeitura.nome.toUpperCase()}`,
        cidade_data: prefeitura.nome,
      });
      setBrasaoPath(null);
    }
  }, [config, prefeitura]);

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
    toast.success("Brasão carregado. Salve para concluir.");
  }

  /**
   * Ao marcar a prefeitura para usar os índices da Resolução SEF, vincula na
   * hora as linhas do anexo a este município (por código ou nome), para que a
   * apuração já apareça em Estatísticas sem nova importação.
   */
  async function vincularResolucao(): Promise<number> {
    if (!prefeitura) return 0;
    const { data, error } = await supabase
      .from("indices_resolucao")
      .select("id, codigo_mun, municipio_nome")
      .is("municipio_id", null);
    if (error) throw error;
    const chave = chaveNome(prefeitura.nome);
    const codigo = String(Number(prefeitura.codigo_sef || "0"));
    const alvos = (data ?? []).filter(
      (l) =>
        chaveNome(l.municipio_nome ?? "") === chave ||
        (codigo !== "0" && String(Number(l.codigo_mun)) === codigo),
    );
    if (!alvos.length) return 0;
    const { error: erroVinculo } = await supabase
      .from("indices_resolucao")
      .update({ municipio_id: prefeitura.id })
      .in(
        "id",
        alvos.map((l) => l.id),
      );
    if (erroVinculo) throw erroVinculo;
    return alvos.length;
  }

  async function salvar() {
    if (!prefeitura) return;
    setSalvando(true);
    try {
      const ehCliente = cliente === "sim";
      const { error } = await supabase
        .from("municipios")
        .update({ cliente: ehCliente, fonte_indice: fonte })
        .eq("id", prefeitura.id);
      if (error) throw error;
      await salvarConfig.mutateAsync({ ...valores, brasao_path: brasaoPath });

      let vinculados = 0;
      let falhaVinculo = false;
      if (!ehCliente && fonte === "resolucao") {
        try {
          vinculados = await vincularResolucao();
          queryClient.invalidateQueries({ queryKey: ["indices-resolucao"] });
        } catch {
          // a prefeitura já foi salva; só o vínculo com a resolução falhou
          falhaVinculo = true;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["carteira"] });
      queryClient.invalidateQueries({ queryKey: ["municipios"] });
      if (!ehCliente && fonte === "resolucao") {
        if (falhaVinculo) {
          toast.warning(
            "Prefeitura atualizada, mas não foi possível consultar os índices da Resolução SEF agora. Tente salvar novamente mais tarde.",
          );
        } else {
          toast.success(
            vinculados
              ? "Prefeitura atualizada. Índices da Resolução SEF já disponíveis em Estatísticas."
              : "Prefeitura atualizada, mas nenhum índice da Resolução SEF foi encontrado para ela. Importe a resolução em Índices da Resolução.",
          );
        }
      } else {
        toast.success("Prefeitura atualizada.");
      }
      if (!falhaVinculo) onOpenChange(false);
    } catch (erro) {
      toast.error("Não foi possível salvar.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={!!prefeitura} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {prefeitura ? `${prefeitura.nome}/${prefeitura.uf}` : "Prefeitura"}
          </SheetTitle>
          <SheetDescription>
            Dados usados nos ofícios e relatórios desta prefeitura.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Situação comercial</Label>
                <Select value={cliente} onValueChange={setCliente}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">É cliente</SelectItem>
                    <SelectItem value="nao">Não é cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Origem dos índices</Label>
                <Select value={fonte} onValueChange={setFonte} disabled={cliente === "sim"}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apuracao">Apurações feitas no sistema</SelectItem>
                    <SelectItem value="resolucao">Índices da Resolução SEF</SelectItem>
                  </SelectContent>
                </Select>
                {cliente === "sim" && (
                  <p className="text-xs text-muted-foreground">
                    Clientes usam sempre as apurações feitas no sistema.
                  </p>
                )}
              </div>
            </div>

            {CAMPOS.map((campo) => (
              <div key={campo.chave} className="space-y-2">
                <Label htmlFor={campo.chave}>{campo.rotulo}</Label>
                <Input
                  id={campo.chave}
                  value={valores[campo.chave]}
                  onChange={(e) => setValores((v) => ({ ...v, [campo.chave]: e.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="brasao">Brasão</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="brasao"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void enviarBrasao(f);
                  }}
                />
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {brasaoPath ? "Brasão cadastrado." : "Nenhum brasão enviado."}
              </p>
            </div>

            <Button onClick={salvar} disabled={salvando} className="w-full">
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
