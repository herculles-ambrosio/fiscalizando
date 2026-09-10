import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Columns3, Gavel, RefreshCw } from "lucide-react";
import { SituacaoReceitaBadge } from "@/components/SituacaoReceitaBadge";
import { useConsultarReceita, useSituacoesReceita } from "@/hooks/useSituacoesReceita";
import { ProgressoConsultaReceita } from "@/components/receita/ProgressoConsultaReceita";
import { useFilaReceita } from "@/hooks/useFilaReceita";
import { BotaoReconsultarFalhas } from "@/components/analises/ReceitaIe";
import { usePreferencia } from "@/hooks/usePreferencia";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type ColunaId =
  | "nome"
  | "cnpj"
  | "inscricao_estadual"
  | "cnae"
  | "vaf_atual"
  | "vaf_anterior"
  | "variacao_pct"
  | "situacao_cadastral"
  | "receita_federal"
  | "receita_data"
  | "situacoes";

const COLUNAS: { id: ColunaId; rotulo: string }[] = [
  { id: "nome", rotulo: "Contribuinte" },
  { id: "cnpj", rotulo: "CNPJ" },
  { id: "inscricao_estadual", rotulo: "IE" },
  { id: "cnae", rotulo: "CNAE" },
  { id: "vaf_atual", rotulo: "VAF atual (R$)" },
  { id: "vaf_anterior", rotulo: "VAF anterior (R$)" },
  { id: "variacao_pct", rotulo: "Variação" },
  { id: "situacao_cadastral", rotulo: "Situação cadastral" },
  { id: "receita_federal", rotulo: "Receita Federal" },
  { id: "receita_data", rotulo: "Data da situação (RF)" },
  { id: "situacoes", rotulo: "Situação" },
];

const COLUNAS_PADRAO: ColunaId[] = COLUNAS.map((c) => c.id);


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
  | "situacao_cadastral"
  | "situacoes"
  | "receita_federal"
  | "receita_data"
  | "data_entrega";

/** Colunas que o banco sabe ordenar; "receita_federal" é ordenada no cliente. */
const COLUNAS_SERVIDOR = new Set<ColunaOrdenavel>([
  "nome",
  "cnpj",
  "inscricao_estadual",
  "cnae",
  "vaf_atual",
  "vaf_anterior",
  "variacao_pct",
  "situacao_cadastral",
  "situacoes",
  "data_entrega",
]);

