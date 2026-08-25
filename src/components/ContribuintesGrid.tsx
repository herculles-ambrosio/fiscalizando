import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, CheckSquare, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SituacaoBadge } from "@/components/SituacaoBadge";
import { SituacaoCadastralBadge } from "@/components/SituacaoCadastralBadge";
import { OficiosDialog } from "@/components/OficiosDialog";
import { AtualizarRegimes } from "@/components/AtualizarRegimes";
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
import { formatarCnpj, formatarData, formatarPercentual, formatarValorGrid } from "@/lib/format";
import {
  ROTULO_SITUACAO,
  ROTULO_SITUACAO_CADASTRAL,
  SITUACOES_CADASTRAIS,
  type Situacao,
  type SituacaoCadastral,
} from "@/lib/vaf/apurar";
import { descricaoCnae, formatarCnae, formatarCodigoCnae } from "@/lib/vaf/cnae";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { SituacaoReceitaBadge } from "@/components/SituacaoReceitaBadge";
import { useConsultarReceita, useSituacoesReceita } from "@/hooks/useSituacoesReceita";
import {
  limparCnpj,
  ROTULO_SITUACAO_RECEITA,
  SITUACOES_RECEITA,
  type SituacaoReceita,
} from "@/lib/receita/normalizar";

const SITUACOES: Situacao[] = [
  "OMISSO",
  "ZERADO",
  "FORA_DO_PRAZO",
  "DISCREPANTE",
  "NORMAL",
  "SIMPLES_NACIONAL",
  "SIMEI",
  "SOMENTE_RETORNO",
];

const POR_PAGINA = 20;

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

