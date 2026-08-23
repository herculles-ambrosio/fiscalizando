import { useMemo, useState } from "react";
import { NotaRemessa } from "@/components/NotaRemessa";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { ContribuintesGrid } from "@/components/ContribuintesGrid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarCnpj, formatarMoeda } from "@/lib/format";
import { rotuloExercicioRemessa, rotuloTipoRetorno, type TipoRetorno } from "@/lib/vaf/tipoRetorno";
import { descricaoCnae, formatarCnae, formatarCodigoCnae } from "@/lib/vaf/cnae";

export const Route = createFileRoute("/_authenticated/contribuintes")({
  head: () => ({
    meta: [
      { title: "Contribuintes do VAF — situações, CNAE e declarantes" },
      {
        name: "description",
        content:
          "Relatório de contribuintes por situação (omissos, zerados, discrepantes, normais, Simples Nacional, SIMEI) com filtro por CNAE e quem deixou de declarar.",
      },
      { property: "og:title", content: "Contribuintes do VAF" },
      {
        property: "og:description",
        content:
          "Filtre contribuintes por situação e CNAE e veja quem deixou de declarar em relação à competência anterior.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PaginaContribuintes,
});

type CargaResumo = {
  id: string;
  exercicio: number;
  tipo_retorno: string | null;
  competencia_mes: number | null;
  competencia_ano: number | null;
  criado_em: string;
};

function rotuloCarga(c: CargaResumo): string {
  const periodo = rotuloExercicioRemessa(c.exercicio, c.competencia_mes, c.tipo_retorno);
  const tipo = rotuloTipoRetorno((c.tipo_retorno ?? "mensal") as TipoRetorno);
  return `${periodo} · ${tipo}`;
}

function PaginaContribuintes() {
  const { municipioId } = useMunicipioAtivo();
  const [cargaId, setCargaId] = useState<string>("");

  const { data: cargas, isLoading } = useQuery({
    queryKey: ["cargas-concluidas", municipioId],
    enabled: !!municipioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("id, exercicio, tipo_retorno, competencia_mes, competencia_ano, criado_em")
        .eq("municipio_id", municipioId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CargaResumo[];
    },
  });

  const selecionada = useMemo(() => {
    if (!cargas?.length) return null;
    return cargas.find((c) => c.id === cargaId) ?? cargas[0];
  }, [cargas, cargaId]);

  const anterior = useMemo(() => {
    if (!cargas || !selecionada) return null;
    const idx = cargas.findIndex((c) => c.id === selecionada.id);
    return idx >= 0 ? (cargas[idx + 1] ?? null) : null;
  }, [cargas, selecionada]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!cargas?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma apuração processada ainda. Comece em “Nova apuração”.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contribuintes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Relatório por situação, CNAE e comparação de declarantes com a remessa anterior.
          </p>
        </div>
        <div className="w-72 space-y-1">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Apuração (exercício · remessa)
            <NotaRemessa />
          </p>
          <Select value={selecionada?.id ?? ""} onValueChange={setCargaId}>
            <SelectTrigger aria-label="Apuração">
              <SelectValue placeholder="Escolha a apuração" />
            </SelectTrigger>
            <SelectContent>
              {cargas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {rotuloCarga(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lista">Situações e CNAE</TabsTrigger>
          <TabsTrigger value="sairam">Deixaram de declarar</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {selecionada && <ContribuintesGrid cargaId={selecionada.id} titulo="Contribuintes apurados" />}
        </TabsContent>

        <TabsContent value="sairam">
          {selecionada && (
            <DeixaramDeDeclarar atual={selecionada} anterior={anterior} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type LinhaSaida = {
  inscricao_estadual: string;
  nome: string | null;
  cnpj: string | null;
  cnae: string | null;
  vaf_anterior: number | null;
};

function DeixaramDeDeclarar({
  atual,
  anterior,
}: {
  atual: CargaResumo;
  anterior: CargaResumo | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["deixaram-de-declarar", atual.id, anterior?.id],
    enabled: !!anterior,
    queryFn: async () => {
      const [ant, atu] = await Promise.all([
        supabase
          .from("contribuintes_apurados")
          .select("inscricao_estadual, nome, cnpj, cnae, vaf_atual")
          .eq("carga_id", anterior!.id)
          .eq("entregou_declaracao", true)
          .limit(50000),
        supabase
          .from("contribuintes_apurados")
          .select("inscricao_estadual")
          .eq("carga_id", atual.id)
          .eq("entregou_declaracao", true)
          .limit(50000),
      ]);
      if (ant.error) throw ant.error;
      if (atu.error) throw atu.error;

      const declararamAgora = new Set((atu.data ?? []).map((c) => c.inscricao_estadual));
      return (ant.data ?? [])
        .filter((c) => !declararamAgora.has(c.inscricao_estadual))
        .map<LinhaSaida>((c) => ({
          inscricao_estadual: c.inscricao_estadual,
          nome: c.nome,
          cnpj: c.cnpj,
          cnae: c.cnae,
          vaf_anterior: c.vaf_atual,
        }))
        .sort((a, b) => (b.vaf_anterior ?? 0) - (a.vaf_anterior ?? 0));
    },
  });

  function baixarCsv() {
    const linhas = [
      ["IE", "CNPJ", "Contribuinte", "CNAE", "Descrição do CNAE", "VAF na competência anterior"],
      ...(data ?? []).map((l) => [
        l.inscricao_estadual,
        l.cnpj ?? "",
        l.nome ?? "",
        formatarCodigoCnae(l.cnae),
        descricaoCnae(l.cnae) ?? "",
        String(l.vaf_anterior ?? 0),
      ]),
    ];
    const csv = linhas.map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `deixaram-de-declarar-${atual.exercicio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!anterior) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Não há apuração anterior deste município para comparar.
        </CardContent>
      </Card>
    );
  }

  const total = (data ?? []).reduce((s, l) => s + (l.vaf_anterior ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Comparando <strong>{rotuloCarga(atual)}</strong> com{" "}
          <strong>{rotuloCarga(anterior)}</strong>
          {data ? ` · ${data.length} contribuinte(s) deixaram de declarar` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={baixarCsv} disabled={!data?.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
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
                    <TableHead className="text-right">VAF na competência anterior</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((l) => (
                    <TableRow key={l.inscricao_estadual}>
                      <TableCell className="max-w-64 truncate font-medium">
                        {l.nome ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatarCnpj(l.cnpj)}</TableCell>
                      <TableCell className="whitespace-nowrap">{l.inscricao_estadual}</TableCell>
                      <TableCell className="max-w-56">
                        <span className="block truncate" title={formatarCnae(l.cnae)}>
                          {formatarCnae(l.cnae)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatarMoeda(l.vaf_anterior)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!data?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        Todos os declarantes da competência anterior voltaram a declarar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {!!data?.length && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-medium">
                        {data.length} contribuinte(s)
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarMoeda(total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
