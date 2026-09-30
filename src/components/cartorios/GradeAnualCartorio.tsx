/** Grade anual de um cartório: meses nas colunas, lançamento direto de base e ISS pago. */

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSalvarDeclaracao, type LinhaFiscalizacao } from "@/hooks/useCartorios";
import { formatarValorGrid } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function numero(v: string) {
  const limpo = v.replace(/[^\d.,-]/g, "");
  if (!limpo) return 0;
  let normalizado: string;
  if (limpo.includes(",")) normalizado = limpo.replace(/\./g, "").replace(",", ".");
  else {
    const partes = limpo.split(".");
    const ultima = partes[partes.length - 1] ?? "";
    normalizado =
      partes.length > 1 && ultima.length !== 3
        ? `${partes.slice(0, -1).join("")}.${ultima}`
        : partes.join("");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

const fmt = (v: number | null | undefined) => (v == null ? "—" : formatarValorGrid(v));

function CelulaEditavel({
  linha,
  ano,
  mes,
  campo,
  aliquota,
}: {
  linha: LinhaFiscalizacao;
  ano: number;
  mes: number;
  campo: "base" | "pago";
  aliquota: number;
}) {
  const salvar = useSalvarDeclaracao();
  const original = campo === "base" ? linha.baseDeclarada : linha.issPago;
  const [valor, setValor] = useState(original == null ? "" : formatarValorGrid(original));
  useEffect(() => {
    setValor(original == null ? "" : formatarValorGrid(original));
  }, [original]);

  function gravar() {
    const n = numero(valor);
    const baseNum = campo === "base" ? n : (linha.baseDeclarada ?? 0);
    const pagoNum = campo === "pago" ? n : (linha.issPago ?? 0);
    const vazio = baseNum === 0 && pagoNum === 0;
    setValor(valor.trim() === "" || (vazio && n === 0) ? "" : formatarValorGrid(n));
    if (vazio && !linha.temDeclaracao) return;
    if (
      !vazio &&
      linha.temDeclaracao &&
      baseNum === (linha.baseDeclarada ?? 0) &&
      pagoNum === (linha.issPago ?? 0)
    )
      return;
    salvar.mutate(
      {
        competencia: { ano, mes },
        cns: linha.cns,
        tipoServico: linha.tipoServico,
        serventiaNome: linha.nome,
        baseDeclarada: baseNum,
        issDeclarado: (baseNum * aliquota) / 100,
        issPago: pagoNum,
        observacao: null,
        remover: vazio,
      },
      {
        onSuccess: () => toast.success(vazio ? "Declaração removida." : "Declaração salva."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  }

  return (
    <Input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={gravar}
      placeholder="0,00"
      className="h-8 min-w-24 text-right"
      inputMode="decimal"
    />
  );
}

export default function GradeAnualCartorio({
  linhas,
  ano,
  aliquota,
  titulo,
}: {
  linhas: LinhaFiscalizacao[];
  ano: number;
  aliquota: number;
  titulo: string;
}) {
  const porMes = useMemo(() => {
    const m = new Map<number, LinhaFiscalizacao>();
    for (const l of linhas) if (l.competenciaAno === ano) m.set(l.competenciaMes, l);
    return m;
  }, [linhas, ano]);

  type Def = {
    rotulo: string;
    valor?: (l: LinhaFiscalizacao) => number | null;
    editar?: "base" | "pago";
    destaque?: boolean;
  };
  const defs: Def[] = [
    { rotulo: "Emolumentos (TJMG)", valor: (l) => l.emolumentos },
    { rotulo: "(-) 7% Recompe", valor: (l) => l.baseRecompe },
    { rotulo: `ISS devido (${aliquota}%)`, valor: (l) => l.issDevido, destaque: true },
    { rotulo: "Base declarada", valor: (l) => l.baseDeclarada, editar: "base" },
    { rotulo: "ISS pago", valor: (l) => l.issPago, editar: "pago" },
    { rotulo: "Diferença de ISS", valor: (l) => l.diferencaIss, destaque: true },
  ];

  const total = (d: Def) => {
    let s = 0;
    let algum = false;
    for (const l of porMes.values()) {
      const v = d.valor?.(l);
      if (v != null) {
        s += v;
        algum = true;
      }
    }
    return algum ? s : null;
  };

  const exportar = () =>
    baixarCsv(
      `cartorio-${titulo.replace(/\W+/g, "-").toLowerCase()}-${ano}.csv`,
      montarCsv(
        ["Linha", ...MESES, "Total"],
        [
          ...defs.map((d) => [
            d.rotulo,
            ...MESES.map((_, i) => {
              const l = porMes.get(i + 1);
              return l ? (d.valor?.(l) ?? "") : "";
            }),
            total(d) ?? "",
          ]),
          [
            "Status",
            ...MESES.map((_, i) => {
              const l = porMes.get(i + 1);
              return !l ? "sem carga" : l.temDeclaracao ? "declarado" : "sem declaração";
            }),
            "",
          ],
        ],
      ),
    );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          {titulo} — {ano}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="mr-2 size-4" />
          CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 min-w-44 bg-card">Linha</TableHead>
              {MESES.map((m, i) => (
                <TableHead
                  key={m}
                  className={`text-right ${porMes.has(i + 1) ? "" : "text-muted-foreground/50"}`}
                >
                  {m}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {defs.map((d) => {
              const t = total(d);
              return (
                <TableRow key={d.rotulo}>
                  <TableCell className="sticky left-0 whitespace-nowrap bg-card font-medium">
                    {d.rotulo}
                  </TableCell>
                  {MESES.map((m, i) => {
                    const l = porMes.get(i + 1);
                    if (!l)
                      return (
                        <TableCell key={m} className="text-center text-xs text-muted-foreground/60">
                          sem carga
                        </TableCell>
                      );
                    const v = d.valor?.(l) ?? null;
                    const ehDif = d.rotulo === "Diferença de ISS";
                    return (
                      <TableCell
                        key={m}
                        className={`whitespace-nowrap text-right ${d.destaque ? "font-medium" : ""} ${
                          ehDif && v != null
                            ? v > 0.5
                              ? "text-destructive"
                              : v < -0.5
                                ? "text-emerald-600"
                                : ""
                            : ""
                        }`}
                      >
                        {d.editar ? (
                          <CelulaEditavel
                            linha={l}
                            ano={ano}
                            mes={i + 1}
                            campo={d.editar}
                            aliquota={aliquota}
                          />
                        ) : (
                          fmt(v)
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="whitespace-nowrap text-right font-semibold">{fmt(t)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell className="sticky left-0 bg-card font-medium">Status</TableCell>
              {MESES.map((m, i) => {
                const l = porMes.get(i + 1);
                return (
                  <TableCell key={m} className="text-center text-xs text-muted-foreground">
                    {!l ? "—" : l.temDeclaracao ? "declarado" : "sem declaração"}
                  </TableCell>
                );
              })}
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
