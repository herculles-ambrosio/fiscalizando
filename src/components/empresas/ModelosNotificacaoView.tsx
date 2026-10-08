/** Editor dos modelos de notificação do módulo Empresas (mesmo padrão dos Ofícios). */

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useExcluirModeloEmpresa, useModelosEmpresa, useSalvarModeloEmpresa } from "@/hooks/useEmpresasNotificacoes";
import {
  gerarDocxNotificacao, MODELOS_EMPRESA_PADRAO, novaChaveEmpresa, OBSERVACOES_NOTIFICACAO, PLACEHOLDERS_EMPRESA,
  type EmpresaNotificada, type ModeloEmpresa, type ObservacaoNotificacao,
} from "@/lib/empresas/notificacoes";
import { carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";

const EXEMPLO: EmpresaNotificada = {
  cnpj: "11222333000181",
  razao_social: "EMPRESA DE EXEMPLO LTDA",
  logradouro: "Rua Exemplo",
  numero: "100",
  bairro: "Centro",
  cnae_principal: "4711302",
  cnae_descricao: "Comércio varejista de mercadorias em geral",
  situacao: "ATIVA",
  data_inicio: "2022-03-10",
};

export function ModelosNotificacaoView({ exemplo }: { exemplo?: EmpresaNotificada }) {
  const { data: modelos } = useModelosEmpresa();
  const { data: config } = useConfiguracao();
  const salvar = useSalvarModeloEmpresa();
  const excluir = useExcluirModeloEmpresa();
  const [chave, setChave] = useState("");
  const [rascunho, setRascunho] = useState<ModeloEmpresa | null>(null);
  const [previa, setPrevia] = useState<Blob | null>(null);
  const previaRef = useRef<HTMLDivElement | null>(null);
  const atual = useMemo(() => modelos?.find((m) => m.chave === chave), [modelos, chave]);

  useEffect(() => { if (!chave && modelos?.length) setChave(modelos[0]!.chave); }, [modelos, chave]);
  useEffect(() => { if (atual) setRascunho({ ...atual }); }, [atual]);
  useEffect(() => {
    if (!previa || !previaRef.current) return;
    const destino = previaRef.current;
    let cancelado = false;
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      destino.innerHTML = "";
      await renderAsync(previa, destino, undefined, { className: "docx", inWrapper: true });
    })();
    return () => { cancelado = true; };
  }, [previa]);

  const alterar = (c: Partial<ModeloEmpresa>) => setRascunho((r) => (r ? { ...r, ...c } : r));

  function novo() {
    const m: ModeloEmpresa = { ...MODELOS_EMPRESA_PADRAO[0]!, chave: novaChaveEmpresa(), nome: "Nova notificação" };
    setRascunho(m);
    setChave(m.chave);
  }

  async function verPrevia() {
    if (!rascunho) return;
    if (!config?.nome_prefeitura) { toast.error("Preencha os dados da prefeitura em Configurações."); return; }
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      setPrevia(await gerarDocxNotificacao({ modelo: rascunho, empresa: exemplo ?? EXEMPLO, prazoDias: 30, config, dataDocumento: hojeIso(), brasao }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar a prévia.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Modelos de notificação</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chave} onValueChange={setChave}>
              <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Escolha um modelo" /></SelectTrigger>
              <SelectContent>
                {(modelos ?? []).map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}</SelectItem>)}
                {rascunho && !modelos?.some((m) => m.chave === rascunho.chave) && <SelectItem value={rascunho.chave}>{rascunho.nome} (não salvo)</SelectItem>}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={novo}><Plus className="mr-2 size-4" />Novo</Button>
          </div>
        </CardHeader>
        {rascunho && (
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Nome do modelo</Label>
                <Input className="h-9" value={rascunho.nome} onChange={(e) => alterar({ nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Para a observação</Label>
                <Select value={rascunho.observacao} onValueChange={(v) => alterar({ observacao: v as ObservacaoNotificacao })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OBSERVACOES_NOTIFICACAO).map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Título do documento</Label>
                <Input className="h-9" value={rascunho.titulo} onChange={(e) => alterar({ titulo: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {([
                ["margem_topo", "Margem superior (cm)"],
                ["margem_direita", "Margem direita (cm)"],
                ["margem_inferior", "Margem inferior (cm)"],
                ["margem_esquerda", "Margem esquerda (cm)"],
              ] as const).map(([campo, rotulo]) => (
                <div key={campo} className="space-y-1">
                  <Label>{rotulo}</Label>
                  <Input className="h-9" inputMode="decimal" value={String(rascunho[campo] ?? 1.9)}
                    onChange={(e) => alterar({ [campo]: Number(e.target.value.replace(",", ".")) || 0 })} />
                </div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <Label>Cabeçalho (uma linha por linha do topo)</Label>
                <Textarea rows={4} value={rascunho.cabecalho ?? ""} onChange={(e) => alterar({ cabecalho: e.target.value })} placeholder="Em branco usa brasão, prefeitura e Estado das Configurações." />
              </div>
              <div className="space-y-1">
                <Label>Rodapé</Label>
                <Textarea rows={4} value={rascunho.rodape ?? ""} onChange={(e) => alterar({ rodape: e.target.value })} placeholder="Em branco usa o endereço cadastrado em Configurações." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Texto da notificação</Label>
              <Textarea rows={16} className="font-mono text-xs" value={rascunho.corpo} onChange={(e) => alterar({ corpo: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS_EMPRESA.map((p) => (
                <Badge key={p.chave} variant="secondary" title={p.descricao} className="cursor-pointer" onClick={() => alterar({ corpo: `${rascunho.corpo}${p.chave}` })}>{p.chave}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="modelo-emp-ativo" checked={rascunho.ativo} onCheckedChange={(v) => alterar({ ativo: v })} />
                <Label htmlFor="modelo-emp-ativo">Disponível para emissão</Label>
              </div>
              <Button disabled={salvar.isPending} onClick={() => salvar.mutate(rascunho, { onSuccess: () => { setChave(rascunho.chave); toast.success("Modelo salvo."); }, onError: (e) => toast.error(e.message) })}>
                <Save className="mr-2 size-4" />Salvar
              </Button>
              <Button variant="outline" onClick={() => void verPrevia()}><Eye className="mr-2 size-4" />Ver prévia</Button>
              <Button variant="outline" onClick={() => {
                const p = MODELOS_EMPRESA_PADRAO.find((m) => m.chave === rascunho.chave);
                if (!p) { toast.error("Este modelo não tem versão padrão."); return; }
                setRascunho({ ...p }); toast.success("Texto padrão restaurado. Salve para confirmar.");
              }}><RotateCcw className="mr-2 size-4" />Restaurar padrão</Button>
              <Button variant="ghost" onClick={() => excluir.mutate(rascunho.chave, { onSuccess: () => { setChave(""); toast.success("Modelo excluído."); }, onError: (e) => toast.error(e.message) })}>
                <Trash2 className="mr-2 size-4" />Excluir
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
      {previa && <div ref={previaRef} className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0" />}
    </div>
  );
}
