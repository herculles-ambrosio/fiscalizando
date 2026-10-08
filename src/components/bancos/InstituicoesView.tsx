import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useEstban, useGravarBancos, useIfdata, useInstituicoes } from "@/hooks/useBancos";
import { importarEstban } from "@/lib/bancos/estban.functions";
import { digitos } from "@/lib/bancos/conferencia";
import { formatarCnpj, formatarMoeda } from "@/lib/format";

const anoAtual = new Date().getFullYear();
const ANOS = Array.from({ length: 6 }, (_, i) => anoAtual - i);
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const cnpjFmt = (c: string) => (c.length === 14 ? formatarCnpj(c) : c);

export function InstituicoesView() {
  const { municipioId } = useMunicipioAtivo();
  const { data: inst = [] } = useInstituicoes();
  const { data: estban = [] } = useEstban();
  const { data: ifdata = [] } = useIfdata();
  const gravarInst = useGravarBancos("bancos_instituicoes");
  const gravarIf = useGravarBancos("bancos_ifdata");
  const baixar = useServerFn(importarEstban);
  const qc = useQueryClient();

  const [novo, setNovo] = useState({ cnpj: "", nome: "", tipo: "BANCO" });
  const [ano, setAno] = useState(String(anoAtual - 1));
  const [mesIni, setMesIni] = useState("1");
  const [mesFim, setMesFim] = useState("12");
  const [baixando, setBaixando] = useState<string | null>(null);
  const [ifd, setIfd] = useState({ cnpj: "", ano: String(anoAtual - 1), trimestre: "4", rendas: "", participacao: "100" });

  async function buscarEstban() {
    if (!municipioId) return;
    const msgs: string[] = [];
    for (let m = Number(mesIni); m <= Number(mesFim); m++) {
      setBaixando(`${MESES[m - 1]}/${ano}`);
      try {
        const r = await baixar({ data: { municipioId, ano: Number(ano), mes: m } });
        msgs.push(r.mensagem);
        if (!r.ok) break;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao consultar o Banco Central.");
        break;
      }
    }
    setBaixando(null);
    toast.message(msgs.at(-1) ?? "ESTBAN importado.");
    await qc.invalidateQueries({ queryKey: ["bancos_estban"] });
    await qc.invalidateQueries({ queryKey: ["bancos_instituicoes"] });
  }

  const mesesEstban = (raiz: string) => estban.filter((e) => e.cnpj_raiz === raiz.slice(0, 8)).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar no Banco Central (ESTBAN)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estatística Bancária mensal por município: traz as instituições com agência na cidade e suas contas de resultado (verbetes 710/711/712).
            Cooperativas de crédito não entregam o ESTBAN — cadastre-as abaixo e use o IF.data.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label>Ano</Label>
            <Select value={ano} onValueChange={setAno}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>De</Label>
            <Select value={mesIni} onValueChange={setMesIni}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Até</Label>
            <Select value={mesFim} onValueChange={setMesFim}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={() => void buscarEstban()} disabled={!!baixando}>
            {baixando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            {baixando ? `Baixando ${baixando}…` : "Buscar ESTBAN"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Instituições do município</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>CNPJ (ou raiz de 8 dígitos)</Label><Input className="h-9 w-52" value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} /></div>
            <div className="space-y-1"><Label>Nome</Label><Input className="h-9 w-72" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div className="space-y-1"><Label>Tipo</Label>
              <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v })}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="BANCO">Banco</SelectItem><SelectItem value="COOPERATIVA">Cooperativa</SelectItem></SelectContent></Select></div>
            <Button variant="outline" onClick={() => {
              const cnpj = digitos(novo.cnpj);
              if (cnpj.length < 8 || !novo.nome.trim()) { toast.error("Informe CNPJ e nome."); return; }
              gravarInst.mutate({ upsert: [{ cnpj, nome: novo.nome.trim(), tipo: novo.tipo }], onConflict: "municipio_id,cnpj" }, {
                onSuccess: () => { setNovo({ cnpj: "", nome: "", tipo: "BANCO" }); toast.success("Instituição gravada."); },
                onError: (e) => toast.error(e.message),
              });
            }}><Plus className="mr-2 size-4" />Adicionar</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Instituição</TableHead><TableHead>Tipo</TableHead><TableHead>Meses no ESTBAN</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {inst.map((i) => (
                <TableRow key={i.id}>
                  <TableCell><div className="font-medium">{i.nome}</div><div className="text-xs text-muted-foreground">{cnpjFmt(i.cnpj)}</div></TableCell>
                  <TableCell>{i.tipo === "COOPERATIVA" ? "Cooperativa" : "Banco"}</TableCell>
                  <TableCell>{mesesEstban(i.cnpj) || "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => gravarInst.mutate({ excluirIds: [i.id] })}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
              {!inst.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Nenhuma instituição. Busque o ESTBAN ou adicione manualmente.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">IF.data — rendas de serviços por trimestre (cooperativas)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Consulte em <a className="underline" href="https://www3.bcb.gov.br/ifdata/" target="_blank" rel="noreferrer">IF.data do Banco Central</a> o relatório
            "Demonstração de Resultado" da instituição e informe as rendas de prestação de serviços e tarifas do trimestre. A participação (%) é a fatia do
            município no total da instituição (100% para cooperativa de atuação só local). A consulta automática do Banco Central estava fora do ar nos testes.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Instituição</Label>
              <Select value={ifd.cnpj} onValueChange={(v) => setIfd({ ...ifd, cnpj: v })}><SelectTrigger className="h-9 w-72"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{inst.map((i) => <SelectItem key={i.id} value={i.cnpj}>{i.nome}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Ano</Label><Input className="h-9 w-24" value={ifd.ano} onChange={(e) => setIfd({ ...ifd, ano: e.target.value })} /></div>
            <div className="space-y-1"><Label>Trimestre</Label>
              <Select value={ifd.trimestre} onValueChange={(v) => setIfd({ ...ifd, trimestre: v })}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4].map((t) => <SelectItem key={t} value={String(t)}>{t}º</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><Label>Rendas de serviços (R$)</Label><Input className="h-9 w-44" inputMode="decimal" value={ifd.rendas} onChange={(e) => setIfd({ ...ifd, rendas: e.target.value })} /></div>
            <div className="space-y-1"><Label>Participação (%)</Label><Input className="h-9 w-24" inputMode="decimal" value={ifd.participacao} onChange={(e) => setIfd({ ...ifd, participacao: e.target.value })} /></div>
            <Button variant="outline" onClick={() => {
              const n = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
              if (!ifd.cnpj || !n(ifd.rendas)) { toast.error("Escolha a instituição e informe as rendas."); return; }
              gravarIf.mutate({ upsert: [{ cnpj: ifd.cnpj, nome: inst.find((i) => i.cnpj === ifd.cnpj)?.nome ?? null, ano: Number(ifd.ano), trimestre: Number(ifd.trimestre), rendas_servicos: n(ifd.rendas), participacao_pct: n(ifd.participacao) || 100 }], onConflict: "municipio_id,cnpj,ano,trimestre" },
                { onSuccess: () => toast.success("Trimestre gravado."), onError: (e) => toast.error(e.message) });
            }}><Plus className="mr-2 size-4" />Gravar</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Instituição</TableHead><TableHead>Trimestre</TableHead><TableHead className="text-right">Rendas</TableHead><TableHead className="text-right">Participação</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {ifdata.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.nome ?? f.cnpj}</TableCell>
                  <TableCell>{f.trimestre}º/{f.ano}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(Number(f.rendas_servicos))}</TableCell>
                  <TableCell className="text-right">{String(f.participacao_pct).replace(".", ",")}%</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => gravarIf.mutate({ excluirIds: [f.id] })}><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
              {!ifdata.length && <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhum trimestre informado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
