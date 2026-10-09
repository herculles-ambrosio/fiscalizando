/** Aba "Documentos da prefeitura": modelos exclusivos do município e emissão. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import {
  useExcluirModeloPrefeitura,
  useModelosPrefeitura,
  useSalvarModeloPrefeitura,
} from "@/hooks/useDocumentosPrefeitura";
import {
  gerarDocxPrefeitura,
  nomeArquivoPrefeitura,
  novoModeloPrefeitura,
  PLACEHOLDERS_GERAIS,
  ROTULO_DESTINATARIO,
  zipDocumentos,
  type DestinatarioModelo,
  type FonteDestinatario,
  type ModeloPrefeitura,
  type ModuloDocumento,
} from "@/lib/documentosPrefeitura";
import { baixarBlob, carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";

type Props = {
  modulo: ModuloDocumento;
  /** Registros do módulo que podem receber o documento. */
  fontes: FonteDestinatario[];
  rotuloFontes: string;
  /** Campos extras disponíveis nos registros do módulo. */
  placeholdersModulo?: { chave: string; descricao: string }[];
};

const LIVRE_VAZIO: FonteDestinatario = { id: "livre", nome: "", documento: "", endereco: "" };

export default function DocumentosPrefeituraView({ modulo, fontes, rotuloFontes, placeholdersModulo = [] }: Props) {
  const { municipio } = useMunicipioAtivo();
  const { data: config } = useConfiguracao();
  const { data: modelos = [] } = useModelosPrefeitura(modulo);
  const salvar = useSalvarModeloPrefeitura();
  const excluir = useExcluirModeloPrefeitura();

  const [chave, setChave] = useState("");
  const [rascunho, setRascunho] = useState<ModeloPrefeitura | null>(null);
  const [modo, setModo] = useState<"livre" | "dados">("livre");
  const [livre, setLivre] = useState<FonteDestinatario>(LIVRE_VAZIO);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [prazo, setPrazo] = useState("30");
  const [data, setData] = useState(hojeIso());
  const [gerando, setGerando] = useState(false);
  const [previa, setPrevia] = useState<Blob | null>(null);
  const previaRef = useRef<HTMLDivElement | null>(null);

  const atual = useMemo(() => modelos.find((m) => m.chave === chave), [modelos, chave]);
  useEffect(() => {
    if (!chave && modelos.length) setChave(modelos[0]!.chave);
  }, [modelos, chave]);
  useEffect(() => {
    if (atual) setRascunho({ ...atual });
  }, [atual]);
  useEffect(() => {
    if (rascunho?.destinatario === "livre") setModo("livre");
    else if (rascunho?.destinatario === "dados") setModo("dados");
  }, [rascunho?.destinatario]);
  useEffect(() => {
    if (!previa || !previaRef.current) return;
    const destino = previaRef.current;
    let cancelado = false;
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      destino.innerHTML = "";
      await renderAsync(previa, destino, undefined, { className: "docx", inWrapper: true, ignoreHeight: true });
    })();
    return () => {
      cancelado = true;
    };
  }, [previa]);

  const alterar = (c: Partial<ModeloPrefeitura>) => setRascunho((r) => (r ? { ...r, ...c } : r));

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return fontes;
    const d = t.replace(/\D/g, "");
    return fontes.filter(
      (f) => f.nome.toLowerCase().includes(t) || (d && f.documento.replace(/\D/g, "").includes(d)),
    );
  }, [fontes, busca]);
  const visiveis = filtradas.slice(0, 100);

  const destinatarios = (): FonteDestinatario[] =>
    modo === "livre" ? (livre.nome.trim() ? [livre] : []) : fontes.filter((f) => marcados.has(f.id));

  async function gerar(apenasPrevia: boolean) {
    if (!rascunho) return;
    if (!config?.nome_prefeitura || !config.cidade_data) {
      toast.error("Preencha os dados da prefeitura em Configurações antes de emitir.");
      return;
    }
    const lista = destinatarios();
    const alvo = lista.length ? lista : apenasPrevia ? [modo === "livre" ? { ...livre, nome: livre.nome || "DESTINATÁRIO DE EXEMPLO" } : fontes[0] ?? { ...LIVRE_VAZIO, nome: "DESTINATÁRIO DE EXEMPLO" }] : [];
    if (!alvo.length) {
      toast.error(modo === "livre" ? "Informe o nome do destinatário." : "Selecione ao menos um destinatário.");
      return;
    }
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const base = { modelo: rascunho, prazoDias: Number(prazo) || 30, config, dataDocumento: data, brasao };
      if (apenasPrevia) {
        setPrevia(await gerarDocxPrefeitura({ ...base, destinatario: alvo[0]! }));
        return;
      }
      const docs = [];
      for (const d of alvo) docs.push({ nome: nomeArquivoPrefeitura(rascunho.chave, d), blob: await gerarDocxPrefeitura({ ...base, destinatario: d }) });
      if (docs.length === 1) baixarBlob(docs[0]!.blob, docs[0]!.nome);
      else baixarBlob(await zipDocumentos(docs), `${rascunho.chave}_${docs.length}_documentos.zip`);
      toast.success(`${docs.length} documento(s) gerado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o documento.");
    } finally {
      setGerando(false);
    }
  }

  const placeholders = [...PLACEHOLDERS_GERAIS, ...(modo === "dados" || rascunho?.destinatario !== "livre" ? placeholdersModulo : [])];
  const naoSalvo = rascunho && !modelos.some((m) => m.chave === rascunho.chave);

  return (
    <div className="space-y-4">
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        Modelos exclusivos de <strong>{municipio?.nome ?? "esta prefeitura"}</strong>: só aparecem para ela. Os modelos
        padrão continuam disponíveis nas abas de documentos de sempre. Brasão, cabeçalho, assinatura e rodapé vêm das
        Configurações da prefeitura.
      </p>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Modelos da prefeitura</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={chave} onValueChange={setChave}>
              <SelectTrigger className="h-9 w-72"><SelectValue placeholder="Nenhum modelo próprio ainda" /></SelectTrigger>
              <SelectContent>
                {modelos.map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}{m.ativo ? "" : " (inativo)"}</SelectItem>)}
                {naoSalvo && <SelectItem value={rascunho.chave}>{rascunho.nome} (não salvo)</SelectItem>}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { const m = novoModeloPrefeitura(modulo); setRascunho(m); setChave(m.chave); }}>
              <Plus className="mr-2 size-4" />Novo
            </Button>
            <Button variant="outline" size="sm" disabled={!rascunho} onClick={() => {
              if (!rascunho) return;
              const { id: _id, ...resto } = rascunho;
              const m = { ...resto, chave: `proprio_${Date.now().toString(36)}`, nome: `${rascunho.nome} (cópia)` };
              setRascunho(m); setChave(m.chave);
            }}>
              <Copy className="mr-2 size-4" />Duplicar
            </Button>
          </div>
        </CardHeader>
        {!rascunho && (
          <CardContent className="text-sm text-muted-foreground">Clique em “Novo” para criar o primeiro modelo exclusivo desta prefeitura.</CardContent>
        )}
        {rascunho && (
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Nome do modelo</Label>
                <Input className="h-9" value={rascunho.nome} onChange={(e) => alterar({ nome: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Para quem</Label>
                <Select value={rascunho.destinatario} onValueChange={(v) => alterar({ destinatario: v as DestinatarioModelo })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROTULO_DESTINATARIO).map(([k, r]) => <SelectItem key={k} value={k}>{k === "dados" ? rotuloFontes : r}</SelectItem>)}
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
                <Textarea rows={3} value={rascunho.cabecalho ?? ""} onChange={(e) => alterar({ cabecalho: e.target.value })} placeholder="Em branco usa brasão, prefeitura e Estado das Configurações." />
              </div>
              <div className="space-y-1">
                <Label>Rodapé</Label>
                <Textarea rows={3} value={rascunho.rodape ?? ""} onChange={(e) => alterar({ rodape: e.target.value })} placeholder="Em branco usa o endereço cadastrado em Configurações." />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Texto do documento</Label>
              <Textarea rows={14} className="font-mono text-xs" value={rascunho.corpo} onChange={(e) => alterar({ corpo: e.target.value })} />
              <p className="text-xs text-muted-foreground"># linha centralizada em negrito · &gt; citação em itálico · * Rótulo: valor em negrito</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {placeholders.map((p) => (
                <Badge key={p.chave} variant="secondary" title={p.descricao} className="cursor-pointer" onClick={() => alterar({ corpo: `${rascunho.corpo}${p.chave}` })}>{p.chave}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id={`doc-pref-ativo-${modulo}`} checked={rascunho.ativo} onCheckedChange={(v) => alterar({ ativo: v })} />
                <Label htmlFor={`doc-pref-ativo-${modulo}`}>Disponível para emissão</Label>
              </div>
              <Button disabled={salvar.isPending} onClick={() => salvar.mutate(rascunho, { onSuccess: () => { setChave(rascunho.chave); toast.success("Modelo salvo."); }, onError: (e) => toast.error(e.message) })}>
                <Save className="mr-2 size-4" />Salvar
              </Button>
              <Button variant="ghost" onClick={() => {
                if (naoSalvo) { setRascunho(null); setChave(""); return; }
                if (!confirm(`Excluir o modelo “${rascunho.nome}”?`)) return;
                excluir.mutate({ modulo, chave: rascunho.chave }, { onSuccess: () => { setChave(""); setRascunho(null); toast.success("Modelo excluído."); }, onError: (e) => toast.error(e.message) });
              }}>
                <Trash2 className="mr-2 size-4" />Excluir
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {rascunho && (
        <Card>
          <CardHeader><CardTitle className="text-base">Emitir “{rascunho.nome}”</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Destinatário</Label>
                <Select value={modo} onValueChange={(v) => setModo(v as "livre" | "dados")} disabled={rascunho.destinatario !== "ambos"}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="livre">Digitar destinatário</SelectItem>
                    <SelectItem value="dados">{rotuloFontes}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prazo (dias)</Label>
                <Input className="h-9" inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data do documento</Label>
                <Input className="h-9" type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>

            {modo === "livre" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Nome / razão social</Label>
                  <Input className="h-9" value={livre.nome} onChange={(e) => setLivre({ ...livre, nome: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ / CPF / inscrição</Label>
                  <Input className="h-9" value={livre.documento} onChange={(e) => setLivre({ ...livre, documento: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Endereço</Label>
                  <Input className="h-9" value={livre.endereco} onChange={(e) => setLivre({ ...livre, endereco: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input className="h-9 max-w-sm" placeholder="Buscar por nome ou documento" value={busca} onChange={(e) => setBusca(e.target.value)} />
                  <Button variant="ghost" size="sm" onClick={() => setMarcados(new Set(filtradas.map((f) => f.id)))}>Marcar todos ({filtradas.length})</Button>
                  <Button variant="ghost" size="sm" onClick={() => setMarcados(new Set())}>Limpar</Button>
                  <span className="text-xs text-muted-foreground">{marcados.size} selecionado(s)</span>
                </div>
                <div className="max-h-72 divide-y overflow-auto rounded-md border">
                  {visiveis.map((f) => (
                    <label key={f.id} className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                      <Checkbox className="mt-0.5" checked={marcados.has(f.id)} onCheckedChange={(v) => setMarcados((s) => { const n = new Set(s); if (v) n.add(f.id); else n.delete(f.id); return n; })} />
                      <span>
                        <span className="font-medium">{f.nome}</span>
                        <span className="block text-xs text-muted-foreground">{[f.documento, f.detalhe].filter(Boolean).join(" — ")}</span>
                      </span>
                    </label>
                  ))}
                  {!visiveis.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum registro disponível.</p>}
                </div>
                {filtradas.length > visiveis.length && <p className="text-xs text-muted-foreground">Mostrando 100 de {filtradas.length}; use a busca ou “Marcar todos”.</p>}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={gerando} onClick={() => void gerar(false)}>
                {gerando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Gerar documento(s)
              </Button>
              <Button variant="outline" disabled={gerando} onClick={() => void gerar(true)}><Eye className="mr-2 size-4" />Ver prévia</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {previa && <div ref={previaRef} className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0" />}
    </div>
  );
}
