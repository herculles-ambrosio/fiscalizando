import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useGravarBancos, useHistoricoBancos, useModelosBanco } from "@/hooks/useBancos";
import { useConferenciaBancos } from "./useConferenciaBancos";
import {
  gerarDocxBanco, MODELOS_BANCO_PADRAO, nomeArquivoBanco, PLACEHOLDERS_BANCO, zipDocs,
  type DadosNotificacaoBanco, type ModeloBanco,
} from "@/lib/bancos/notificacoes";
import { textoContas, type ResumoInstituicao } from "@/lib/bancos/resumo";
import { baixarBlob, carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { formatarMoeda } from "@/lib/format";

const anoAtual = new Date().getFullYear();

function dados(r: ResumoInstituicao, ano: number, prazo: number): DadosNotificacaoBanco {
  return { nome: r.nome, cnpj: r.cnpj, competencia: `exercício de ${ano}`, contas: textoContas(r), issDiferenca: r.issDiferenca, baseDeclarada: r.base, receitaBc: r.receitaBc, prazoDias: prazo };
}

export function NotificacoesBancoView() {
  return (
    <Tabs defaultValue="emitir">
      <TabsList><TabsTrigger value="emitir">Emitir</TabsTrigger><TabsTrigger value="modelos">Modelos</TabsTrigger></TabsList>
      <TabsContent value="emitir"><Emitir /></TabsContent>
      <TabsContent value="modelos"><Modelos /></TabsContent>
    </Tabs>
  );
}

function Emitir() {
  const { data: config } = useConfiguracao();
  const { modelos } = useModelosBanco();
  const { data: historico = [] } = useHistoricoBancos();
  const registrar = useGravarBancos("bancos_notificacoes");
  const [ano, setAno] = useState(anoAtual - 1);
  const { resumo } = useConferenciaBancos(ano);
  const ativos = modelos.filter((m) => m.ativo);
  const [chave, setChave] = useState("");
  const modelo = ativos.find((m) => m.chave === chave) ?? ativos[0];
  const [prazo, setPrazo] = useState("30");
  const [data, setData] = useState(hojeIso());
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);
  useEffect(() => setMarcados(new Set(resumo.filter((r) => r.alertas.length).map((r) => r.cnpj))), [resumo]);

  async function emitir(lista: ResumoInstituicao[]) {
    if (!config?.nome_prefeitura) { toast.error("Preencha os dados da prefeitura em Configurações."); return; }
    if (!modelo) { toast.error("Nenhum modelo ativo."); return; }
    if (!lista.length) { toast.error("Selecione ao menos uma instituição."); return; }
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const docs = [];
      for (const r of lista) {
        const d = dados(r, ano, Number(prazo) || 30);
        docs.push({ nome: nomeArquivoBanco(modelo.chave, d), blob: await gerarDocxBanco({ modelo, dados: d, config, dataDocumento: data, brasao }) });
      }
      if (docs.length === 1) baixarBlob(docs[0]!.blob, docs[0]!.nome);
      else baixarBlob(await zipDocs(docs), `notificacoes_bancos_${modelo.chave}_${ano}.zip`);
      const { data: u } = await supabase.auth.getUser();
      await registrar.mutateAsync({ insert: lista.map((r) => ({ cnpj: r.cnpj, nome: r.nome, competencia: String(ano), modelo_chave: modelo.chave, modelo_nome: modelo.nome, emitido_por: u.user?.id ?? null, emitido_por_nome: u.user?.email ?? null })) });
      toast.success(`${docs.length} notificação(ões) gerada(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar.");
    } finally {
      setGerando(false);
    }
  }

  const sel = resumo.filter((r) => marcados.has(r.cnpj));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Notificação a emitir</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1"><Label>Exercício</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 6 }, (_, i) => anoAtual - i).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Modelo</Label>
              <Select value={modelo?.chave ?? ""} onValueChange={setChave}><SelectTrigger className="h-9"><SelectValue placeholder="Modelo" /></SelectTrigger>
                <SelectContent>{ativos.map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Prazo (dias)</Label><Input className="h-9" inputMode="numeric" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
            <div className="space-y-1"><Label>Data do documento</Label><Input className="h-9" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          </div>
          <Button onClick={() => void emitir(sel)} disabled={gerando || !sel.length}>
            {gerando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Gerar das selecionadas ({sel.length})
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10" /><TableHead>Instituição</TableHead><TableHead className="text-right">ISS a menor</TableHead><TableHead>Indícios</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {resumo.map((r) => (
                <TableRow key={r.cnpj}>
                  <TableCell><Checkbox checked={marcados.has(r.cnpj)} aria-label={`Selecionar ${r.nome}`} onCheckedChange={(v) => setMarcados((m) => { const n = new Set(m); if (v) n.add(r.cnpj); else n.delete(r.cnpj); return n; })} /></TableCell>
                  <TableCell><div className="font-medium">{r.nome}</div><div className="text-xs text-muted-foreground">{r.cnpj}</div></TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.issDiferenca)}</TableCell>
                  <TableCell className="space-x-1">{r.alertas.map((a) => <Badge key={a} variant="secondary" className="font-normal">{a}</Badge>)}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" disabled={gerando} onClick={() => void emitir([r])}><Download className="mr-1 size-4" />Gerar</Button></TableCell>
                </TableRow>
              ))}
              {!resumo.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Sem instituições neste exercício.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
        <CardContent className="max-h-80 overflow-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Instituição</TableHead><TableHead>Modelo</TableHead><TableHead>Exercício</TableHead><TableHead>Emitido por</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...historico].reverse().map((h) => (
                <TableRow key={h.id}><TableCell className="text-xs">{new Date(h.criado_em).toLocaleString("pt-BR")}</TableCell><TableCell>{h.nome}</TableCell><TableCell className="text-xs">{h.modelo_nome}</TableCell><TableCell>{h.competencia}</TableCell><TableCell className="text-xs">{h.emitido_por_nome ?? "—"}</TableCell></TableRow>
              ))}
              {!historico.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma notificação emitida.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const EXEMPLO: DadosNotificacaoBanco = { nome: "BANCO DE EXEMPLO S.A.", cnpj: "00000000000191", competencia: "exercício de 2025", contas: "* 7.1.7.30.00 — Rendas de tarifas (03/2025): Conta de serviço declarada como não tributável", issDiferenca: 1250, baseDeclarada: 80000, receitaBc: 410000, prazoDias: 30 };

function Modelos() {
  const { modelos } = useModelosBanco();
  const { data: config } = useConfiguracao();
  const gravar = useGravarBancos("bancos_modelos");
  const [chave, setChave] = useState("");
  const [r, setR] = useState<ModeloBanco | null>(null);
  const [previa, setPrevia] = useState<Blob | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const atual = useMemo(() => modelos.find((m) => m.chave === chave), [modelos, chave]);
  useEffect(() => { if (!chave && modelos.length) setChave(modelos[0]!.chave); }, [modelos, chave]);
  useEffect(() => { if (atual) setR({ ...atual }); }, [atual]);
  useEffect(() => {
    if (!previa || !ref.current) return;
    const el = ref.current;
    void import("docx-preview").then(({ renderAsync }) => { el.innerHTML = ""; return renderAsync(previa, el, undefined, { className: "docx", inWrapper: true }); });
  }, [previa]);
  const alt = (c: Partial<ModeloBanco>) => setR((x) => (x ? { ...x, ...c } : x));

  function salvar() {
    if (!r) return;
    const { id: _id, ...m } = r;
    gravar.mutate({ upsert: [{ ...m, margem_topo: m.margem_topo ?? 1.9, margem_direita: m.margem_direita ?? 1.9, margem_inferior: m.margem_inferior ?? 1.9, margem_esquerda: m.margem_esquerda ?? 1.9, cabecalho: m.cabecalho?.trim() ? m.cabecalho : null, rodape: m.rodape?.trim() ? m.rodape : null }], onConflict: "municipio_id,chave" },
      { onSuccess: () => { setChave(r.chave); toast.success("Modelo salvo."); }, onError: (e) => toast.error(e.message) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Modelos de notificação</CardTitle>
          <div className="flex gap-2">
            <Select value={chave} onValueChange={setChave}><SelectTrigger className="h-9 w-80"><SelectValue placeholder="Modelo" /></SelectTrigger>
              <SelectContent>
                {modelos.map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}</SelectItem>)}
                {r && !modelos.some((m) => m.chave === r.chave) && <SelectItem value={r.chave}>{r.nome} (não salvo)</SelectItem>}
              </SelectContent></Select>
            <Button variant="outline" size="sm" onClick={() => { const m = { ...MODELOS_BANCO_PADRAO[0]!, chave: `personalizado_${Date.now().toString(36)}`, nome: "Nova notificação", tipo: "GERAL" }; setR(m); setChave(m.chave); }}><Plus className="mr-2 size-4" />Novo</Button>
          </div>
        </CardHeader>
        {r && (
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Nome do modelo</Label><Input className="h-9" value={r.nome} onChange={(e) => alt({ nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Título do documento</Label><Input className="h-9" value={r.titulo} onChange={(e) => alt({ titulo: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {([["margem_topo", "Margem superior (cm)"], ["margem_direita", "Margem direita (cm)"], ["margem_inferior", "Margem inferior (cm)"], ["margem_esquerda", "Margem esquerda (cm)"]] as const).map(([c, l]) => (
                <div key={c} className="space-y-1"><Label>{l}</Label><Input className="h-9" inputMode="decimal" value={String(r[c] ?? 1.9)} onChange={(e) => alt({ [c]: Number(e.target.value.replace(",", ".")) || 0 })} /></div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1"><Label>Cabeçalho</Label><Textarea rows={3} value={r.cabecalho ?? ""} onChange={(e) => alt({ cabecalho: e.target.value })} placeholder="Em branco usa brasão, prefeitura e Estado das Configurações." /></div>
              <div className="space-y-1"><Label>Rodapé</Label><Textarea rows={3} value={r.rodape ?? ""} onChange={(e) => alt({ rodape: e.target.value })} placeholder="Em branco usa o endereço das Configurações." /></div>
            </div>
            <div className="space-y-1"><Label>Texto</Label><Textarea rows={16} className="font-mono text-xs" value={r.corpo} onChange={(e) => alt({ corpo: e.target.value })} /></div>
            <div className="flex flex-wrap gap-1">{PLACEHOLDERS_BANCO.map((p) => <Badge key={p.chave} variant="secondary" title={p.descricao} className="cursor-pointer" onClick={() => alt({ corpo: `${r.corpo}${p.chave}` })}>{p.chave}</Badge>)}</div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2"><Switch id="mb-ativo" checked={r.ativo} onCheckedChange={(v) => alt({ ativo: v })} /><Label htmlFor="mb-ativo">Disponível para emissão</Label></div>
              <Button onClick={salvar} disabled={gravar.isPending}><Save className="mr-2 size-4" />Salvar</Button>
              <Button variant="outline" onClick={() => void (async () => {
                if (!config?.nome_prefeitura) { toast.error("Preencha os dados da prefeitura em Configurações."); return; }
                setPrevia(await gerarDocxBanco({ modelo: r, dados: EXEMPLO, config, dataDocumento: hojeIso(), brasao: await carregarBrasao(config.brasao_path) }));
              })()}><Eye className="mr-2 size-4" />Ver prévia</Button>
              <Button variant="outline" onClick={() => { const p = MODELOS_BANCO_PADRAO.find((m) => m.chave === r.chave); if (!p) { toast.error("Sem versão padrão."); return; } setR({ ...p }); }}><RotateCcw className="mr-2 size-4" />Restaurar padrão</Button>
              <Button variant="ghost" onClick={() => gravar.mutate({ excluirFiltro: { chave: r.chave } }, { onSuccess: () => { setChave(""); toast.success("Modelo excluído."); } })}><Trash2 className="mr-2 size-4" />Excluir</Button>
            </div>
          </CardContent>
        )}
      </Card>
      {previa && <div ref={ref} className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2" />}
    </div>
  );
}