export function ContribuintesGrid({ cargaId, titulo }: { cargaId: string; titulo?: string }) {
  const navigate = useNavigate();
  /** Situações marcadas; lista vazia = todas. Permite combinar Omissos + Zerados + … */
  const [filtros, setFiltros] = useState<Situacao[]>([]);
  const filtroChave = filtros.join("|");
  const [cnae, setCnae] = useState<string>("TODOS");
  const [cadastral, setCadastral] = useState<SituacaoCadastral | "TODOS">("TODOS");
  const [cnaeAberto, setCnaeAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [selecionandoTodos, setSelecionandoTodos] = useState(false);
  const [selecionarPendentes, setSelecionarPendentes] = useState(false);
  const [detalhe, setDetalhe] = useState<ContribuinteLinha | null>(null);
  const [receitaFiltro, setReceitaFiltro] = useState<
    SituacaoReceita | "TODOS" | "NAO_CONSULTADO" | "PENDENTES"
  >(
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
        : {
            coluna,
            asc:
              coluna === "nome" ||
              coluna === "cnae" ||
              coluna === "cnpj" ||
              coluna === "inscricao_estadual" ||
              coluna === "situacao_cadastral" ||
              coluna === "situacoes" ||
              coluna === "receita_federal" ||
              coluna === "receita_data",
          },
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
    queryKey: ["contribuintes", cargaId, filtroChave, cnae, cadastral, termo, pagina, ordem.coluna, ordem.asc],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("contribuintes_apurados")
        .select("*", { count: "exact" })
        .eq("carga_id", cargaId)
        .order(COLUNAS_SERVIDOR.has(ordem.coluna) ? ordem.coluna : "vaf_atual", {
          ascending: COLUNAS_SERVIDOR.has(ordem.coluna) ? ordem.asc : false,
          nullsFirst: false,
        })
        .order("id", { ascending: true })
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);

      if (filtros.length) q = q.overlaps("situacoes", filtros);
      if (cnae !== "TODOS") q = q.eq("cnae", cnae);
      if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
      if (termo) q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);

      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: data, total: count ?? 0 };
    },
  });

  /**
   * O filtro de situação na Receita é resolvido no cliente (a situação não está
   * na tabela). Para valer na apuração inteira — e não só na página — carregamos
   * todos os contribuintes dos demais filtros quando esse filtro está ativo.
   */
  const filtroReceitaAtivo = receitaFiltro !== "TODOS";

  const { data: todasLinhas, isFetching: carregandoTodas } = useQuery({
    queryKey: ["contribuintes-todos", cargaId, filtroChave, cnae, cadastral, termo, ordem.coluna, ordem.asc],
    enabled: filtroReceitaAtivo,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("contribuintes_apurados")
        .select("*")
        .eq("carga_id", cargaId)
        .order(COLUNAS_SERVIDOR.has(ordem.coluna) ? ordem.coluna : "vaf_atual", {
          ascending: COLUNAS_SERVIDOR.has(ordem.coluna) ? ordem.asc : false,
          nullsFirst: false,
        })
        .order("id", { ascending: true })
        .limit(20000);

      if (filtros.length) q = q.overlaps("situacoes", filtros);
      if (cnae !== "TODOS") q = q.eq("cnae", cnae);
      if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
      if (termo)
        q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
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


  /** Base de trabalho: a página do banco ou a apuração inteira (filtro da Receita ativo). */
  const linhasBase = filtroReceitaAtivo ? (todasLinhas ?? []) : (data?.linhas ?? []);

  // ---- Situação cadastral na Receita Federal (dados abertos do CNPJ) ----
  const { data: receita, isFetching: carregandoReceita } = useSituacoesReceita(
    linhasBase.map((c) => c.cnpj),
  );
  /** Enquanto o cache de situações não chega, toda linha pareceria "pendente". */
  const receitaPronta =
    !carregandoReceita && (!!receita || !linhasBase.some((c) => !!limparCnpj(c.cnpj)));
  const consulta = useConsultarReceita();
  const fila = useFilaReceita();
  const prefColunas = usePreferencia<ColunaId[]>("contribuintes_grid_colunas", COLUNAS_PADRAO);
  const colunasVisiveis = prefColunas.valor.filter((id) =>
    COLUNAS.some((c) => c.id === id),
  );
  const visivel = (id: ColunaId) => colunasVisiveis.includes(id);
  const colunasNaOrdem = COLUNAS.filter((c) => visivel(c.id));
  const totalColunas = colunasNaOrdem.length + 1;

  function alternarColuna(id: ColunaId, marcado: boolean) {
    const proximo = marcado
      ? COLUNAS_PADRAO.filter((c) => c === id || colunasVisiveis.includes(c))
      : colunasVisiveis.filter((c) => c !== id);
    if (!proximo.length) return;
    prefColunas.definir(proximo);
  }

  const situacaoReceitaDe = (cnpj: string | null) => {
    const chave = limparCnpj(cnpj);
    return chave ? (receita?.[chave] ?? null) : null;
  };

  const semRespostaSet = new Set(fila.semResposta);
  /** "Pendentes" = ainda não consultado ou na fila de falhas (sem resposta). */
  const ehPendenteReceita = (c: { cnpj: string | null }) => {
    const reg = situacaoReceitaDe(c.cnpj);
    const chave = limparCnpj(c.cnpj);
    return !reg || (chave ? semRespostaSet.has(chave) : false);
  };

  const linhasFiltradas = !filtroReceitaAtivo
    ? linhasBase
    : receitaFiltro === "PENDENTES"
      ? linhasBase.filter(ehPendenteReceita)
      : linhasBase.filter((c) => {
          const reg = situacaoReceitaDe(c.cnpj);
          return receitaFiltro === "NAO_CONSULTADO" ? !reg : reg?.situacao === receitaFiltro;
        });

  /** A situação da Receita não está na tabela: ordena as linhas já carregadas. */
  const linhasOrdenadas =
    ordem.coluna === "receita_federal" || ordem.coluna === "receita_data"
      ? [...linhasFiltradas].sort((a, b) => {
          const campo = ordem.coluna === "receita_data" ? "situacao_data" : "situacao";
          const ra = situacaoReceitaDe(a.cnpj)?.[campo] ?? "";
          const rb = situacaoReceitaDe(b.cnpj)?.[campo] ?? "";
          const cmp = String(ra).localeCompare(String(rb), "pt-BR");
          return ordem.asc ? cmp : -cmp;
        })
      : linhasFiltradas;

  /** Com filtro da Receita ativo a paginação passa a ser feita aqui. */
  const totalRegistros = filtroReceitaAtivo ? linhasOrdenadas.length : (data?.total ?? 0);
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const linhasVisiveis = filtroReceitaAtivo
    ? linhasOrdenadas.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA)
    : linhasOrdenadas;

  const totalVafAtual = linhasVisiveis.reduce((s, c) => s + (c.vaf_atual ?? 0), 0);
  const totalVafAnterior = linhasVisiveis.reduce((s, c) => s + (c.vaf_anterior ?? 0), 0);
  const linhasPagina = linhasVisiveis;
  const todosMarcados =
    linhasPagina.length > 0 && linhasPagina.every((c) => selecionados.includes(c.id));

  /** Aplica o filtro de pendentes; a seleção acontece quando a lista completa chega. */
  function marcarPendentesReceita() {
    setReceitaFiltro("PENDENTES");
    setPagina(0);
    setSelecionarPendentes(true);
  }

  useEffect(() => {
    if (!selecionarPendentes) return;
    if (receitaFiltro !== "PENDENTES") return;
    if (!todasLinhas || carregandoTodas) return;
    // Só seleciona depois que as situações da Receita chegarem, senão tudo
    // seria classificado como pendente.
    if (!receitaPronta) return;
    setSelecionarPendentes(false);
    const ids = linhasFiltradas.map((c) => c.id);
    if (!ids.length) {
      toast.info("Nenhum contribuinte pendente na Receita Federal com os filtros atuais.");
      return;
    }
    setSelecionados((atual) => [...new Set([...atual, ...ids])]);
    toast.success(`${ids.length} contribuinte(s) pendente(s) selecionado(s).`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionarPendentes, receitaFiltro, todasLinhas, carregandoTodas, receita, receitaPronta]);




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

    // Com filtro da Receita ativo, o escopo é exatamente o que está filtrado na tela.
    if (filtroReceitaAtivo) return linhasOrdenadas.map((c) => c.cnpj);

    let q = supabase.from("contribuintes_apurados").select("cnpj").eq("carga_id", cargaId);
    if (filtros.length) q = q.overlaps("situacoes", filtros);
    else q = q.not("situacoes", "cs", "{SOMENTE_RETORNO}");
    if (cnae !== "TODOS") q = q.eq("cnae", cnae);
    if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
    if (termo)
      q = q.or(`nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`);
    const { data, error } = await q.limit(20000);
    if (error) throw error;
    return (data ?? []).map((d) => d.cnpj);
  }

  function reconsultarSemResposta() {
    fila.reconsultar(undefined, {
      onSuccess: (r) =>
        toast.success(
          `Reconsulta: ${r.atualizados} atualizado(s) · ${r.naoEncontrados} fora das bases públicas · ${r.falhas} ainda sem resposta.`,
          {
            description: r.falhas
              ? "Os que continuam sem resposta seguem na fila automática e serão reconsultados sozinhos mais tarde."
              : undefined,
          },
        ),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Falha ao reconsultar a Receita Federal."),
    });
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
        onSuccess: (r) => {
          const semResposta = r.falhas.length;
          const naoEncontrados = r.naoEncontrados?.length ?? 0;
          const descricao = [
            r.cache ? `${r.cache} já estavam em cache` : null,
            naoEncontrados ? `${naoEncontrados} não constam nas bases públicas` : null,
            semResposta
              ? `${semResposta} sem resposta das bases agora — clique novamente em alguns minutos para consultar só esses`
              : null,
            r.restantes
              ? `${r.restantes} CNPJ(s) não entraram neste lote — clique novamente para continuar`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          if (semResposta && !r.atualizados) {
            toast.warning("As bases públicas não responderam agora.", {
              description: descricao,
            });
            return;
          }
          toast.success(`Receita consultada: ${r.atualizados} atualizado(s).`, {
            description: descricao,
          });
        },
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
    // Com filtro da Receita ativo, seleciona exatamente o conjunto filtrado na tela.
    if (filtroReceitaAtivo) {
      const ids = linhasOrdenadas.map((c) => c.id);
      setSelecionados((atual) => [...new Set([...atual, ...ids])]);
      return;
    }
    setSelecionandoTodos(true);
    try {
      let q = supabase
        .from("contribuintes_apurados")
        .select("id")
        .eq("carga_id", cargaId);

      if (filtros.length) q = q.overlaps("situacoes", filtros);
      if (cnae !== "TODOS") q = q.eq("cnae", cnae);
      if (cadastral !== "TODOS") q = q.eq("situacao_cadastral", cadastral);
      if (termo)
        q = q.or(
          `nome.ilike.%${termo}%,cnpj.ilike.%${termo}%,inscricao_estadual.ilike.%${termo}%`,
        );

      const { data, error } = await q.limit(50000);
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.id);
      setSelecionados((atual) => [...new Set([...atual, ...ids])]);
      toast.success(`${ids.length} contribuinte(s) selecionado(s) — todos os filtros atuais.`);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível selecionar todos os contribuintes.");
    } finally {
      setSelecionandoTodos(false);
    }
  }

  function limparSelecao() {
    setSelecionados([]);
  }

  return (
    <div className="space-y-6">
      <ProgressoConsultaReceita progresso={consulta.progresso} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{titulo ?? "Contribuintes apurados"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${totalRegistros} registros encontrados` : "Carregando…"}
            {filtroReceitaAtivo && data ? ` (filtro da Receita · ${data.total} sem esse filtro)` : ""}
            {selecionados.length ? ` · ${selecionados.length} selecionado(s)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AtualizarRegimes cargaId={cargaId} />
          {totalRegistros > 0 && (
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
            onClick={() => void consultarReceita()}
            disabled={consulta.isPending || !totalRegistros}
            aria-label="Consultar situação cadastral na Receita Federal"
            title="Consulta gratuita nos dados abertos do CNPJ (Receita Federal). Sem seleção, consulta todos os contribuintes do filtro atual."
          >
            {consulta.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Consultar Receita
            {selecionados.length
              ? ` (${selecionados.length} selecionado(s))`
              : ` (${totalRegistros})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={marcarPendentesReceita}
            aria-label="Filtrar e selecionar contribuintes pendentes na Receita Federal"
            title="Mostra apenas os contribuintes sem consulta ou sem resposta da Receita Federal em toda a apuração e já os seleciona."
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            Pendentes na Receita
          </Button>
          <BotaoReconsultarFalhas
            total={fila.total}
            onReconsultar={reconsultarSemResposta}
            reconsultando={fila.reconsultando}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Escolher colunas visíveis no grid"
                title="Escolha quais colunas ver no grid. A escolha fica gravada no seu usuário."
              >
                <Columns3 className="mr-2 h-4 w-4" />
                Colunas ({colunasVisiveis.length}/{COLUNAS.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Colunas do grid</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUNAS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={visivel(c.id)}
                  onCheckedChange={(v) => alternarColuna(c.id, v === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.rotulo}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => prefColunas.definir(COLUNAS_PADRAO)}>
                Restaurar todas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {carga && (
            <OficiosDialog
              cargaId={cargaId}
              exercicio={carga.exercicio}
              selecionados={selecionados}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            title="Levar os contribuintes marcados para a impugnação do índice provisório"
            onClick={() => {
              if (!selecionados.length) {
                toast.error("Marque os contribuintes que entram na impugnação.");
                return;
              }
              void navigate({
                to: "/impugnacao",
                search: {
                  carga: cargaId,
                  ids: selecionados.join(","),
                  ...(carga?.exercicio ? { exercicio: carga.exercicio } : {}),
                },
              });
            }}
          >
            <Gavel className="mr-2 h-4 w-4" />
            Montar impugnação
            {selecionados.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {selecionados.length}
              </span>
            )}
          </Button>
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        {(["TODOS", ...SITUACOES] as const).map((s) => {
          const ativo = s === "TODOS" ? filtros.length === 0 : filtros.includes(s);
          return (
            <Button
              key={s}
              size="sm"
              variant={ativo ? "default" : "outline"}
              title={
                s === "TODOS"
                  ? "Mostrar todas as situações"
                  : "Clique para somar esta situação ao filtro (pode marcar várias)"
              }
              onClick={() => {
                setPagina(0);
                setFiltros((atual) =>
                  s === "TODOS"
                    ? []
                    : atual.includes(s)
                      ? atual.filter((x) => x !== s)
                      : [...atual, s],
                );
              }}
            >
              {s === "TODOS" ? "Todos" : ROTULO_SITUACAO[s]}
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                  ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {contagens ? contagens[s] : "…"}
              </span>
            </Button>
          );
        })}

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
          onValueChange={(v) => {
            setReceitaFiltro(v as SituacaoReceita | "TODOS" | "NAO_CONSULTADO" | "PENDENTES");
            setPagina(0);
          }}
        >
          <SelectTrigger
            className="h-8 w-64"
            aria-label="Filtrar por situação na Receita Federal (toda a apuração)"
          >
            <SelectValue placeholder="Situação na Receita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Receita: todas</SelectItem>
            <SelectItem value="PENDENTES">Receita: pendentes (não consultado + falha)</SelectItem>
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
          {(isFetching && !data) ||
          (filtroReceitaAtivo && carregandoTodas && !todasLinhas) ||
          (filtroReceitaAtivo && !receitaPronta) ? (
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
                    {visivel("nome") && (
                      <ColunaHead coluna="nome" ordem={ordem} onSort={ordenarPor}>Contribuinte</ColunaHead>
                    )}
                    {visivel("cnpj") && (
                      <ColunaHead coluna="cnpj" ordem={ordem} onSort={ordenarPor}>CNPJ</ColunaHead>
                    )}
                    {visivel("inscricao_estadual") && (
                      <ColunaHead coluna="inscricao_estadual" ordem={ordem} onSort={ordenarPor}>IE</ColunaHead>
                    )}
                    {visivel("cnae") && (
                      <ColunaHead coluna="cnae" ordem={ordem} onSort={ordenarPor}>CNAE</ColunaHead>
                    )}
                    {visivel("vaf_atual") && (
                      <ColunaHead coluna="vaf_atual" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF atual (R$)</ColunaHead>
                    )}
                    {visivel("vaf_anterior") && (
                      <ColunaHead coluna="vaf_anterior" ordem={ordem} onSort={ordenarPor} alinhar="right">VAF anterior (R$)</ColunaHead>
                    )}
                    {visivel("variacao_pct") && (
                      <ColunaHead coluna="variacao_pct" ordem={ordem} onSort={ordenarPor} alinhar="right">Variação</ColunaHead>
                    )}
                    {visivel("situacao_cadastral") && (
                      <ColunaHead coluna="situacao_cadastral" ordem={ordem} onSort={ordenarPor}>
                        Situação cadastral
                      </ColunaHead>
                    )}
                    {visivel("receita_federal") && (
                      <ColunaHead coluna="receita_federal" ordem={ordem} onSort={ordenarPor}>
                        Receita Federal
                      </ColunaHead>
                    )}
                    {visivel("receita_data") && (
                      <ColunaHead coluna="receita_data" ordem={ordem} onSort={ordenarPor}>
                        Data da situação (RF)
                      </ColunaHead>
                    )}
                    {visivel("situacoes") && (
                      <ColunaHead coluna="situacoes" ordem={ordem} onSort={ordenarPor}>
                        Situação
                      </ColunaHead>
                    )}
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


                        {visivel("nome") && (
                          <TableCell className="max-w-64 truncate font-medium">{c.nome}</TableCell>
                        )}
                        {visivel("cnpj") && (
                          <TableCell className="whitespace-nowrap">{formatarCnpj(c.cnpj)}</TableCell>
                        )}
                        {visivel("inscricao_estadual") && (
                          <TableCell className="whitespace-nowrap">{c.inscricao_estadual}</TableCell>
                        )}
                        {visivel("cnae") && (
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
                        )}
                        {visivel("vaf_atual") && (
                          <TableCell className="text-right whitespace-nowrap">
                            {formatarValorGrid(c.vaf_atual)}
                          </TableCell>
                        )}
                        {visivel("vaf_anterior") && (
                          <TableCell className="text-right whitespace-nowrap">
                            {formatarValorGrid(c.vaf_anterior)}
                          </TableCell>
                        )}
                        {visivel("variacao_pct") && (
                          <TableCell className="text-right whitespace-nowrap">
                            {formatarPercentual(c.variacao_pct)}
                          </TableCell>
                        )}
                        {visivel("situacao_cadastral") && (
                        <TableCell>
                          <SituacaoCadastralBadge situacao={(c as any).situacao_cadastral} />
                          {(c as any).mes_fim_atividade &&
                          (c as any).mes_fim_atividade < 12 ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              atividade até o mês {(c as any).mes_fim_atividade}
                            </span>
                          ) : null}
                        </TableCell>
                        )}
                        {visivel("receita_federal") && (
                        <TableCell>
                          {(() => {
                            const reg = situacaoReceitaDe(c.cnpj);
                            const partes = [
                              typeof reg?.motivo === "string" && reg.motivo.trim()
                                ? reg.motivo
                                : null,
                              reg?.situacao_data
                                ? `Situação desde ${formatarData(reg.situacao_data)}`
                                : null,
                            ].filter(Boolean);
                            const motivo = partes.length ? partes.join(" · ") : null;
                            return (
                              <SituacaoReceitaBadge
                                situacao={reg?.situacao ?? null}
                                motivo={motivo}
                              />
                            );
                          })()}
                        </TableCell>
                        )}
                        {visivel("receita_data") && (
                          <TableCell className="whitespace-nowrap">
                            {(() => {
                              const reg = situacaoReceitaDe(c.cnpj);
                              return reg?.situacao_data ? formatarData(reg.situacao_data) : "—";
                            })()}
                          </TableCell>
                        )}
                        {visivel("situacoes") && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(c.situacoes as string[]).map((s) => (
                                <SituacaoBadge key={s} situacao={s} />
                              ))}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {!linhasVisiveis.length && (
                    <TableRow>
                      <TableCell colSpan={totalColunas} className="py-10 text-center text-muted-foreground">
                        Nenhum contribuinte encontrado com esses filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {!!linhasVisiveis.length && (
                  <TableFooter>
                    <TableRow>
                      <TableCell />
                      {colunasNaOrdem.map((col, i) => {
                        if (col.id === "vaf_atual")
                          return (
                            <TableCell
                              key={col.id}
                              className="text-right font-medium whitespace-nowrap"
                            >
                              {formatarValorGrid(totalVafAtual)}
                            </TableCell>
                          );
                        if (col.id === "vaf_anterior")
                          return (
                            <TableCell
                              key={col.id}
                              className="text-right font-medium whitespace-nowrap"
                            >
                              {formatarValorGrid(totalVafAnterior)}
                            </TableCell>
                          );
                        if (i === 0)
                          return (
                            <TableCell key={col.id} className="font-medium">
                              {linhasVisiveis.length} contribuinte(s) nesta página ·{" "}
                              {totalRegistros} no total
                            </TableCell>
                          );
                        return <TableCell key={col.id} />;
                      })}
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
          Página {paginaAtual + 1} de {totalPaginas}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual === 0}
            onClick={() => setPagina(paginaAtual - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaAtual + 1 >= totalPaginas}
            onClick={() => setPagina(paginaAtual + 1)}
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
