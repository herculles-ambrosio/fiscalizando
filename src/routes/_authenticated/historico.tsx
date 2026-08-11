import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  listarCargasSemRegime,
  reprocessarCargasPendentes,
  type ProgressoReprocesso,
} from "@/lib/vaf/reprocessar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarDataHora } from "@/lib/format";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de apurações VAF" },
      {
        name: "description",
        content: "Todas as apurações VAF já processadas pelo município, com totais por situação.",
      },
      { property: "og:title", content: "Histórico de apurações VAF" },
      {
        property: "og:description",
        content: "Consulte as apurações VAF anteriores do município e seus resultados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { municipioId } = useMunicipioAtivo();
  const { data, isLoading } = useQuery({
    queryKey: ["cargas", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("*")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <p className="mt-1 text-sm text-muted-foreground">Apurações processadas pelo município.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data?.length ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma apuração registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercício</TableHead>
                  <TableHead>Processada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Omissos</TableHead>
                  <TableHead className="text-right">Zerados</TableHead>
                  <TableHead className="text-right">Fora do prazo</TableHead>
                  <TableHead className="text-right">Discrepantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link
                        to="/cargas/$cargaId"
                        params={{ cargaId: c.id }}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {c.exercicio}
                      </Link>
                    </TableCell>
                    <TableCell>{formatarDataHora(c.criado_em)}</TableCell>
                    <TableCell className="capitalize">{c.status}</TableCell>
                    <TableCell className="text-right">{c.total_ativos ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_omissos ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_zerados ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_fora_prazo ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.total_discrepantes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
