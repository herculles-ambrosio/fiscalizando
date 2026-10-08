import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGravarBancos, usePlanoContas } from "@/hooks/useBancos";
import type { ContaCfg } from "@/lib/bancos/conferencia";

export function PlanoContasView() {
  const { plano, padrao } = usePlanoContas();
  const gravar = useGravarBancos("bancos_contas_cosif");
  const [linhas, setLinhas] = useState<ContaCfg[]>([]);
  useEffect(() => setLinhas(plano.map((p) => ({ ...p }))), [JSON.stringify(plano)]);

  const alt = (i: number, c: Partial<ContaCfg>) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...c } : x)));

  function salvar() {
    const validas = linhas.filter((l) => l.conta.trim() && l.descricao.trim());
    gravar.mutate(
      { excluirFiltro: {}, upsert: validas.map((l) => ({ conta: l.conta.trim(), descricao: l.descricao.trim(), item_lc116: l.item_lc116?.trim() || null, aliquota: Number(l.aliquota) || 0, tributavel: l.tributavel })), onConflict: "municipio_id,conta" },
      { onSuccess: () => toast.success("Plano de contas salvo."), onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plano de contas COSIF e alíquotas</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada conta (ou prefixo, como 7.1.7) é ligada ao item da LC 116/2003 e à alíquota do município. Na conferência vale a conta mais específica.
          Contas do grupo 7.1.7 (rendas de prestação de serviços) sem cadastro são tratadas como tributáveis com 5%.
          {padrao && " Esta é uma sugestão inicial — revise com a legislação do município e clique em Salvar."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        <Table>
          <TableHeader><TableRow><TableHead>Conta COSIF</TableHead><TableHead>Descrição</TableHead><TableHead>Item LC 116</TableHead><TableHead>Alíquota (%)</TableHead><TableHead>Tributável</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell><Input className="h-8 w-36 font-mono" value={l.conta} onChange={(e) => alt(i, { conta: e.target.value })} /></TableCell>
                <TableCell><Input className="h-8 min-w-64" value={l.descricao} onChange={(e) => alt(i, { descricao: e.target.value })} /></TableCell>
                <TableCell><Input className="h-8 w-24" value={l.item_lc116 ?? ""} onChange={(e) => alt(i, { item_lc116: e.target.value })} /></TableCell>
                <TableCell><Input className="h-8 w-20" inputMode="decimal" value={String(l.aliquota).replace(".", ",")} onChange={(e) => alt(i, { aliquota: Number(e.target.value.replace(",", ".")) || 0 })} /></TableCell>
                <TableCell><Switch checked={l.tributavel} onCheckedChange={(v) => alt(i, { tributavel: v })} aria-label="Tributável" /></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => setLinhas((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2 px-4">
          <Button variant="outline" onClick={() => setLinhas((l) => [...l, { conta: "7.1.7.", descricao: "", item_lc116: "15.", aliquota: 5, tributavel: true }])}><Plus className="mr-2 size-4" />Nova conta</Button>
          <Button onClick={salvar} disabled={gravar.isPending}><Save className="mr-2 size-4" />Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
