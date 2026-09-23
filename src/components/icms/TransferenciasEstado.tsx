/**
 * Carga da tabela "Transferências de <ano>" do portal da FJP: guarda a bolada
 * mensal do VAF (75% da transferência líquida) usada nas previsões de repasse.
 */

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatarMoeda } from "@/lib/format";
import { lerTransferencias, type MesEstado } from "@/lib/icms/transferenciasFjp";
import {
  useExerciciosEstado,
  useRepassesEstado,
  useSalvarRepassesEstado,
} from "@/hooks/useRepassesEstado";

const NOME_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function TransferenciasEstado() {
  const anoAtual = new Date().getFullYear();
  const [exercicio, setExercicio] = useState(anoAtual);
  const { data: exercicios } = useExerciciosEstado();
  const { data: salvos } = useRepassesEstado(exercicio);
  const salvar = useSalvarRepassesEstado();

  const [texto, setTexto] = useState("");
  const [meses, setMeses] = useState<MesEstado[] | null>(null);

  useEffect(() => {
    setMeses(null);
  }, [exercicio]);

  const linhas = meses ?? salvos ?? [];

  const total = useMemo(
    () => linhas.reduce((a, m) => a + (m.vaf75 ?? 0), 0),
    [linhas],
  );

  function ler() {
    const r = lerTransferencias(texto);
    if (!r.mesesComVaf) {
      toast.error("Não encontrei a linha “75% repassado pelo VAF” no texto colado.");
      return;
    }
    if (r.exercicio) setExercicio(r.exercicio);
    setMeses(r.meses);
    toast.success(`${r.mesesComVaf} meses lidos${r.exercicio ? ` de ${r.exercicio}` : ""}.`);
  }

  async function gravar() {
    if (!linhas.length) return;
    try {
      const n = await salvar.mutateAsync({ exercicio, meses: linhas });
      toast.success(`${n} meses gravados para ${exercicio}.`);
      setMeses(null);
    } catch {
      toast.error("Não foi possível gravar. Confira se o seu acesso permite editar.");
    }
  }

  function editar(mes: number, campo: keyof Omit<MesEstado, "mes">, valor: string) {
    const n = Number(valor.replace(/\./g, "").replace(",", "."));
    const base = linhas.length
      ? linhas
      : Array.from({ length: 12 }, (_, i) => ({
          mes: i + 1,
          transferenciaLiquida: null,
          vaf75: null,
          robinHood25: null,
        }));
    setMeses(
      base.map((m) =>
        m.mes === mes ? { ...m, [campo]: Number.isFinite(n) && valor.trim() ? n : null } : m,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Colar a tabela do portal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label>Exercício</Label>
              <Input
                value={exercicio}
                onChange={(e) => setExercicio(Number(e.target.value) || anoAtual)}
              />
              {!!exercicios?.length && (
                <p className="text-xs text-muted-foreground">
                  Já cadastrados: {exercicios.join(", ")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tabela copiada (ou CSV baixado)</Label>
              <Textarea
                rows={6}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Cole aqui as linhas da tabela Transferências, incluindo 75% REPASSADO PELO VAF"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={ler}>
              Ler tabela
            </Button>
            <Button onClick={gravar} disabled={salvar.isPending || !linhas.length}>
              <Save className="mr-2 h-4 w-4" /> Gravar {exercicio}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Bolada do VAF em {exercicio} — {formatarMoeda(total)} nos meses informados
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Mês</th>
                <th className="py-2">Transferência líquida</th>
                <th className="py-2">75% pelo VAF</th>
                <th className="py-2">25% Lei Robin Hood</th>
              </tr>
            </thead>
            <tbody>
              {(linhas.length
                ? linhas
                : Array.from({ length: 12 }, (_, i) => ({
                    mes: i + 1,
                    transferenciaLiquida: null,
                    vaf75: null,
                    robinHood25: null,
                  }))
              ).map((m) => (
                <tr key={m.mes} className="border-b last:border-0">
                  <td className="py-1.5">{NOME_MES[m.mes - 1]}</td>
                  <td className="py-1.5">
                    <Input
                      className="h-8"
                      defaultValue={m.transferenciaLiquida ?? ""}
                      onBlur={(e) => editar(m.mes, "transferenciaLiquida", e.target.value)}
                    />
                  </td>
                  <td className="py-1.5">
                    <Input
                      className="h-8"
                      defaultValue={m.vaf75 ?? ""}
                      onBlur={(e) => editar(m.mes, "vaf75", e.target.value)}
                    />
                  </td>
                  <td className="py-1.5">
                    <Input
                      className="h-8"
                      defaultValue={m.robinHood25 ?? ""}
                      onBlur={(e) => editar(m.mes, "robinHood25", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-3 text-xs text-muted-foreground">
            Esses valores valem para todas as prefeituras: o repasse de cada município é o índice
            dele aplicado sobre a bolada do mês.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
