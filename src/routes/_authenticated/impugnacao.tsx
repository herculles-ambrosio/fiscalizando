/**
 * Impugnação do índice provisório do VAF: monta a petição completa e a
 * planilha de contribuintes contestados a partir dos contribuintes marcados
 * em Contribuintes ou em Análises do VAF.
 */

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText, Gavel, Loader2, Package, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import {
  useExcluirImpugnacao,
  useImpugnacoes,
  useSalvarImpugnacao,
} from "@/hooks/useImpugnacoes";
import { formatarCnpj } from "@/lib/format";
import {
  baixarArquivo,
  CHAVE_ITENS_IMPUGNACAO,
  diferencaItem,
  moedaBr,
  motivoSugerido,
  nomeBaseArquivo,
  planilhaImpugnacao,
  totalContestado,
  zipImpugnacao,
  type DadosImpugnacao,
  type ItemImpugnacao,
} from "@/lib/vaf/impugnacao";

type Busca = {
  carga?: string | undefined;
  ids?: string | undefined;
  exercicio?: number | undefined;
  /** Índice provisório publicado, trazido de Análises do VAF. */
  indice?: number | undefined;
};

export const Route = createFileRoute("/_authenticated/impugnacao")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    carga: typeof s["carga"] === "string" ? s["carga"] : undefined,
    ids: typeof s["ids"] === "string" ? s["ids"] : undefined,
    exercicio: Number(s["exercicio"]) > 0 ? Number(s["exercicio"]) : undefined,
    indice: Number(s["indice"]) > 0 ? Number(s["indice"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Impugnação do índice provisório do VAF — Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Monte a impugnação do índice provisório do VAF com a lista de contribuintes contestados, texto pronto e planilha anexa.",
      },
      { property: "og:title", content: "Impugnação do índice provisório do VAF" },
      {
        property: "og:description",
        content:
          "Petição completa e planilha de contribuintes para contestar o índice provisório do VAF junto à SEF/MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpugnacaoPagina,
});

const numero = (v: string): number => {
  const limpo = v.replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
};

/** Campo monetário: enquanto digita mantém o texto do usuário; formata ao sair. */
function EntradaMoeda({
  valor,
  aoMudar,
  ...resto
}: { valor: number; aoMudar: (v: number) => void } & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange"
>) {
  const formatar = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <Input
      {...resto}
      value={texto ?? formatar(valor)}
      onChange={(e) => {
        setTexto(e.target.value);
        aoMudar(numero(e.target.value));
      }}
      onBlur={() => setTexto(null)}
    />
  );
}


