/** Histórico de todas as cargas mensais do módulo Fiscaliza Cartório. */

import { useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { useCargasCartorio, useExcluirCargaCartorio } from "@/hooks/useCartorios";
import { MESES_NOME } from "@/lib/cartorios/parser";
import { baixarCsv, montarCsv } from "@/lib/csv";

const ROTULO_TIPO = {
  emolumentos: "Emolumentos (TJMG)",
  declaracoes: "Declarações da prefeitura",
} as const;

export default function CargasView() {
  const { data: cargas, isLoading } = useCargasCartorio();
  const excluir = useExcluirCargaCartorio();
  const [tipo, setTipo] = useState("todos");
  const [ano, setAno] = useState("todos");

  const anos = useMemo(
    () => [...new Set((cargas ?? []).map((c) => c.competencia_ano))].sort((a, b) => b - a),
    [cargas],
  );

  const lista = useMemo(
    () =>
      (cargas ?? []).filter(
        (c) =>
          (tipo === "todos" || c.tipo === tipo) &&
          (ano === "todos" || String(c.competencia_ano) === ano),
      ),
    [cargas, tipo, ano],
  );

  const mesesComEmolumentos = useMemo(
    () =>
      new Set(
        (cargas ?? [])
          .filter((c) => c.tipo === "emolumentos")
          .map((c) => `${c.competencia_ano}-${c.competencia_mes}`),
      ),
    [cargas],
  );

  const dataHora = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Cargas registradas", String(cargas?.length ?? 0)],
          ["Meses com emolumentos", String(mesesComEmolumentos.size)],
          [
            "Última carga",
            cargas?.[0] ? dataHora(cargas[0].criado_em) : "—",
          ],
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
          <CardTitle className="text-base">Meses carregados</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="emolumentos">Emolumentos (TJMG)</SelectItem>
                <SelectItem value="declaracoes">Declarações da prefeitura</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-9 w-32">
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
              onClick={() =>
                baixarCsv(
                  "cargas-fiscaliza-cartorio.csv",
                  montarCsv(
                    ["Competência", "Tipo", "Arquivo", "Origem", "Linhas", "Enviado em"],
                    lista.map((c) => [
                      `${String(c.competencia_mes).padStart(2, "0")}/${c.competencia_ano}`,
                      ROTULO_TIPO[c.tipo],
                      c.arquivo_nome,
                      c.origem,
                      c.linhas,
                      dataHora(c.criado_em),
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
                <TableHead>Competência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="text-right">Linhas</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {MESES_NOME[c.competencia_mes - 1]} de {c.competencia_ano}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.tipo === "emolumentos" ? "default" : "secondary"}>
                      {ROTULO_TIPO[c.tipo]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                    {c.arquivo_nome}
                    <span className="ml-2 text-xs">({c.origem})</span>
                  </TableCell>
                  <TableCell className="text-right">{c.linhas}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dataHora(c.criado_em)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir registro da carga"
                      onClick={() =>
                        excluir.mutate(c.id, {
                          onSuccess: () => toast.success("Registro removido do histórico."),
                          onError: () => toast.error("Não foi possível remover."),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!lista.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {isLoading ? "Carregando…" : "Nenhuma carga registrada ainda."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        O histórico guarda apenas o registro do envio. Excluir uma linha aqui não apaga os valores
        já carregados — para isso, use “Meses já carregados” na aba Carga de dados.
      </p>
    </div>
  );
}