export function ContribuintesGrid({ cargaId, titulo }: { cargaId: string; titulo?: string }) {
  const [filtro, setFiltro] = useState<Situacao | "TODOS">("TODOS");
  const [cnae, setCnae] = useState<string>("TODOS");
  const [cadastral, setCadastral] = useState<SituacaoCadastral | "TODOS">("TODOS");
  const [cnaeAberto, setCnaeAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [selecionandoTodos, setSelecionandoTodos] = useState(false);
  const [detalhe, setDetalhe] = useState<ContribuinteLinha | null>(null);
  const [receitaFiltro, setReceitaFiltro] = useState<SituacaoReceita | "TODOS" | "NAO_CONSULTADO">(
    "TODOS",
  );

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
    queryKey: ["contribuintes", cargaId, filtro, cnae, cadastral, termo, pagina, ordem.coluna, ordem.asc],
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
      if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
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

  const { data: contagensCadastrais } = useQuery({
    queryKey: ["contribuintes-cadastrais", cargaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("situacao_cadastral")
        .eq("carga_id", cargaId)
        .limit(20000);
      if (error) throw error;
      const mapa: Record<string, number> = {};
      for (const linha of data ?? []) {
        const chave = (linha as any).situacao_cadastral ?? "DESCONHECIDA";
        mapa[chave] = (mapa[chave] ?? 0) + 1;
      }
      return mapa;
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

      const contarTodos = async () => {
        let q = supabase
          .from("contribuintes_apurados")
          .select("id", { count: "exact", head: true })
          .eq("carga_id", cargaId)
          .not("situacoes", "cs", "{SOMENTE_RETORNO}");
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
        contarTodos(),
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
  const linhasPagina = data?.linhas ?? [];
  const todosMarcados =
    linhasPagina.length > 0 && linhasPagina.every((c) => selecionados.includes(c.id));

  // ---- Situação cadastral na Receita Federal (dados abertos do CNPJ) ----
  const { data: receita } = useSituacoesReceita(linhasPagina.map((c) => c.cnpj));
  const consulta = useConsultarReceita();

  const situacaoReceitaDe = (cnpj: string | null) => {
    const chave = limparCnpj(cnpj);
    return chave ? (receita?.[chave] ?? null) : null;
  };

  const linhasVisiveis =
    receitaFiltro === "TODOS"
      ? linhasPagina
      : linhasPagina.filter((c) => {
          const reg = situacaoReceitaDe(c.cnpj);
          return receitaFiltro === "NAO_CONSULTADO" ? !reg : reg?.situacao === receitaFiltro;
        });

  /** Monta a lista de CNPJs conforme a seleção; sem seleção, usa TODOS os contribuintes dos filtros atuais. */
  async function cnpjsDoEscopo(): Promise<(string | null)[]> {
    if (selecionados.length) {
      const marcados = linhasPagina.filter((c) => selecionados.includes(c.id));
      if (marcados.length === selecionados.length) return marcados.map((c) => c.cnpj);
      const cnpjs: (string | null)[] = [];
      for (let i = 0; i < selecionados.length; i += 300) {
        const { data, error } = await supabase
          .from("contribuintes_apurados")
          .select("cnpj")
          .in("id", selecionados.slice(i, i + 300));
        if (error) throw error;
        cnpjs.push(...(data ?? []).map((d) => d.cnpj));
      }
      return cnpjs;
    }

    let q = supabase.from("contribuintes_apurados").select("cnpj").eq("carga_id", cargaId);
    if (filtro !== "TODOS") q = q.contains("situacoes", [filtro]);
    else q = q.not("situacoes", "cs", "{SOMENTE_RETORNO}");
    if (cnae !== "TODOS") q = q.eq("cnae", cnae);
    if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
    if (termo)
      q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);
    const { data, error } = await q.limit(20000);
    if (error) throw error;
    return (data ?? []).map((d) => d.cnpj);
  }

  async function consultarReceita(forcar = false) {
    let cnpjs: (string | null)[];
    try {
      cnpjs = await cnpjsDoEscopo();
    } catch (erro) {
      toast.error("Não foi possível montar a lista de CNPJs.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
      return;
    }
    if (!cnpjs.some((c) => limparCnpj(c))) {
      toast.error("Nenhum CNPJ válido no escopo escolhido.");
      return;
    }
    consulta.mutate(
      { cnpjs, forcar },
      {
        onSuccess: (r) =>
          toast.success(`Receita consultada: ${r.atualizados} atualizado(s).`, {
            description: [
              r.cache ? `${r.cache} já estavam em cache` : null,
              r.falhas.length ? `${r.falhas.length} sem retorno` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }),
        onError: (erro) =>
          toast.error("Falha ao consultar a Receita Federal.", {
            description: erro instanceof Error ? erro.message : undefined,
          }),
      },
    );
  }



  function alternar(id: string, marcado: boolean) {
    setSelecionados((atual) =>
      marcado ? [...new Set([...atual, id])] : atual.filter((x) => x !== id),
    );
  }

  async function selecionarTodos() {
    setSelecionandoTodos(true);
    try {
      let q = supabase
        .from("contribuintes_apurados")
        .select("id")
        .eq("carga_id", cargaId);

      if (filtro !== "TODOS") q = q.contains("situacoes", [filtro]);
      if (cnae !== "TODOS") q = q.eq("cnae", cnae);
      if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
      if (termo)
        q = q.or(
          `nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`,
        );

      const { data, error } = await q.limit(10000);
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.id);
      setSelecionados((atual) => [...new Set([...atual, ...ids])]);
    } catch (err) {
      console.error(err);
    } finally {
      setSelecionandoTodos(false);
    }
  }

  function limparSelecao() {
    setSelecionados([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{titulo ?? "Contribuintes apurados"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} registros encontrados` : "Carregando…"}
            {selecionados.length ? ` · ${selecionados.length} selecionado(s)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AtualizarRegimes cargaId={cargaId} />
          {data && data.total > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={selecionarTodos}
                disabled={selecionandoTodos}
                aria-label="Selecionar todos os contribuintes dos filtros atuais"
              >
                {selecionandoTodos ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckSquare className="mr-2 h-4 w-4" />
                )}
                Selecionar todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={limparSelecao}
                disabled={selecionados.length === 0}
                aria-label="Limpar seleção atual"
              >
                <X className="mr-2 h-4 w-4" />
                Limpar seleção
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => consultarReceita(selecionados.length ? "selecionados" : "pagina")}
            disabled={consulta.isPending || !linhasPagina.length}
            aria-label="Consultar situação cadastral na Receita Federal"
            title="Consulta gratuita nos dados abertos do CNPJ (Receita Federal)"
          >
            {consulta.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Consultar Receita
            {selecionados.length ? ` (${selecionados.length})` : " (página)"}
          </Button>
          {carga && (
            <OficiosDialog
              cargaId={cargaId}
              exercicio={carga.exercicio}
              selecionados={selecionados}
            />
          )}
        </div>
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
              <span className="max-w-72 truncate">
                {cnae === "TODOS" ? "CNAE: todos" : formatarCnae(cnae)}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[28rem] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar CNAE por código ou descrição…" />
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
                      value={`${c.codigo} ${descricaoCnae(c.codigo) ?? ""}`}
                      onSelect={() => {
                        setCnae(c.codigo);
                        setPagina(0);
                        setCnaeAberto(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 shrink-0 ${cnae === c.codigo ? "opacity-100" : "opacity-0"}`}
                      />
                      <span className="flex-1 truncate">
                        {descricaoCnae(c.codigo) ?? "Sem descrição"}
                        <span className="ml-1 text-xs text-muted-foreground tabular-nums">
                          {formatarCodigoCnae(c.codigo)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.total}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Select
          value={cadastral}
          onValueChange={(v) => {
            setCadastral(v as SituacaoCadastral | "TODOS");
            setPagina(0);
          }}
        >
          <SelectTrigger className="h-8 w-64" aria-label="Filtrar por situação cadastral">
            <SelectValue placeholder="Situação cadastral" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Situação cadastral: todas</SelectItem>
            {SITUACOES_CADASTRAIS.map((sc) => (
              <SelectItem key={sc} value={sc}>
                {ROTULO_SITUACAO_CADASTRAL[sc]}
                {contagensCadastrais?.[sc] ? ` (${contagensCadastrais[sc]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={receitaFiltro}
          onValueChange={(v) => setReceitaFiltro(v as SituacaoReceita | "TODOS" | "NAO_CONSULTADO")}
        >
          <SelectTrigger
            className="h-8 w-64"
            aria-label="Filtrar por situação na Receita Federal (nesta página)"
          >
            <SelectValue placeholder="Situação na Receita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Receita: todas</SelectItem>
            <SelectItem value="NAO_CONSULTADO">
              {ROTULO_SITUACAO_RECEITA["NAO_CONSULTADO"]}
            </SelectItem>
            {SITUACOES_RECEITA.map((sr) => (
              <SelectItem key={sr} value={sr}>
                Receita: {ROTULO_SITUACAO_RECEITA[sr]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
                        disabled={!linhasPagina.length}
                        aria-label="Selecionar todos desta página"
                        onCheckedChange={(v) =>
                          setSelecionados((atual) =>
                            v
                              ? [...new Set([...atual, ...linhasPagina.map((c) => c.id)])]
                              : atual.filter((id) => !linhasPagina.some((c) => c.id === id)),
                          )
                        }
                      />

                    </TableHead>
                    <ColunaHead coluna="nome" ordem={ordem} onSort={ordenarPor}>Contribuinte</ColunaHead>
                    <ColunaHead coluna="cnpj" ordem={ordem} onSort={ordenarPor}>CNPJ</ColunaHead>
                    <ColunaHead coluna="inscricao_estadual" ordem={ordem} onSort={ordenarPor}>IE</ColunaHead>
                    <ColunaHead coluna="cnae" ordem={ordem} onSort={ordenarPor}>CNAE</ColunaHead>
                    <ColunaHead coluna="vaf_atual" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF atual (R$)</ColunaHead>
                    <ColunaHead coluna="vaf_anterior" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF anterior (R$)</ColunaHead>
                    <ColunaHead coluna="variacao_pct" ordem={ordem} onSort={ordenarPor} alinhar="right">Variação</ColunaHead>
                    <ColunaHead coluna="data_entrega" ordem={ordem} onSort={ordenarPor}>Entrega</ColunaHead>

                    <TableHead>Situação cadastral</TableHead>
                    <TableHead title="Situação cadastral na Receita Federal (dados abertos do CNPJ)">
                      Receita Federal
                    </TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasVisiveis.map((c) => {
                    
                    const somenteRetorno = (c.situacoes as string[]).includes("SOMENTE_RETORNO");
                    return (
                      <TableRow
                        key={c.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Ver detalhes de ${c.nome ?? c.inscricao_estadual}`}
                        className={
                          somenteRetorno
                            ? "cursor-pointer bg-destructive/10 text-destructive hover:bg-destructive/15"
                            : "cursor-pointer"
                        }

                        onClick={() => setDetalhe(c as unknown as ContribuinteLinha)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetalhe(c as unknown as ContribuinteLinha);
                          }
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selecionados.includes(c.id)}
                            aria-label={`Selecionar ${c.nome ?? c.inscricao_estadual}`}
                            onCheckedChange={(v) => alternar(c.id, v === true)}
                          />
                        </TableCell>


                        <TableCell className="max-w-64 truncate font-medium">{c.nome}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatarCnpj(c.cnpj)}</TableCell>
                        <TableCell className="whitespace-nowrap">{c.inscricao_estadual}</TableCell>
                        <TableCell className="max-w-56">
                          {c.cnae ? (
                            <span
                              className="block truncate"
                              title={formatarCnae(c.cnae)}
                            >
                              {descricaoCnae(c.cnae) ?? formatarCodigoCnae(c.cnae)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatarValorGrid(c.vaf_atual)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatarValorGrid(c.vaf_anterior)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatarPercentual(c.variacao_pct)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarData(c.data_entrega)}
                        </TableCell>
                        <TableCell>
                          <SituacaoCadastralBadge situacao={(c as any).situacao_cadastral} />
                          {(c as any).mes_fim_atividade &&
                          (c as any).mes_fim_atividade < 12 ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              atividade até o mês {(c as any).mes_fim_atividade}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const reg = situacaoReceitaDe(c.cnpj);
                            return (
                              <>
                                <SituacaoReceitaBadge
                                  situacao={reg?.situacao ?? null}
                                  motivo={reg?.motivo ?? null}
                                />
                                {reg?.motivo ? (
                                  <span className="mt-1 block max-w-48 truncate text-xs text-muted-foreground">
                                    {reg.motivo}
                                  </span>
                                ) : null}
                              </>
                            );
                          })()}
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
                  {!linhasVisiveis.length && (
                    <TableRow>
                      <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                        Nenhum contribuinte encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {!!linhasVisiveis.length && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-medium">
                        {linhasVisiveis.length} contribuinte(s) nesta página · {data?.total ?? 0} no
                        total
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarValorGrid(totalVafAtual)}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatarValorGrid(totalVafAnterior)}
                      </TableCell>
                      <TableCell colSpan={5} />
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
