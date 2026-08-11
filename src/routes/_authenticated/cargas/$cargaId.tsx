import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { SituacaoBadge } from "@/components/SituacaoBadge";
import { OficiosZerados } from "@/components/OficiosZerados";
import { ContribuinteDetalhe, type ContribuinteLinha } from "@/components/ContribuinteDetalhe";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

type Ordem = { coluna: ColunaOrdenavel; asc: boolean };

function ColunaHead({
  coluna,
  ordem,
  onSort,
  alinhar,
  children,
}: {
  coluna: ColunaOrdenavel;
  ordem: Ordem;
  onSort: (c: ColunaOrdenavel) => void;
  alinhar?: "right";
  children: React.ReactNode;
}) {
  const ativa = ordem.coluna === coluna;
  return (
    <TableHead className={alinhar === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(coluna)}
        aria-label={`Ordenar por ${typeof children === "string" ? children : coluna}`}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          alinhar === "right" ? "flex-row-reverse" : ""
        } ${ativa ? "text-foreground font-semibold" : ""}`}
      >
        {children}
        {ativa ? (
          ordem.asc ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

type ColunaOrdenavel =


  | "nome"
  | "cnpj"
  | "inscricao_estadual"
  | "cnae"
  | "vaf_atual"
  | "vaf_anterior"
  | "variacao_pct"
  | "data_entrega";

function Contribuintes() {
  const { cargaId } = Route.useParams();
  const [filtro, setFiltro] = useState<Situacao | "TODOS">("TODOS");
  const [cnae, setCnae] = useState<string>("TODOS");
  const [cnaeAberto, setCnaeAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [detalhe, setDetalhe] = useState<ContribuinteLinha | null>(null);

  const [ordem, setOrdem] = useState<{ coluna: ColunaOrdenavel; asc: boolean }>({
    coluna: "vaf_atual",
    asc: false,
  });

  const ordenarPor = (coluna: ColunaOrdenavel) => {
    setPagina(0);
    setOrdem((atual) =>
      atual.coluna === coluna
        ? { coluna, asc: !atual.asc }
        : { coluna, asc: coluna === "nome" || coluna === "cnae" || coluna === "cnpj" || coluna === "inscricao_estadual" },
    );
  };

  const { data: carga } = useQuery({
    queryKey: ["carga", cargaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargas")
        .select("id, exercicio")
        .eq("id", cargaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data, isFetching } = useQuery({
    queryKey: ["contribuintes", cargaId, filtro, cnae, termo, pagina, ordem.coluna, ordem.asc],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("contribuintes_apurados")
        .select("*", { count: "exact" })
        .eq("carga_id", cargaId)
        .order(ordem.coluna, { ascending: ordem.asc, nullsFirst: false })
        .order("id", { ascending: true })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

      if (filtro !== "TODOS") q = q.contains("situacoes", [filtro]);
      if (cnae !== "TODOS") q = q.eq("cnae", cnae);
      if (termo) q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: data, total: count ?? 0 };
    },
  });


  const { data: cnaes } = useQuery({
    queryKey: ["contribuintes-cnaes", cargaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("cnae")
        .eq("carga_id", cargaId)
        .not("cnae", "is", null)
        .limit(20000);
      if (error) throw error;
      const mapa = new Map<string, number>();
      for (const linha of data ?? []) {
        const c = (linha.cnae ?? "").trim();
        if (!c) continue;
        mapa.set(c, (mapa.get(c) ?? 0) + 1);
      }
      return [...mapa.entries()]
        .map(([codigo, total]) => ({ codigo, total }))
        .sort((a, b) => b.total - a.total);
    },
  });

  const { data: contagens } = useQuery({
    queryKey: ["contribuintes-contagens", cargaId, cnae, termo],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const contar = async (situacao?: Situacao) => {
        let q = supabase
          .from("contribuintes_apurados")
          .select("id", { count: "exact", head: true })
          .eq("carga_id", cargaId);
        if (situacao) q = q.contains("situacoes", [situacao]);
        if (cnae !== "TODOS") q = q.eq("cnae", cnae);
        if (termo)
          q = q.or(
            `nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`,
          );
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };

      const [todos, ...porSituacao] = await Promise.all([
        contar(),
        ...SITUACOES.map((s) => contar(s)),
      ]);

      const mapa: Record<string, number> = { TODOS: todos };
      SITUACOES.forEach((s, i) => {
        mapa[s] = porSituacao[i] ?? 0;
      });
      return mapa;
    },
  });


  const totalPaginas = Math.max(1, Math.ceil((data?.total ?? 0) / POR_PAGINA));
  const totalVafAtual = (data?.linhas ?? []).reduce((s, c) => s + (c.vaf_atual ?? 0), 0);
  const totalVafAnterior = (data?.linhas ?? []).reduce((s, c) => s + (c.vaf_anterior ?? 0), 0);
  const zeradosPagina = (data?.linhas ?? []).filter((c) =>
    (c.situacoes as string[]).includes("ZERADO"),
  );
  const todosMarcados =
    zeradosPagina.length > 0 && zeradosPagina.every((c) => selecionados.includes(c.id));

  function alternar(id: string, marcado: boolean) {
    setSelecionados((atual) =>
      marcado ? [...new Set([...atual, id])] : atual.filter((x) => x !== id),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contribuintes apurados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} registros encontrados` : "Carregando…"}
            {selecionados.length ? ` · ${selecionados.length} selecionado(s)` : ""}
          </p>
        </div>
        {carga && (
          <OficiosZerados
            cargaId={cargaId}
            exercicio={carga.exercicio}
            selecionados={selecionados}
          />
        )}
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
            <span
              className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                filtro === s ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
              }`}
            >
              {contagens ? contagens[s] : "…"}
            </span>
          </Button>
        ))}

        <Popover open={cnaeAberto} onOpenChange={setCnaeAberto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={cnaeAberto}
              className="justify-between gap-2"
            >
              {cnae === "TODOS" ? "CNAE: todos" : `CNAE ${cnae}`}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar CNAE…" />
              <CommandList>
                <CommandEmpty>Nenhum CNAE encontrado.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="todos"
                    onSelect={() => {
                      setCnae("TODOS");
                      setPagina(0);
                      setCnaeAberto(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${cnae === "TODOS" ? "opacity-100" : "opacity-0"}`}
                    />
                    Todos os CNAEs
                  </CommandItem>
                  {(cnaes ?? []).map((c) => (
                    <CommandItem
                      key={c.codigo}
                      value={c.codigo}
                      onSelect={() => {
                        setCnae(c.codigo);
                        setPagina(0);
                        setCnaeAberto(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${cnae === c.codigo ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="flex-1">{c.codigo}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.total}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>


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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={todosMarcados}
                        disabled={!zeradosPagina.length}
                        aria-label="Selecionar zerados desta página"
                        onCheckedChange={(v) =>
                          setSelecionados((atual) =>
                            v
                              ? [...new Set([...atual, ...zeradosPagina.map((c) => c.id)])]
                              : atual.filter((id) => !zeradosPagina.some((c) => c.id === id)),
                          )
                        }
                      />
                    </TableHead>
                    <ColunaHead coluna="nome" ordem={ordem} onSort={ordenarPor}>Contribuinte</ColunaHead>
                    <ColunaHead coluna="cnpj" ordem={ordem} onSort={ordenarPor}>CNPJ</ColunaHead>
                    <ColunaHead coluna="inscricao_estadual" ordem={ordem} onSort={ordenarPor}>IE</ColunaHead>
                    <ColunaHead coluna="cnae" ordem={ordem} onSort={ordenarPor}>CNAE</ColunaHead>
                    <ColunaHead coluna="vaf_atual" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF atual</ColunaHead>
                    <ColunaHead coluna="vaf_anterior" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF anterior</ColunaHead>
                    <ColunaHead coluna="variacao_pct" ordem={ordem} onSort={ordenarPor} alinhar="right">Variação</ColunaHead>
                    <ColunaHead coluna="data_entrega" ordem={ordem} onSort={ordenarPor}>Entrega</ColunaHead>

                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.linhas.map((c) => {
                    const zerado = (c.situacoes as string[]).includes("ZERADO");
                    return (
                      <TableRow
                        key={c.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Ver detalhes de ${c.nome ?? c.inscricao_estadual}`}
                        className="cursor-pointer"
                        onClick={() => setDetalhe(c as unknown as ContribuinteLinha)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetalhe(c as unknown as ContribuinteLinha);
                          }
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {zerado && (
                            <Checkbox
                              checked={selecionados.includes(c.id)}
                              aria-label={`Selecionar ${c.nome ?? c.inscricao_estadual}`}
                              onCheckedChange={(v) => alternar(c.id, v === true)}
                            />
                          )}
                        </TableCell>

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
                    );
                  })}
                  {!data?.linhas.length && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        Nenhum contribuinte encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {!!data?.linhas.length && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-medium">
                        {data.linhas.length} contribuinte(s) nesta página · {data.total} no total
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarMoeda(totalVafAtual)}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarMoeda(totalVafAnterior)}
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </TableFooter>
                )}
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

      <ContribuinteDetalhe
        contribuinte={detalhe}
        exercicio={carga?.exercicio ?? 0}
        aberto={!!detalhe}
        onOpenChange={(v) => !v && setDetalhe(null)}
      />
    </div>

    </div>
  );
}
