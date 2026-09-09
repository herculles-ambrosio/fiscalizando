/** Resumo consolidado por município: cartórios fiscalizados, ISS e total acumulado. */

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCargasCartorio, useResumoMunicipios } from "@/hooks/useCartorios";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { formatarMoeda } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

export default function ResumoMunicipiosView() {
  const [ano, setAno] = useState("todos");
  const { data: cargas } = useCargasCartorio();
  const { municipio } = useMunicipioAtivo();
  const { data: resumo, isLoading } = useResumoMunicipios(ano === "todos" ? null : Number(ano));

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    const lista = new Set<number>([atual, atual - 1, ...(cargas ?? []).map((c) => c.competencia_ano)]);
    return [...lista].sort((a, b) => b - a);
  }, [cargas]);

  const lista = resumo ?? [];

  const total = useMemo(
    () =>
      lista.reduce(
        (s, r) => ({
          cartorios: s.cartorios + r.cartorios,
          emolumentos: s.emolumentos + r.emolumentos,
          issDevido: s.issDevido + r.issDevido,
          issDeclarado: s.issDeclarado + r.issDeclarado,
          issPago: s.issPago + r.issPago,
          diferenca: s.diferenca + r.diferenca,
          semDeclaracao: s.semDeclaracao + r.semDeclaracao,
        }),
        {
          cartorios: 0,
          emolumentos: 0,
          issDevido: 0,
          issDeclarado: 0,
          issPago: 0,
          diferenca: 0,
          semDeclaracao: 0,
        },
      ),
    [lista],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Municípios com dados", String(lista.length)],
          ["Cartórios fiscalizados", String(total.cartorios)],
          ["ISS devido acumulado", formatarMoeda(total.issDevido)],
          ["Diferença acumulada", formatarMoeda(total.diferenca)],
        ].map(([rotulo, valor]) => (
          <Card key={rotulo}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{rotulo}</p>
              <p className="font-display text-lg font-semibold">{valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Resumo por município</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!lista.length}
              onClick={() =>
                baixarCsv(
                  "resumo-cartorios-por-municipio.csv",
                  montarCsv(
                    [
                      "Município",
                      "Alíquota (%)",
                      "Cartórios",
                      "Meses",
                      "Emolumentos",
                      "ISS devido",
                      "ISS declarado",
                      "ISS pago",
                      "Diferença",
                      "Sem declaração",
                    ],
                    lista.map((r) => [
                      r.nome,
                      r.aliquota,
                      r.cartorios,
                      r.meses,
                      r.emolumentos.toFixed(2).replace(".", ","),
                      r.issDevido.toFixed(2).replace(".", ","),
                      r.issDeclarado.toFixed(2).replace(".", ","),
                      r.issPago.toFixed(2).replace(".", ","),
                      r.diferenca.toFixed(2).replace(".", ","),
                      r.semDeclaracao,
                    ]),
                  ),
                )
              }
            >
              <Download className="mr-2 size-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Município</TableHead>
                <TableHead className="text-right">Alíquota</TableHead>
                <TableHead className="text-right">Cartórios</TableHead>
                <TableHead className="text-right">Meses</TableHead>
                <TableHead className="text-right">Emolumentos</TableHead>
                <TableHead className="text-right">ISS devido</TableHead>
                <TableHead className="text-right">ISS declarado</TableHead>
                <TableHead className="text-right">ISS pago</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((r) => (
                <TableRow
                  key={r.municipioId}
                  className={r.municipioId === municipio?.id ? "bg-muted/40" : undefined}
                >
                  <TableCell className="font-medium">
                    {r.nome}
                    {r.semDeclaracao > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.semDeclaracao} sem declaração
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.aliquota}%</TableCell>
                  <TableCell className="text-right">{r.cartorios}</TableCell>
                  <TableCell className="text-right">{r.meses}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.emolumentos)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.issDevido)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.issDeclarado)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.issPago)}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${r.diferenca > 0 ? "text-destructive" : ""}`}
                  >
                    {formatarMoeda(r.diferenca)}
                  </TableCell>
                </TableRow>
              ))}
              {!lista.length && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {isLoading ? "Carregando…" : "Nenhum dado carregado para o período."}
                  </TableCell>
                </TableRow>
              )}
              {!!lista.length && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total acumulado</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{total.cartorios}</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{formatarMoeda(total.emolumentos)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(total.issDevido)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(total.issDeclarado)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(total.issPago)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(total.diferenca)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O ISS devido usa a alíquota gravada para cada município sobre os emolumentos publicados pelo
        TJMG. A diferença é o quanto falta em relação ao que foi declarado.
      </p>
    </div>
  );
}
