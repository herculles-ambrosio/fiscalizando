import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeletorExercicio } from "@/components/icms/SeletorExercicio";
import { VazioIcms } from "@/components/icms/VazioIcms";
import { useIcmsComparativo, useIcmsExercicios } from "@/hooks/useIcms";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { normalizarRotulo } from "@/lib/icms/criterios";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/icms/comparativo")({
  head: () => ({
    meta: [
      { title: "Comparativo entre municípios — ICMS" },
      {
        name: "description",
        content:
          "Compare o repasse de ICMS do seu município com os demais municípios do extrato da FJP.",
      },
      { property: "og:title", content: "Comparativo entre municípios — ICMS" },
      {
        property: "og:description",
        content: "Ranking de repasse de ICMS entre municípios mineiros no exercício.",
      },
    ],
  }),
  component: ComparativoIcms,
});

function ComparativoIcms() {
  const { municipio } = useMunicipioAtivo();
  const { data: exercicios } = useIcmsExercicios();
  const [exercicio, setExercicio] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (exercicios?.length && (!exercicio || !exercicios.includes(exercicio))) {
      setExercicio(exercicios[0] ?? null);
    }
  }, [exercicios, exercicio]);

  const { data: linhas } = useIcmsComparativo(exercicio);

  const ranking = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of linhas ?? []) {
      mapa.set(l.municipio_nome, (mapa.get(l.municipio_nome) ?? 0) + (l.valor ?? 0));
    }
    const lista = [...mapa.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .map((x, i) => ({ ...x, posicao: i + 1 }));
    const termo = normalizarRotulo(busca);
    return termo ? lista.filter((x) => normalizarRotulo(x.nome).includes(termo)) : lista;
  }, [linhas, busca]);

  const meu = normalizarRotulo(municipio?.nome ?? "");

  function exportar() {
    baixarCsv(
      `comparativo-icms-${exercicio}.csv`,
      montarCsv(
        ["Posição", "Município", "Repasse no exercício"],
        ranking.map((r) => [r.posicao, r.nome, r.total.toFixed(2)]),
      ),
    );
  }

  if (linhas && !linhas.length) {
    return (
      <VazioIcms mensagem="Nenhum comparativo importado. Envie o extrato de comparação entre municípios do portal Robin Hood na tela de Cargas." />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Comparativo entre municípios</h1>
          <p className="text-sm text-muted-foreground">
            Repasse acumulado no exercício, conforme o extrato de comparação da FJP.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <SeletorExercicio
            exercicios={exercicios ?? []}
            valor={exercicio}
            aoTrocar={setExercicio}
          />
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ranking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Buscar município"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Município</TableHead>
                <TableHead className="text-right">Repasse no exercício</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((r) => (
                <TableRow
                  key={r.nome}
                  className={cn(normalizarRotulo(r.nome) === meu && "bg-primary/5 font-medium")}
                >
                  <TableCell>{r.posicao}</TableCell>
                  <TableCell>{r.nome}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
