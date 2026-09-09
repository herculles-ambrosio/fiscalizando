/** Editor dos modelos de documentos do Fiscaliza Cartório. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useCartorioConfig, useFiscalizacaoCartorio, type Competencia } from "@/hooks/useCartorios";
import {
  useExcluirModeloCartorio,
  useModelosCartorio,
  useSalvarModeloCartorio,
} from "@/hooks/useCartorioModelos";
import { gerarDocxCartorio } from "@/lib/cartorios/documento";
import {
  MODELOS_CARTORIO_PADRAO,
  PLACEHOLDERS_CARTORIO,
  ROTULO_TIPO_DOC,
  TIPOS_DOC_CARTORIO,
  novaChaveCartorio,
  type ModeloCartorio,
  type TipoDocCartorio,
} from "@/lib/cartorios/modelos";
import { carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import type { LinhaFiscalizacao } from "@/hooks/useCartorios";

const EXEMPLO: LinhaFiscalizacao = {
  cns: "00.000-0",
  nome: "CARTÓRIO DE REGISTRO CIVIL E NOTAS (exemplo)",
  comarca: "Comarca de exemplo",
  tipoServico: "Notas e Registro Civil",
  status: "ATIVO",
  emolumentos: 42000,
  recompe: 0,
  tfj: 0,
  despesa: 0,
  baseDeclarada: 18000,
  issDeclarado: 900,
  issPago: 900,
  issDevido: 2100,
  diferencaBase: 24000,
  diferencaIss: 1200,
  temDeclaracao: true,
};

export default function ModelosCartorioView({ competencia }: { competencia: Competencia | null }) {
  const { data: modelos } = useModelosCartorio();
  const { data: config } = useConfiguracao();
  const { data: cartorioConfig } = useCartorioConfig();
  const { data: linhas } = useFiscalizacaoCartorio(competencia);
  const salvar = useSalvarModeloCartorio();
  const excluir = useExcluirModeloCartorio();

  const [chave, setChave] = useState("");
  const [rascunho, setRascunho] = useState<ModeloCartorio | null>(null);
  const [previaBlob, setPreviaBlob] = useState<Blob | null>(null);
  const previaRef = useRef<HTMLDivElement | null>(null);

  const atual = useMemo(() => modelos?.find((m) => m.chave === chave), [modelos, chave]);

  useEffect(() => {
    if (!chave && modelos?.length) setChave(modelos[0]!.chave);
  }, [modelos, chave]);

  useEffect(() => {
    if (atual) setRascunho({ ...atual });
  }, [atual]);

  useEffect(() => {
    if (!previaBlob || !previaRef.current) return;
    let cancelado = false;
    const destino = previaRef.current;
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      destino.innerHTML = "";
      await renderAsync(previaBlob, destino, undefined, { className: "docx", inWrapper: true });
    })();
    return () => {
      cancelado = true;
    };
  }, [previaBlob]);

  function alterar(campo: Partial<ModeloCartorio>) {
    setRascunho((r) => (r ? { ...r, ...campo } : r));
  }

  function novoModelo() {
    const base = MODELOS_CARTORIO_PADRAO[0]!;
    const nome = "Novo documento";
    const modelo: ModeloCartorio = { ...base, chave: novaChaveCartorio(nome), nome, tipo: "GERAL" };
    setRascunho(modelo);
    setChave(modelo.chave);
  }

  function restaurarPadrao() {
    const padrao = MODELOS_CARTORIO_PADRAO.find((m) => m.chave === rascunho?.chave);
    if (!padrao) {
      toast.error("Este modelo não tem versão padrão.");
      return;
    }
    setRascunho({ ...padrao });
    toast.success("Texto padrão restaurado. Salve para confirmar.");
  }

  async function verPrevia() {
    if (!rascunho) return;
    if (!config?.nome_prefeitura) {
      toast.error("Preencha os dados da prefeitura em Configurações.");
      return;
    }
    const linha = linhas?.[0] ?? EXEMPLO;
    const brasao = await carregarBrasao(config.brasao_path);
    const blob = await gerarDocxCartorio({
      modelo: rascunho,
      linha,
      competencia: competencia ?? { ano: new Date().getFullYear(), mes: 1 },
      aliquota: cartorioConfig?.aliquota_iss ?? 5,
      prazoDias: 30,
      config,
      dataDocumento: hojeIso(),
      brasao,
    });
    setPreviaBlob(blob);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Modelos de documento</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chave} onValueChange={setChave}>
              <SelectTrigger className="h-9 w-64">
                <SelectValue placeholder="Escolha um modelo" />
              </SelectTrigger>
              <SelectContent>
                {(modelos ?? []).map((m) => (
                  <SelectItem key={m.chave} value={m.chave}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={novoModelo}>
              <Plus className="mr-2 size-4" />
              Novo
            </Button>
          </div>
        </CardHeader>

        {rascunho && (
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Nome do modelo</Label>
                <Input
                  className="h-9"
                  value={rascunho.nome}
                  onChange={(e) => alterar({ nome: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={rascunho.tipo}
                  onValueChange={(v) => alterar({ tipo: v as TipoDocCartorio })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOC_CARTORIO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ROTULO_TIPO_DOC[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Título do documento</Label>
                <Input
                  className="h-9"
                  value={rascunho.titulo}
                  onChange={(e) => alterar({ titulo: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["margem_topo", "Margem superior (cm)"],
                  ["margem_direita", "Margem direita (cm)"],
                  ["margem_inferior", "Margem inferior (cm)"],
                  ["margem_esquerda", "Margem esquerda (cm)"],
                ] as const
              ).map(([campo, rotulo]) => (
                <div key={campo} className="space-y-1">
                  <Label>{rotulo}</Label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    value={String(rascunho[campo] ?? 1.9)}
                    onChange={(e) =>
                      alterar({ [campo]: Number(e.target.value.replace(",", ".")) || 0 })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <Label>Cabeçalho (uma linha por linha do topo)</Label>
                <Textarea
                  rows={4}
                  value={rascunho.cabecalho ?? ""}
                  onChange={(e) => alterar({ cabecalho: e.target.value })}
                  placeholder="Em branco usa os dados da tela Configurações."
                />
              </div>
              <div className="space-y-1">
                <Label>Rodapé</Label>
                <Textarea
                  rows={4}
                  value={rascunho.rodape ?? ""}
                  onChange={(e) => alterar({ rodape: e.target.value })}
                  placeholder="Em branco usa o endereço cadastrado em Configurações."
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Texto do documento</Label>
              <Textarea
                rows={16}
                className="font-mono text-xs"
                value={rascunho.corpo}
                onChange={(e) => alterar({ corpo: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS_CARTORIO.map((p) => (
                <Badge
                  key={p.chave}
                  variant="secondary"
                  title={p.descricao}
                  className="cursor-pointer"
                  onClick={() => alterar({ corpo: `${rascunho.corpo}${p.chave}` })}
                >
                  {p.chave}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={rascunho.ativo}
                  onCheckedChange={(v) => alterar({ ativo: v })}
                  id="modelo-ativo"
                />
                <Label htmlFor="modelo-ativo">Disponível para emissão</Label>
              </div>
              <Button
                onClick={() =>
                  salvar.mutate(rascunho, {
                    onSuccess: () => {
                      setChave(rascunho.chave);
                      toast.success("Modelo salvo.");
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
                disabled={salvar.isPending}
              >
                <Save className="mr-2 size-4" />
                Salvar
              </Button>
              <Button variant="outline" onClick={() => void verPrevia()}>
                <Eye className="mr-2 size-4" />
                Ver prévia
              </Button>
              <Button variant="outline" onClick={restaurarPadrao}>
                <RotateCcw className="mr-2 size-4" />
                Restaurar padrão
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  excluir.mutate(rascunho.chave, {
                    onSuccess: () => {
                      setChave("");
                      toast.success("Modelo excluído.");
                    },
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                <Trash2 className="mr-2 size-4" />
                Excluir
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {previaBlob && (
        <div
          ref={previaRef}
          className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx-wrapper>section.docx]:mx-auto [&_.docx-wrapper>section.docx]:shadow-sm"
        />
      )}
    </div>
  );
}