function ImpugnacaoPagina() {
  const busca = Route.useSearch();
  const { municipio, municipioId } = useMunicipioAtivo();
  const { data: config } = useConfiguracao();
  const salvar = useSalvarImpugnacao();
  const excluir = useExcluirImpugnacao();
  const { data: salvas } = useImpugnacoes(municipioId ?? null);

  const anoAtual = new Date().getFullYear();
  const [id, setId] = useState<string | null>(null);
  const [nome, setNome] = useState("Impugnação do índice provisório");
  const [exercicio, setExercicio] = useState<number>(busca.exercicio ?? anoAtual + 1);
  const [anoBase, setAnoBase] = useState<number>((busca.exercicio ?? anoAtual + 1) - 2);
  /** enquanto o ano-base não for editado à mão, ele acompanha o exercício */
  const [anoBaseManual, setAnoBaseManual] = useState(false);
  const [resolucao, setResolucao] = useState("Resolução SEF nº 6.069/2026");
  const [resolucaoData, setResolucaoData] = useState("");
  const [indice, setIndice] = useState(
    busca.indice ? busca.indice.toLocaleString("pt-BR", { minimumFractionDigits: 7, maximumFractionDigits: 7 }) : "",
  );
  const [cnpjPrefeitura, setCnpjPrefeitura] = useState("");
  const [consultorNome, setConsultorNome] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemImpugnacao[]>([]);
  const [gerando, setGerando] = useState<"docx" | "xlsx" | "anexos" | "zip" | null>(null);

  useEffect(() => {
    if (!anoBaseManual) setAnoBase(exercicio - 2);
  }, [exercicio, anoBaseManual]);


  const ids = useMemo(
    () => (busca.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    [busca.ids],
  );

  const contribuintes = useQuery({
    queryKey: ["impugnacao-contribuintes", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("id, nome, cnpj, inscricao_estadual, vaf_atual, vaf_anterior, situacoes")
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contribuintes vindos do grid (por id) ou de Análises do VAF (sessionStorage).
  useEffect(() => {
    if (!contribuintes.data?.length) return;
    setItens(
      contribuintes.data.map((c) => ({
        ie: c.inscricao_estadual,
        cnpj: c.cnpj,
        nome: c.nome,
        motivo: motivoSugerido(c.situacoes as string[] | null),
        vafApurado: Number(c.vaf_atual ?? 0),
        vafCorreto: Number(c.vaf_anterior ?? c.vaf_atual ?? 0),
        observacao: "",
      })),
    );
  }, [contribuintes.data]);

  useEffect(() => {
    if (ids.length) return;
    if (typeof window === "undefined") return;
    const bruto = window.sessionStorage.getItem(CHAVE_ITENS_IMPUGNACAO);
    if (!bruto) return;
    try {
      const lidos = JSON.parse(bruto) as ItemImpugnacao[];
      if (Array.isArray(lidos) && lidos.length) setItens(lidos);
    } catch {
      /* conteúdo inválido: ignora */
    }
    window.sessionStorage.removeItem(CHAVE_ITENS_IMPUGNACAO);
  }, [ids.length]);

  const total = totalContestado(itens);

  const dados: DadosImpugnacao = {
    nome,
    exercicio,
    anoBase,
    resolucao,
    resolucaoData: resolucaoData || null,
    indicePublicado: indice ? numero(indice) : null,
    observacao,
    itens,
  };

  const ctx = {
    municipio: municipio?.nome ?? null,
    prefeitura: config?.nome_prefeitura ?? null,
    cidadeData: config?.cidade_data ?? null,
    signatarioNome: config?.signatario_nome ?? null,
    signatarioCargo: config?.signatario_cargo ?? null,
    cnpj: cnpjPrefeitura.trim() || null,
    consultorNome: consultorNome.trim() || null,
    consultorCargo: "Consultor Tributário",
  };

  function alterar(indice: number, campo: keyof ItemImpugnacao, valor: string) {
    setItens((atual) =>
      atual.map((i, n) =>
        n !== indice
          ? i
          : campo === "vafApurado" || campo === "vafCorreto"
            ? { ...i, [campo]: numero(valor) }
            : { ...i, [campo]: valor },
      ),
    );
  }

  async function baixar(tipo: "docx" | "xlsx" | "anexos" | "zip") {
    if (!itens.length) {
      toast.error("Inclua ao menos um contribuinte na impugnação.");
      return;
    }
    setGerando(tipo);
    try {
      const base = nomeBaseArquivo(dados, municipio?.nome ?? null);
      const planilha = () => planilhaImpugnacao(dados, municipio?.nome ?? null);
      if (tipo === "xlsx") {
        baixarArquivo(planilha(), `${base}_anexo-I_contribuintes.xlsx`);
      } else if (tipo === "anexos") {
        const { gerarAnexosImpugnacao } = await import("@/lib/vaf/impugnacaoAnexos");
        const { anexoII, anexoIII } = await gerarAnexosImpugnacao(dados, ctx);
        baixarArquivo(anexoII, `${base}_anexo-II_demonstrativo.docx`);
        baixarArquivo(anexoIII, `${base}_anexo-III_fichas.docx`);
      } else {
        const { gerarDocxImpugnacao } = await import("@/lib/vaf/impugnacaoDocx");
        const doc = await gerarDocxImpugnacao(dados, ctx);
        if (tipo === "docx") baixarArquivo(doc, `${base}.docx`);
        else {
          const { gerarAnexosImpugnacao } = await import("@/lib/vaf/impugnacaoAnexos");
          const anexos = await gerarAnexosImpugnacao(dados, ctx);
          baixarArquivo(await zipImpugnacao(doc, planilha(), base, anexos), `${base}.zip`);
        }
      }
      toast.success("Arquivo gerado.");
    } catch (erro) {
      toast.error("Não foi possível gerar o arquivo.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setGerando(null);
    }
  }


  function gravar() {
    if (!municipioId) {
      toast.error("Escolha a prefeitura ativa antes de salvar.");
      return;
    }
    salvar.mutate(
      {
        id,
        municipioId,
        cargaId: busca.carga ?? null,
        nome,
        exercicio,
        anoBase,
        resolucao,
        resolucaoData: resolucaoData || null,
        indicePublicado: indice ? numero(indice) : null,
        observacao,
        itens,
      },
      {
        onSuccess: (novoId) => {
          setId(novoId);
          toast.success("Impugnação salva.");
        },
        onError: () => toast.error("Não foi possível salvar a impugnação."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Gavel className="size-6 text-primary" />
            Impugnação do índice provisório
          </h1>
          <p className="text-sm text-muted-foreground">
            Confira os contribuintes, ajuste os valores e baixe a petição pronta com a planilha
            anexa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={gravar} disabled={salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
          <Button variant="outline" onClick={() => baixar("xlsx")} disabled={gerando !== null}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Anexo I (XLSX)
          </Button>
          <Button variant="outline" onClick={() => baixar("anexos")} disabled={gerando !== null}>
            {gerando === "anexos" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Anexos II e III
          </Button>
          <Button variant="outline" onClick={() => baixar("docx")} disabled={gerando !== null}>
            <FileText className="mr-2 h-4 w-4" />
            Impugnação (DOCX)
          </Button>

          <Button onClick={() => baixar("zip")} disabled={gerando !== null}>
            {gerando === "zip" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Baixar tudo (ZIP)
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTitle>Antes de protocolar</AlertTitle>
        <AlertDescription>
          A impugnação deve ser clara e precisa, com as razões de cada divergência, e é protocolada
          no SEI em “SEF – Recurso VAF”, dentro do prazo contado da publicação dos índices
          provisórios. Confira o número e a data da resolução antes de gerar o documento.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados da impugnação</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Prefeitura</Label>
            <Input value={config?.nome_prefeitura ?? municipio?.nome ?? ""} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-cnpj">CNPJ da prefeitura</Label>
            <Input
              id="imp-cnpj"
              placeholder="00.000.000/0001-00"
              value={cnpjPrefeitura}
              onChange={(e) => setCnpjPrefeitura(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-consultor">Consultor responsável (opcional)</Label>
            <Input
              id="imp-consultor"
              placeholder="Nome do consultor que assina junto"
              value={consultorNome}
              onChange={(e) => setConsultorNome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-nome">Identificação interna</Label>
            <Input id="imp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-exercicio">Exercício do índice</Label>
            <Input
              id="imp-exercicio"
              type="number"
              value={exercicio}
              onChange={(e) => setExercicio(Number(e.target.value) || anoAtual)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-anobase">Ano-base</Label>
            <Input
              id="imp-anobase"
              type="number"
              value={anoBase}
              onChange={(e) => {
                setAnoBaseManual(true);
                setAnoBase(Number(e.target.value) || anoAtual - 2);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ano do movimento econômico contestado; usado em todo o texto da petição.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="imp-resolucao">Resolução impugnada</Label>
            <Input
              id="imp-resolucao"
              value={resolucao}
              onChange={(e) => setResolucao(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-resolucao-data">Publicação</Label>
            <Input
              id="imp-resolucao-data"
              type="date"
              value={resolucaoData}
              onChange={(e) => setResolucaoData(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-indice">Índice provisório publicado</Label>
            <Input
              id="imp-indice"
              value={indice}
              placeholder="0,0000000"
              onChange={(e) => setIndice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="imp-obs">Considerações complementares (opcional)</Label>
            <Textarea
              id="imp-obs"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: documentos que instruem o pedido, histórico de diligências, ofícios já enviados."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">
            Contribuintes contestados ({itens.length})
          </CardTitle>
          <span className="text-sm font-medium">
            Total a recompor: <span className="tabular-nums">{moedaBr(total)}</span>
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {contribuintes.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando contribuintes…</p>
          ) : itens.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>IE / CNPJ</TableHead>
                    <TableHead className="min-w-[16rem]">Motivo</TableHead>
                    <TableHead className="text-right">VAF apurado</TableHead>
                    <TableHead className="text-right">VAF correto</TableHead>
                    <TableHead className="text-right">A recompor</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i, n) => (
                    <TableRow key={`${i.ie}-${n}`}>
                      <TableCell className="max-w-[16rem] truncate">{i.nome ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {i.ie}
                        <br />
                        {formatarCnpj(i.cnpj)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={i.motivo}
                          onChange={(e) => alterar(n, "motivo", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <EntradaMoeda
                          className="text-right"
                          valor={i.vafApurado}
                          aoMudar={(v) =>
                            setItens((a) =>
                              a.map((x, k) => (k === n ? { ...x, vafApurado: v } : x)),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <EntradaMoeda
                          className="text-right"
                          valor={i.vafCorreto}
                          aoMudar={(v) =>
                            setItens((a) =>
                              a.map((x, k) => (k === n ? { ...x, vafCorreto: v } : x)),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {moedaBr(diferencaItem(i))}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Retirar contribuinte"
                          onClick={() => setItens((a) => a.filter((_, x) => x !== n))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Nenhum contribuinte selecionado. Marque os contribuintes em{" "}
              <strong>Contribuintes</strong> ou em <strong>Análises do VAF</strong> e clique em
              “Montar impugnação”.
            </p>
          )}
        </CardContent>
      </Card>

      {!!salvas?.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Impugnações salvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {salvas.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {s.nome} — exercício {s.exercicio}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.itens.length} contribuinte(s) ·{" "}
                    {new Date(s.criado_em).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setId(s.id);
                      setNome(s.nome);
                      setExercicio(s.exercicio);
                      setAnoBaseManual(true);
                      setAnoBase(s.ano_base ?? s.exercicio - 2);
                      setResolucao(s.resolucao);
                      setResolucaoData(s.resolucao_data ?? "");
                      setIndice(s.indice_publicado != null ? String(s.indice_publicado) : "");
                      setObservacao(s.observacao ?? "");
                      setItens(s.itens ?? []);
                      toast.success("Impugnação carregada.");
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir impugnação"
                    onClick={() =>
                      excluir.mutate(s.id, {
                        onSuccess: () => toast.success("Impugnação excluída."),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
