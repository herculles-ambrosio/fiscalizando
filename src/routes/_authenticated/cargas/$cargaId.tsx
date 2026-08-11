import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SituacaoBadge } from "@/components/SituacaoBadge";
import { OficiosZerados } from "@/components/OficiosZerados";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarCnpj, formatarData, formatarMoeda, formatarPercentual } from "@/lib/format";
import { ROTULO_SITUACAO, type Situacao } from "@/lib/vaf/apurar";

export const Route = createFileRoute("/_authenticated/cargas/$cargaId")({
  head: () => ({
    meta: [
      { title: "Contribuintes apurados | VAF" },
      {
        name: "description",
        content:
          "Lista de contribuintes apurados com situação, VAF declarado, variação e data de entrega.",
      },
      { property: "og:title", content: "Contribuintes apurados | VAF" },
      {
        property: "og:description",
        content: "Consulte os contribuintes apurados por situação, VAF e variação percentual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contribuintes,
});

const SITUACOES: Situacao[] = ["OMISSO", "ZERADO", "FORA_DO_PRAZO", "DISCREPANTE", "NORMAL"];
const POR_PAGINA = 50;

function Contribuintes() {
  const { cargaId } = Route.useParams();
  const [filtro, setFiltro] = useState<Situacao | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: ["contribuintes", cargaId, filtro, termo, pagina],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("contribuintes_apurados")
        .select("*", { count: "exact" })
        .eq("carga_id", cargaId)
        .order("vaf_atual", { ascending: false, nullsFirst: false })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

      if (filtro !== "TODOS") q = q.contains("situacoes", [filtro]);
      if (termo) q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: data, total: count ?? 0 };
    },
  });

  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contribuintes apurados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data ? `${data.total} registros encontrados` : "Carregando…"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["TODOS", ...SITUACOES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filtro === s ? "default" : "outline"}
            onClick={() => {
              setFiltro(s);
              setPagina(0);
            }}
          >
            {s === "TODOS" ? "Todos" : ROTULO_SITUACAO[s]}
          </Button>
        ))}

        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTermo(busca.trim());
            setPagina(0);
          }}
        >
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, CNPJ ou IE"
            className="w-56"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {isFetching && !data ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>IE</TableHead>
                    <TableHead>CNAE</TableHead>
                    <TableHead className="text-right">VAF atual</TableHead>
                    <TableHead className="text-right">VAF anterior</TableHead>
                    <TableHead className="text-right">Variação</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.linhas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-64 truncate font-medium">{c.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatarCnpj(c.cnpj)}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.inscricao_estadual}</TableCell>
                      <TableCell>{c.cnae ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatarMoeda(c.vaf_atual)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatarMoeda(c.vaf_anterior)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatarPercentual(c.variacao_pct)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(c.data_entrega)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(c.situacoes as string[]).map((s) => (
                            <SituacaoBadge key={s} situacao={s} />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.linhas.length && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        Nenhum contribuinte encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Página {pagina + 1} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagina + 1 >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
