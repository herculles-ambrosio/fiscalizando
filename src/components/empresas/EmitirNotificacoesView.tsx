/** Emissão das notificações do módulo Empresas. */

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useHistoricoNotificacoes, useModelosEmpresa, useRegistrarNotificacoes } from "@/hooks/useEmpresasNotificacoes";
import type { Empresa } from "@/hooks/useEmpresas";
import {
  enderecoEmpresa, gerarDocxNotificacao, gerarZipNotificacoes, nomeArquivoNotificacao, OBSERVACOES_NOTIFICACAO,
  type ObservacaoNotificacao,
} from "@/lib/empresas/notificacoes";
import { baixarBlob, carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { formatarCnpj } from "@/lib/format";

export function EmitirNotificacoesView({ candidatas, semPlanilha }: { candidatas: Empresa[]; semPlanilha: boolean }) {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelosEmpresa();
  const { data: historico = [] } = useHistoricoNotificacoes();
  const registrar = useRegistrarNotificacoes();
  const observacao: ObservacaoNotificacao = "ATIVA_SEM_CADASTRO";
  const ativos = useMemo(() => (modelos ?? []).filter((m) => m.ativo && m.observacao === observacao), [modelos]);
  const [chave, setChave] = useState("");
  const [prazo, setPrazo] = useState("30");
  const [data, setData] = useState(hojeIso());
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [porPagina, setPorPagina] = useState(20);
  const [pagina, setPagina] = useState(1);
  const [gerando, setGerando] = useState(false);
  const modelo = ativos.find((m) => m.chave === chave) ?? ativos[0];

  const jaNotificadas = useMemo(() => new Map(historico.map((h) => [h.cnpj, h.criado_em] as const).reverse()), [historico]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const d = t.replace(/\D/g, "");
    return t ? candidatas.filter((e) => (e.razao_social ?? "").toLowerCase().includes(t) || (d && e.cnpj.includes(d))) : candidatas;
  }, [candidatas, busca]);
  useEffect(() => setPagina(1), [busca, porPagina]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const naPagina = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);
  const selecionadas = filtradas.filter((e) => marcados.has(e.cnpj));
  const todasMarcadas = filtradas.length > 0 && selecionadas.length === filtradas.length;

  async function emitir(lista: Empresa[]) {
    if (!config?.nome_prefeitura || !config.cidade_data) { toast.error("Preencha os dados da prefeitura em Configurações antes de emitir."); return; }
    if (!modelo) { toast.error("Nenhum modelo ativo para esta observação."); return; }
    if (!lista.length) { toast.error("Selecione ao menos uma empresa."); return; }
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const docs: { nome: string; blob: Blob }[] = [];
      for (const e of lista) {
        docs.push({ nome: nomeArquivoNotificacao(modelo.chave, e), blob: await gerarDocxNotificacao({ modelo, empresa: e, prazoDias: Number(prazo) || 30, config, dataDocumento: data, brasao }) });
      }
      if (docs.length === 1) baixarBlob(docs[0]!.blob, docs[0]!.nome);
      else baixarBlob(await gerarZipNotificacoes(docs), `notificacoes_${modelo.chave}_${data}.zip`);
      await registrar.mutateAsync(lista.map((e) => ({ cnpj: e.cnpj, nome: e.razao_social, observacao: OBSERVACOES_NOTIFICACAO[observacao], modelo_chave: modelo.chave, modelo_nome: modelo.nome })));
      toast.success(`${docs.length} notificação(ões) gerada(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar as notificações.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      {!config?.nome_prefeitura && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Brasão, nome da prefeitura, assinatura e rodapé vêm da tela Configurações. Preencha-a antes de emitir.
        </p>
      )}
      {semPlanilha && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Esta prefeitura ainda não tem o cadastro econômico importado em "Comparar com cadastro da prefeitura". Importe a planilha para a lista ficar correta.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificação a emitir</CardTitle>
          <p className="text-sm text-muted-foreground">Observação: {OBSERVACOES_NOTIFICACAO[observacao]} — {candidatas.length} empresa(s).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Select value={modelo?.chave ?? ""} onValueChange={setChave}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Modelo" /></SelectTrigger>
                <SelectContent>{ativos.map((m) => <SelectItem key={m.chave} value={m.chave}>{m.nome}</SelectItem>)}</SelectContent>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void emitir(selecionadas)} disabled={gerando || !selecionadas.length}>
              {gerando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              Gerar notificações das selecionadas ({selecionadas.length})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Empresas</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-9 w-64" placeholder="Buscar por nome ou CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => setMarcados(todasMarcadas ? new Set() : new Set(filtradas.map((e) => e.cnpj)))}>
              {todasMarcadas ? "Desmarcar todas" : "Selecionar todas"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Empresa</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Última notificação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {naPagina.map((e) => {
                const ult = jaNotificadas.get(e.cnpj);
                return (
                  <TableRow key={e.cnpj}>
                    <TableCell>
                      <Checkbox checked={marcados.has(e.cnpj)} aria-label={`Selecionar ${e.razao_social ?? e.cnpj}`}
                        onCheckedChange={(v) => setMarcados((m) => { const n = new Set(m); if (v) n.add(e.cnpj); else n.delete(e.cnpj); return n; })} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{e.razao_social ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{formatarCnpj(e.cnpj)}</div>
                    </TableCell>
                    <TableCell className="text-xs">{enderecoEmpresa(e)}</TableCell>
                    <TableCell className="text-xs">{e.cnae_descricao ?? e.cnae_principal ?? "—"}</TableCell>
                    <TableCell className="text-xs">{ult ? new Date(ult).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" disabled={gerando} onClick={() => void emitir([e])}><Download className="mr-1 size-4" />Gerar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtradas.length && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa nesta situação.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Empresas por página</span>
              <Select value={String(porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{[10, 15, 20, 25].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
              <span>Página {pagina} de {totalPaginas}</span>
              <Button size="sm" variant="outline" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de notificações emitidas</CardTitle></CardHeader>
        <CardContent className="max-h-96 overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Data</TableHead><TableHead>Empresa</TableHead><TableHead>Modelo</TableHead><TableHead>Emitido por</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs">{new Date(h.criado_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><div className="text-sm">{h.nome ?? "—"}</div><div className="text-xs text-muted-foreground">{formatarCnpj(h.cnpj)}</div></TableCell>
                  <TableCell className="text-xs">{h.modelo_nome}</TableCell>
                  <TableCell className="text-xs">{h.emitido_por_nome ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!historico.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhuma notificação emitida ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
