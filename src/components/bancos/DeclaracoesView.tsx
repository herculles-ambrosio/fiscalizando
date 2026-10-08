import { useMemo, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useDeclaracoesBanco, useGravarBancos, useInstituicoes } from "@/hooks/useBancos";
import { lerDesif, lerPlanilhaDeclaracoes } from "@/lib/bancos/importacao";
import { formatarMoeda } from "@/lib/format";

const anoAtual = new Date().getFullYear();
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const n = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;

export function DeclaracoesView() {
  const { data: inst = [] } = useInstituicoes();
  const { data: decl = [] } = useDeclaracoesBanco();
  const gravar = useGravarBancos("bancos_declaracoes");
  const [formato, setFormato] = useState<"planilha" | "desif">("planilha");
  const [cnpj, setCnpj] = useState("");
  const [ano, setAno] = useState(String(anoAtual - 1));
  const [mes, setMes] = useState("1");
  const [manual, setManual] = useState({ base: "", iss: "" });
  const [filtroAno, setFiltroAno] = useState(String(anoAtual - 1));
  const [enviando, setEnviando] = useState(false);
  const instSel = inst.find((i) => i.cnpj === cnpj);

  async function importar(f: File) {
    setEnviando(true);
    try {
      const padrao = { cnpj, nome: instSel?.nome ?? "", ano: Number(ano), mes: Number(mes) };
      let r;
      if (formato === "desif") {
        if (!cnpj) { toast.error("Escolha a instituição do arquivo DES-IF."); return; }
        r = lerDesif(await f.text(), padrao);
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer());
        const bruto = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { raw: false, defval: "" });
        r = lerPlanilhaDeclaracoes(bruto, padrao);
      }
      if (!r.linhas.length) { toast.error("Nenhuma linha reconhecida. Confira as colunas: CNPJ, competência (mês/ano), conta COSIF e valor."); return; }
      const { data: u } = await supabase.auth.getUser();
      // Reimportar o mesmo arquivo substitui as linhas dele.
      await gravar.mutateAsync({ excluirFiltro: { arquivo_nome: f.name } });
      await gravar.mutateAsync({ insert: r.linhas.map((l) => ({ ...l, origem: formato, arquivo_nome: f.name, criado_por: u.user?.id ?? null })) });
      toast.success(`${r.linhas.length} linha(s) importadas${r.ignoradas ? ` · ${r.ignoradas} ignorada(s)` : ""}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar.");
    } finally {
      setEnviando(false);
    }
  }

  const doAno = useMemo(() => decl.filter((d) => String(d.competencia_ano) === filtroAno).sort((a, b) => a.competencia_mes - b.competencia_mes || a.cnpj.localeCompare(b.cnpj) || a.conta.localeCompare(b.conta)), [decl, filtroAno]);
  const arquivos = [...new Set(decl.map((d) => d.arquivo_nome).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar declaração do banco</CardTitle>
          <p className="text-sm text-muted-foreground">
            Planilha: colunas de CNPJ, competência (ou ano e mês), conta COSIF, descrição, valor e, se houver, tributável (S/N), alíquota e ISS.
            Sem CNPJ ou competência na planilha, usa a instituição e o mês escolhidos aqui. DES-IF: leitura experimental do arquivo texto (balancete/demonstrativo por conta COSIF).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Formato</Label>
              <Select value={formato} onValueChange={(v) => setFormato(v as "planilha" | "desif")}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="planilha">Planilha Excel/CSV</SelectItem><SelectItem value="desif">Arquivo DES-IF (texto)</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label>Instituição</Label>
              <Select value={cnpj} onValueChange={setCnpj}><SelectTrigger className="h-9 w-72"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{inst.map((i) => <SelectItem key={i.id} value={i.cnpj}>{i.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Ano</Label><Input className="h-9 w-24" value={ano} onChange={(e) => setAno(e.target.value)} /></div>
            <div className="space-y-1"><Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
            <Button asChild variant="outline" disabled={enviando}>
              <label className="cursor-pointer"><Upload className="mr-2 size-4" />{enviando ? "Importando…" : "Escolher arquivo"}
                <input type="file" className="hidden" accept={formato === "desif" ? ".txt,.csv,.desif" : ".xlsx,.xls,.csv"} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importar(f); }} />
              </label>
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <p className="w-full text-sm font-medium">Lançamento manual (quando só há o total do mês)</p>
            <div className="space-y-1"><Label>Base declarada (R$)</Label><Input className="h-9 w-44" inputMode="decimal" value={manual.base} onChange={(e) => setManual({ ...manual, base: e.target.value })} /></div>
            <div className="space-y-1"><Label>ISS declarado (R$)</Label><Input className="h-9 w-44" inputMode="decimal" value={manual.iss} onChange={(e) => setManual({ ...manual, iss: e.target.value })} /></div>
            <Button variant="outline" onClick={() => {
              if (!cnpj || !manual.base) { toast.error("Escolha a instituição e informe a base."); return; }
              gravar.mutate({ excluirFiltro: { cnpj, competencia_ano: Number(ano), competencia_mes: Number(mes), conta: "TOTAL" }, insert: [{ cnpj, instituicao_nome: instSel?.nome ?? null, competencia_ano: Number(ano), competencia_mes: Number(mes), conta: "TOTAL", descricao: "Total declarado", valor: n(manual.base), iss_declarado: manual.iss ? n(manual.iss) : null, tributavel_declarado: true, origem: "manual" }] },
                { onSuccess: () => { setManual({ base: "", iss: "" }); toast.success("Lançamento gravado."); }, onError: (e) => toast.error(e.message) });
            }}><Plus className="mr-2 size-4" />Gravar mês</Button>
          </div>
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-4 text-xs">
              <span className="text-muted-foreground">Arquivos importados:</span>
              {arquivos.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">{a}
                  <button aria-label={`Apagar ${a}`} onClick={() => gravar.mutate({ excluirFiltro: { arquivo_nome: a } })}><Trash2 className="size-3" /></button></span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Declarações gravadas</CardTitle>
          <Select value={filtroAno} onValueChange={setFiltroAno}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 6 }, (_, i) => anoAtual - i).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select>
        </CardHeader>
        <CardContent className="max-h-[32rem] overflow-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead>Instituição</TableHead><TableHead>Conta</TableHead><TableHead>Tributável?</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">ISS declarado</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {doAno.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{MESES[d.competencia_mes - 1]}</TableCell>
                  <TableCell className="text-xs">{d.instituicao_nome ?? d.cnpj}</TableCell>
                  <TableCell className="text-xs"><div className="font-mono">{d.conta}</div><div className="text-muted-foreground">{d.descricao}</div></TableCell>
                  <TableCell>{d.tributavel_declarado == null ? "—" : d.tributavel_declarado ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(Number(d.valor))}</TableCell>
                  <TableCell className="text-right">{d.iss_declarado == null ? "—" : formatarMoeda(Number(d.iss_declarado))}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => gravar.mutate({ excluirIds: [d.id] })}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
              {!doAno.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">Nenhuma declaração neste ano.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
