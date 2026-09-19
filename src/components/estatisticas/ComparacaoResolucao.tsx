import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Download,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useMunicipios } from "@/hooks/useMunicipio";
import { useResolucoesSef } from "@/hooks/useResolucoesSef";
import {
  useComparacoesSalvas,
  useExcluirComparacao,
  useIndicesDaResolucao,
  useSalvarComparacao,
  type ComparacaoSalva,
  type LinhaComparacaoGravada,
} from "@/hooks/useComparacoesEstatisticas";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { formatarPercentual } from "@/lib/format";
import { formatarIndice } from "@/lib/vaf/indice";

type Ordem = "nome" | "base" | "comparada" | "variacao" | "situacao";
type Direcao = "asc" | "desc";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function rotuloResolucao(numero: string, anoApuracao?: number, anoAplicacao?: number) {
  return `Resolução ${numero}${anoApuracao ? ` · apuração ${anoApuracao}` : ""}${anoAplicacao ? ` · aplicação ${anoAplicacao}` : ""}`;
}

export function ComparacaoResolucao() {
  const { data: municipios, isLoading: carregandoMunicipios } = useMunicipios();
  const { data: resolucoes = [], isLoading: carregandoResolucoes } = useResolucoesSef();
  const { data: gravadas = [] } = useComparacoesSalvas();
  const salvar = useSalvarComparacao();
  const excluir = useExcluirComparacao();

  const [baseNumero, setBaseNumero] = useState("");
  const [comparadaNumero, setComparadaNumero] = useState("");
  const [texto, setTexto] = useState("");
  const [situacao, setSituacao] = useState("todas");
  const [ordem, setOrdem] = useState<Ordem>("variacao");
  const [direcao, setDirecao] = useState<Direcao>("desc");
  const [nome, setNome] = useState("");
  const [gravada, setGravada] = useState<ComparacaoSalva | null>(null);

  useEffect(() => {
    if (!resolucoes.length || baseNumero || comparadaNumero) return;
    setComparadaNumero(resolucoes[0]?.numero ?? "");
    setBaseNumero(resolucoes[1]?.numero ?? resolucoes[0]?.numero ?? "");
  }, [resolucoes, baseNumero, comparadaNumero]);

  const { data: baseDados = [], isLoading: carregandoBase } = useIndicesDaResolucao(
    baseNumero || null,
  );
  const { data: comparadaDados = [], isLoading: carregandoComparada } = useIndicesDaResolucao(
    comparadaNumero || null,
  );

  const resolucaoBase = resolucoes.find((r) => r.numero === baseNumero);
  const resolucaoComparada = resolucoes.find((r) => r.numero === comparadaNumero);

  const linhasAtuais = useMemo<LinhaComparacaoGravada[]>(() => {
    // Casa pelo vínculo direto e, como reserva, pelo código oficial do município:
    // prefeituras cadastradas depois da carga da resolução ainda não têm vínculo.
    const indexar = (linhas: typeof baseDados) => {
      const porId = new Map<string, number | null>();
      const porCodigo = new Map<string, number | null>();
      for (const l of linhas) {
        if (l.municipio_id) porId.set(l.municipio_id, l.media_indices);
        const codigo = normalizarCodigoSef(l.codigo_mun);
        if (codigo) porCodigo.set(codigo, l.media_indices);
      }
      return { porId, porCodigo };
    };
    const base = indexar(baseDados);
    const comparada = indexar(comparadaDados);
    const buscar = (idx: ReturnType<typeof indexar>, id: string, codigoSef: string | null) => {
      const porId = idx.porId.get(id);
      if (porId != null) return porId;
      const codigo = normalizarCodigoSef(codigoSef);
      return codigo ? idx.porCodigo.get(codigo) : undefined;
    };
    return (municipios ?? []).map((municipio) => {
      const mediaBaseRaw = buscar(base, municipio.id, municipio.codigo_sef);
      const mediaComparadaRaw = buscar(comparada, municipio.id, municipio.codigo_sef);
      const mediaBase = mediaBaseRaw == null ? null : Number(mediaBaseRaw);
      const mediaComparada = mediaComparadaRaw == null ? null : Number(mediaComparadaRaw);
      const pontos = mediaBase != null && mediaComparada != null ? mediaComparada - mediaBase : null;
      const variacao = pontos != null && mediaBase != null && mediaBase !== 0 ? (pontos / mediaBase) * 100 : null;
      const estado =
        variacao == null
          ? "sem_apuracao"
          : variacao > 0.5
            ? "subiu"
            : variacao < -0.5
              ? "caiu"
              : "estavel";
      return {
        municipioId: municipio.id,
        municipio: municipio.nome,
        mediaBase,
        mediaComparada,
        pontos,
        variacao,
        situacao: estado,
      };
    });
  }, [municipios, baseDados, comparadaDados]);

  const linhas = gravada?.linhas ?? linhasAtuais;
  const visiveis = useMemo(() => {
    const termo = texto.trim().toLocaleLowerCase("pt-BR");
    const resultado = linhas.filter(
      (linha) =>
        (!termo || linha.municipio.toLocaleLowerCase("pt-BR").includes(termo)) &&
        (situacao === "todas" || linha.situacao === situacao),
    );
    const fator = direcao === "asc" ? 1 : -1;
    return [...resultado].sort((a, b) => {
      let valor = 0;
      if (ordem === "nome") valor = a.municipio.localeCompare(b.municipio, "pt-BR");
      else if (ordem === "situacao") valor = a.situacao.localeCompare(b.situacao, "pt-BR");
      else if (ordem === "base") valor = (a.mediaBase ?? -Infinity) - (b.mediaBase ?? -Infinity);
      else if (ordem === "comparada")
        valor = (a.mediaComparada ?? -Infinity) - (b.mediaComparada ?? -Infinity);
      else valor = (a.variacao ?? -Infinity) - (b.variacao ?? -Infinity);
      return valor * fator;
    });
  }, [linhas, texto, situacao, ordem, direcao]);

  function ordenarPor(novaOrdem: Ordem) {
    if (novaOrdem === ordem) setDirecao((atual) => (atual === "asc" ? "desc" : "asc"));
    else {
      setOrdem(novaOrdem);
      setDirecao(novaOrdem === "nome" || novaOrdem === "situacao" ? "asc" : "desc");
    }
  }

  const comparados = linhas.filter((l) => l.mediaBase != null && l.mediaComparada != null);
  const subiram = linhas.filter((l) => l.situacao === "subiu").length;
  const cairam = linhas.filter((l) => l.situacao === "caiu").length;
  const somaBase = comparados.reduce((s, l) => s + Number(l.mediaBase), 0);
  const somaComparada = comparados.reduce((s, l) => s + Number(l.mediaComparada), 0);
  const variacaoTotal = somaBase ? ((somaComparada - somaBase) / somaBase) * 100 : null;

  const dadosGrafico = visiveis
    .filter((l) => l.variacao != null)
    .map((l) => ({ nome: l.municipio, variacao: Number(l.variacao?.toFixed(2)) }))
    .sort((a, b) => a.variacao - b.variacao);
  const dadosIndices = visiveis
    .filter((l) => l.mediaBase != null || l.mediaComparada != null)
    .map((l) => ({
      nome: l.municipio,
      base: l.mediaBase ?? 0,
      comparada: l.mediaComparada ?? 0,
    }));

  function exportar() {
    const csv = montarCsv(
      [
        "Município",
        `Média Resolução ${gravada?.resolucao_numero ?? baseNumero}`,
        `Média Resolução ${gravada?.resolucao_comparada_numero ?? comparadaNumero}`,
        "Diferença (pontos)",
        "Variação (%)",
        "Situação",
      ],
      visiveis.map((l) => [
        l.municipio,
        l.mediaBase != null ? formatarIndice(l.mediaBase) : "",
        l.mediaComparada != null ? formatarIndice(l.mediaComparada) : "",
        l.pontos != null ? formatarIndice(l.pontos) : "",
        l.variacao != null ? l.variacao.toFixed(2).replace(".", ",") : "",
        l.situacao === "sem_apuracao"
          ? "Sem informação"
          : l.situacao === "estavel"
            ? "Estável"
            : l.situacao === "subiu"
              ? "Subiu"
              : "Caiu",
      ]),
    );
    baixarCsv(`resolucoes-${baseNumero}-x-${comparadaNumero}.csv`, csv);
  }

  async function gravar() {
    if (!nome.trim()) {
      toast.error("Dê um nome para a comparação.");
      return;
    }
    if (!baseNumero || !comparadaNumero) {
      toast.error("Escolha as duas resoluções.");
      return;
    }
    try {
      await salvar.mutateAsync({
        nome: nome.trim(),
        resolucaoBaseNumero: baseNumero,
        resolucaoComparadaNumero: comparadaNumero,
        linhas: linhasAtuais,
      });
      setNome("");
      toast.success("Comparação gravada.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível gravar.");
    }
  }

  function carregar(registro: ComparacaoSalva) {
    setGravada(registro);
    setBaseNumero(registro.resolucao_numero);
    setComparadaNumero(registro.resolucao_comparada_numero ?? registro.resolucao_numero);
  }

  const carregando = carregandoMunicipios || carregandoResolucoes || carregandoBase || carregandoComparada;
  const tituloBase = gravada?.resolucao_numero ?? baseNumero;
  const tituloComparada = gravada?.resolucao_comparada_numero ?? comparadaNumero;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Estatísticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare as médias oficiais de duas resoluções em todas as prefeituras cadastradas.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <SeletorResolucao
            id="resolucao-base"
            label="Resolução base"
            value={baseNumero}
            resolucoes={resolucoes}
            onChange={(valor) => {
              setBaseNumero(valor);
              setGravada(null);
            }}
          />
          <SeletorResolucao
            id="resolucao-comparada"
            label="Resolução comparada"
            value={comparadaNumero}
            resolucoes={resolucoes}
            onChange={(valor) => {
              setComparadaNumero(valor);
              setGravada(null);
            }}
          />
          <div className="space-y-1.5">
            <Label htmlFor="busca-municipio">Município</Label>
            <Input
              id="busca-municipio"
              className="w-52"
              placeholder="Filtrar pelo nome"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filtro-situacao">Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger id="filtro-situacao" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="subiu">Subiu</SelectItem>
                <SelectItem value="caiu">Caiu</SelectItem>
                <SelectItem value="estavel">Estável</SelectItem>
                <SelectItem value="sem_apuracao">Sem informação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportar} disabled={!visiveis.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {gravada && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <Badge variant="secondary">Comparação gravada</Badge>
          <span>{gravada.nome} · {dataCurta(gravada.criado_em)}</span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setGravada(null)}>
            Voltar à seleção atual
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi rotulo="Prefeituras comparadas" valor={String(comparados.length)} />
        <Kpi rotulo="Subiram" valor={String(subiram)} />
        <Kpi rotulo="Caíram" valor={String(cairam)} />
        <Kpi
          rotulo="Variação da soma dos índices"
          valor={formatarPercentual(variacaoTotal)}
          apoio={`${formatarIndice(somaBase)} → ${formatarIndice(somaComparada)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Resolução {tituloBase || "—"} x Resolução {tituloComparada || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <Cabecalho rotulo="Município" coluna="nome" ordem={ordem} direcao={direcao} onOrdenar={ordenarPor} />
                  <Cabecalho rotulo={`Média Res. ${tituloBase || "base"}`} coluna="base" ordem={ordem} direcao={direcao} onOrdenar={ordenarPor} direita />
                  <Cabecalho rotulo={`Média Res. ${tituloComparada || "comparada"}`} coluna="comparada" ordem={ordem} direcao={direcao} onOrdenar={ordenarPor} direita />
                  <Cabecalho rotulo="Variação" coluna="variacao" ordem={ordem} direcao={direcao} onOrdenar={ordenarPor} direita />
                  <Cabecalho rotulo="Situação" coluna="situacao" ordem={ordem} direcao={direcao} onOrdenar={ordenarPor} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregando ? (
                  <TableRow><TableCell colSpan={5} className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : visiveis.length ? (
                  visiveis.map((linha) => (
                    <TableRow key={linha.municipioId}>
                      <TableCell className="font-medium">{linha.municipio}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{linha.mediaBase != null ? formatarIndice(linha.mediaBase) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{linha.mediaComparada != null ? formatarIndice(linha.mediaComparada) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {linha.variacao != null ? (
                          <span className={linha.situacao === "caiu" ? "text-destructive" : linha.situacao === "subiu" ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {formatarPercentual(linha.variacao)}
                            <span className="block font-mono text-[11px] text-muted-foreground">
                              {linha.pontos != null && linha.pontos > 0 ? "+" : ""}{linha.pontos != null ? formatarIndice(linha.pontos) : ""}
                            </span>
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell><SituacaoBadge situacao={linha.situacao} /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma prefeitura encontrada com esse filtro.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Gravar comparação</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome-comparacao">Nome</Label>
            <Input id="nome-comparacao" className="w-64" placeholder="Ex.: Aplicação 2026 x 2027" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <Button onClick={() => void gravar()} disabled={salvar.isPending || !!gravada || !linhasAtuais.length}>
            {salvar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Gravar
          </Button>
        </CardContent>
      </Card>

      {!!gravadas.length && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Comparações gravadas</CardTitle></CardHeader>
          <CardContent className="divide-y p-0">
            {gravadas.map((registro) => (
              <div key={registro.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{registro.nome}</span>
                <span className="text-xs text-muted-foreground">Res. {registro.resolucao_numero} x Res. {registro.resolucao_comparada_numero ?? "legado"} · {registro.linhas.length} prefeitura(s) · {dataCurta(registro.criado_em)}</span>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => carregar(registro)}>Carregar</Button>
                  <Button variant="ghost" size="icon" aria-label={`Excluir ${registro.nome}`} onClick={() => { if (gravada?.id === registro.id) setGravada(null); excluir.mutate(registro.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!!dadosGrafico.length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Variação por prefeitura</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(220, dadosGrafico.length * 34)}>
              <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 24, right: 24 }}>
                <XAxis type="number" tickFormatter={(v: number) => `${v}%`} fontSize={12} />
                <YAxis type="category" dataKey="nome" width={150} fontSize={12} />
                <ChartTooltip formatter={(v: number) => [`${v}%`, "Variação"]} />
                <Bar dataKey="variacao" radius={4}>{dadosGrafico.map((d) => <Cell key={d.nome} fill={d.variacao < 0 ? "var(--destructive)" : "var(--chart-1)"} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!!dadosIndices.length && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Médias oficiais por resolução</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={dadosIndices} margin={{ left: 8, right: 8 }}>
                <XAxis dataKey="nome" fontSize={11} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis fontSize={11} tickFormatter={(v: number) => v.toFixed(3)} />
                <ChartTooltip formatter={(v: number) => formatarIndice(v)} />
                <Legend />
                <Bar dataKey="base" name={`Resolução ${tituloBase}`} fill="var(--chart-2)" radius={3} />
                <Bar dataKey="comparada" name={`Resolução ${tituloComparada}`} fill="var(--chart-1)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SeletorResolucao({ id, label, value, resolucoes, onChange }: { id: string; label: string; value: string; resolucoes: ReturnType<typeof useResolucoesSef>["data"]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-72"><SelectValue placeholder="Escolha a resolução" /></SelectTrigger>
        <SelectContent>{(resolucoes ?? []).map((r) => <SelectItem key={r.id} value={r.numero}>{rotuloResolucao(r.numero, r.ano_apuracao, r.ano_aplicacao)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function SituacaoBadge({ situacao }: { situacao: LinhaComparacaoGravada["situacao"] }) {
  if (situacao === "subiu") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" variant="secondary"><ArrowUpRight className="mr-1 h-3 w-3" /> Subiu</Badge>;
  if (situacao === "caiu") return <Badge className="bg-destructive/15 text-destructive" variant="secondary"><ArrowDownRight className="mr-1 h-3 w-3" /> Caiu</Badge>;
  if (situacao === "estavel") return <Badge variant="secondary"><ArrowRight className="mr-1 h-3 w-3" /> Estável</Badge>;
  return <Badge variant="outline">Sem informação</Badge>;
}

function Cabecalho({ rotulo, coluna, ordem, direcao, onOrdenar, direita }: { rotulo: string; coluna: Ordem; ordem: Ordem; direcao: Direcao; onOrdenar: (coluna: Ordem) => void; direita?: boolean }) {
  const ativo = ordem === coluna;
  return (
    <TableHead className={direita ? "text-right" : undefined}>
      <button type="button" onClick={() => onOrdenar(coluna)} className={`inline-flex items-center gap-1 hover:text-foreground ${direita ? "flex-row-reverse" : ""} ${ativo ? "text-foreground" : "text-muted-foreground"}`}>
        {rotulo}{ativo ? direcao === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
      </button>
    </TableHead>
  );
}

function Kpi({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio?: string }) {
  return <Card><CardContent className="p-5"><p className="text-xs tracking-wide text-muted-foreground uppercase">{rotulo}</p><p className="mt-2 font-display text-2xl font-bold tabular-nums">{valor}</p>{apoio && <p className="mt-1 font-mono text-xs text-muted-foreground">{apoio}</p>}</CardContent></Card>;
}