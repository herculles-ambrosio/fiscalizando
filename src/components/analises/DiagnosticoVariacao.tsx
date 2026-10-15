import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  ChevronDown,
  ClipboardCopy,
  Download,
  Info,
  Lightbulb,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatarMoeda } from "@/lib/format";
import type { ArquivoEvolucao } from "@/lib/vaf/evolucao";
import { diagnosticarEvolucao, textoDiagnostico, type FatorVariacao } from "@/lib/vaf/diagnostico";
import { useReceitaPorIe } from "@/hooks/useReceitaPorIe";
import {
  BarraSelecaoReceita,
  BotaoConsultarReceita,
  BotaoReconsultarFalhas,
  CaixaSelecaoIe,
  CaixaSelecaoTodas,
  chaveDataSituacao,
  DataSituacaoRf,
  ReceitaIeBadge,
  useSelecaoIes,
  type SelecaoIes,
} from "@/components/analises/ReceitaIe";
import { ProgressoConsultaReceita } from "@/components/receita/ProgressoConsultaReceita";
import type { RegistroReceita } from "@/lib/receita/normalizar";

type ReceitaDe = (ie: string | null | undefined) => RegistroReceita | undefined;

function Barra({
  fator,
  receitaDe,
  cnpjDe,
  origemDe,
  sel,
}: {
  fator: FatorVariacao;
  receitaDe: ReceitaDe;
  cnpjDe: (ie: string | null | undefined) => string | null;
  origemDe: (ie: string | null | undefined) => "cadastro" | "retorno" | null;
  sel: SelecaoIes;
}) {
  const [aberto, setAberto] = useState(false);
  const [ordemData, setOrdemData] = useState<"asc" | "desc" | null>(null);
  const positivo = fator.sentido === "aumentou";
  const Icone = fator.sentido === "neutro" ? Minus : positivo ? ArrowUpRight : ArrowDownRight;
  const cor =
    fator.sentido === "neutro"
      ? "text-muted-foreground"
      : positivo
        ? "text-emerald-600"
        : "text-destructive";
  const fundo = positivo ? "bg-emerald-500/70" : "bg-destructive/70";
  const temDetalhe = fator.itens.length > 0;
  /** fatores por declarante trazem a IE em `sub` — só neles a situação da Receita faz sentido */
  const porContribuinte = fator.itens.some((i) => i.sub?.startsWith("IE "));
  /** nos fatores de quem permaneceu, base negativa não entra na conta (exibida como (R$ 0,00)) */
  const baseZerada =
    porContribuinte && (fator.chave === "quedas" || fator.chave === "altas");
  const ocultos = Math.max(0, fator.totalItens - fator.itens.length);
  const itens = useMemo(() => {
    if (!ordemData || !porContribuinte) return fator.itens;
    const sinal = ordemData === "asc" ? 1 : -1;
    return [...fator.itens].sort((a, b) => {
      const da = chaveDataSituacao(receitaDe(a.chave));
      const db = chaveDataSituacao(receitaDe(b.chave));
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sinal * da.localeCompare(db);
    });
  }, [fator.itens, ordemData, porContribuinte, receitaDe]);

  return (
    <Collapsible open={aberto} onOpenChange={setAberto} className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium">{fator.rotulo}</p>
        <p className={`inline-flex items-center gap-1 font-mono text-sm ${cor}`}>
          <Icone className="h-3.5 w-3.5" />
          {formatarMoeda(fator.impacto)}
          <span className="text-xs text-muted-foreground">
            ({fator.peso.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)
          </span>
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${fundo}`}
          style={{ width: `${Math.min(100, fator.peso)}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{fator.detalhe}</p>
        {temDetalhe && (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`}
              />
              {aberto ? "Ocultar detalhamento" : "Ver detalhamento"}
            </Button>
          </CollapsibleTrigger>
        )}
      </div>
      <CollapsibleContent>
        <div className="mt-1 overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr className="text-muted-foreground">
                {porContribuinte && (
                  <th className="w-8 px-2 py-1.5 text-left font-medium">
                    <CaixaSelecaoTodas ies={fator.itens.map((i) => i.chave)} sel={sel} />
                  </th>
                )}
                <th className="px-2 py-1.5 text-left font-medium">Item</th>
                {porContribuinte && (
                  <th className="px-2 py-1.5 text-left font-medium">Receita Federal</th>
                )}
                {porContribuinte && (
                  <th className="px-2 py-1.5 text-left font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                      title="Ordenar pela data da situação cadastral informada pela Receita Federal"
                      onClick={() =>
                        setOrdemData((o) => (o === "desc" ? "asc" : o === "asc" ? null : "desc"))
                      }
                    >
                      Data da situação (RF)
                      <ArrowUpDown className="h-3 w-3" />
                      {ordemData ? (ordemData === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                )}
                <th className="px-2 py-1.5 text-right font-medium">Base</th>
                <th className="px-2 py-1.5 text-right font-medium">Comparado/estimado</th>
                <th className="px-2 py-1.5 text-right font-medium">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.chave} className="border-t border-border">
                  {porContribuinte && (
                    <td className="px-2 py-1.5">
                      <CaixaSelecaoIe ie={i.chave} sel={sel} rotulo={i.rotulo} />
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <p className="truncate">{i.rotulo}</p>
                    {i.sub && (
                      <p className="font-mono text-[11px] text-muted-foreground">{i.sub}</p>
                    )}
                  </td>
                  {porContribuinte && (
                    <td className="px-2 py-1.5">
                      <ReceitaIeBadge
                        registro={receitaDe(i.chave)}
                        cnpj={cnpjDe(i.chave)}
                        origem={origemDe(i.chave)}
                      />
                    </td>
                  )}
                  {porContribuinte && (
                    <td className="px-2 py-1.5">
                      <DataSituacaoRf registro={receitaDe(i.chave)} />
                    </td>
                  )}

                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {baseZerada && i.valorBase < 0 ? (
                      <span className="text-destructive">({formatarMoeda(Math.abs(i.valorBase))})</span>
                    ) : (
                      formatarMoeda(i.valorBase)
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {formatarMoeda(i.valorAtual)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-mono tabular-nums ${
                      i.impacto < 0 ? "text-destructive" : i.impacto > 0 ? "text-emerald-600" : ""
                    }`}
                  >
                    {formatarMoeda(i.impacto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {ocultos > 0 && (
            <p className="border-t border-border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
              Exibindo os {fator.itens.length} maiores impactos de {fator.totalItens} itens — outros{" "}
              {ocultos} estão no CSV completo.
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DiagnosticoVariacao({
  base,
  atual,
  rotuloBase,
  rotuloAtual,
  municipio,
  municipioId,
  exercicio,
}: {
  base: ArquivoEvolucao;
  atual: ArquivoEvolucao;
  rotuloBase: string;
  rotuloAtual: string;
  municipio?: string | null;
  municipioId?: string | null;
  exercicio?: number | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState<"docx" | "pdf" | null>(null);
  const sel = useSelecaoIes();

  const d = useMemo(() => diagnosticarEvolucao(base, atual), [base, atual]);
  // exercício e município vêm dos seletores da tela — o documento usa exatamente esses filtros
  const exercicioAlvo = exercicio ?? atual.apuracao.anoBase ?? null;

  /** todos os contribuintes citados no diagnóstico (fatores por declarante + tops) */
  const entradasIe = useMemo(() => {
    const mapa = new Map<string, { inscricao_estadual: string; cnpj?: string | null }>();
    for (const c of [...d.topQuedas, ...d.topAltas])
      mapa.set(c.inscricao_estadual, { inscricao_estadual: c.inscricao_estadual, cnpj: c.cnpj });
    for (const f of d.fatoresDeclarantes)
      for (const i of f.itens) {
        if (!i.sub?.startsWith("IE ") || mapa.has(i.chave)) continue;
        mapa.set(i.chave, { inscricao_estadual: i.chave });
      }
    return [...mapa.values()];
  }, [d]);

  const receita = useReceitaPorIe(municipioId ?? null, entradasIe);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(
        textoDiagnostico(d, rotuloBase, rotuloAtual, receita.rotulosPorIe),
      );
      setCopiado(true);
      toast.success("Análise copiada para a área de transferência.");
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não foi possível copiar a análise.");
    }
  };

  const montarAcoes = async () => {
    const { compararDeclarantes } = await import("@/lib/vaf/evolucao");
    const { montarPlanoRecuperacao } = await import("@/lib/vaf/recuperacao");
    return montarPlanoRecuperacao(d, compararDeclarantes(base.declarantes, atual.declarantes), {
      exercicio: exercicioAlvo,
    });
  };

  const baixar = async () => {
    setBaixando("docx");
    try {
      const { baixarDocDiagnostico } = await import("@/lib/vaf/diagnosticoDocx");
      const acoes = await montarAcoes();
      await baixarDocDiagnostico(
        d,
        rotuloBase,
        rotuloAtual,
        municipio ?? null,
        acoes,
        exercicioAlvo,
        receita.rotulosPorIe,
      );
      toast.success("Análise baixada em .docx (abre no Word e exporta em PDF).");
    } catch {
      toast.error("Não foi possível gerar o documento da análise.");
    } finally {
      setBaixando(null);
    }
  };

  const baixarPdf = async () => {
    setBaixando("pdf");
    try {
      const { baixarPdfDiagnostico } = await import("@/lib/vaf/relatorioPdf");
      const acoes = await montarAcoes();
      await baixarPdfDiagnostico(
        d,
        rotuloBase,
        rotuloAtual,
        {
          municipio: municipio ?? null,
          exercicio: exercicioAlvo,
          situacoesReceita: receita.rotulosPorIe,
        },
        acoes,
      );
      toast.success("Análise baixada em .pdf com o papel timbrado.");
    } catch {
      toast.error("Não foi possível gerar o PDF da análise.");
    } finally {
      setBaixando(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-primary" />
            Por que variou
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Análise automática da diferença entre {rotuloBase} e {rotuloAtual}
            {municipio ? ` — ${municipio}` : ""}
            {exercicioAlvo ? ` · exercício ${exercicioAlvo}` : ""}.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <BotaoConsultarReceita
            onConsultar={() => receita.consultar(false)}
            consultando={receita.consultando}
            totalCnpjs={receita.totalCnpjs}
            pendentes={receita.pendentes}
            semCnpj={receita.semCnpj}
          />
          <BotaoReconsultarFalhas
            total={receita.semResposta}
            onReconsultar={receita.reconsultarFalhas}
            reconsultando={receita.reconsultando}
          />
          <Button size="sm" variant="outline" onClick={copiar}>
            <ClipboardCopy className="h-4 w-4" />
            {copiado ? "Copiado" : "Copiar análise"}
          </Button>
          <Button size="sm" onClick={baixar} disabled={baixando !== null}>
            <Download className="h-4 w-4" />
            {baixando === "docx" ? "Gerando..." : "Baixar análise (.docx)"}
          </Button>
          <Button size="sm" variant="secondary" onClick={baixarPdf} disabled={baixando !== null}>
            <Download className="h-4 w-4" />
            {baixando === "pdf" ? "Gerando..." : "Baixar análise (.pdf)"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ProgressoConsultaReceita progresso={receita.progresso} />
        <BarraSelecaoReceita
          sel={sel}
          consultando={receita.consultando}
          onConsultar={(ies) => receita.consultarIes(ies)}
          resumo={receita.resumoSelecao}
          onFecharResumo={receita.limparResumoSelecao}
        />
        <p className="text-sm leading-relaxed">{d.resumo}</p>

        <Tabs defaultValue="declarantes">
          <TabsList className="flex-wrap">
            <TabsTrigger value="declarantes">Por declarantes</TabsTrigger>
            <TabsTrigger value="componentes">Por componente do VAF</TabsTrigger>
            <TabsTrigger value="contribuintes">Maiores impactos</TabsTrigger>
          </TabsList>

          <TabsContent value="declarantes" className="space-y-3 pt-3">
            {d.fatoresDeclarantes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentação relevante.</p>
            ) : (
              d.fatoresDeclarantes.map((f) => (
                <Barra
                  key={f.chave}
                  fator={f}
                  receitaDe={receita.registroDe}
                  cnpjDe={receita.cnpjDe}
                  origemDe={receita.origemDe}
                  sel={sel}
                />
              ))
            )}
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Soma dos fatores = variação total do valor líquido:{" "}
              <span className="font-mono">{formatarMoeda(d.diferenca)}</span>
            </p>
          </TabsContent>

          <TabsContent value="componentes" className="space-y-3 pt-3">
            {d.fatores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum componente do valor líquido variou.
              </p>
            ) : (
              d.fatores.map((f) => (
                <Barra
                  key={f.chave}
                  fator={f}
                  receitaDe={receita.registroDe}
                  cnpjDe={receita.cnpjDe}
                  origemDe={receita.origemDe}
                  sel={sel}
                />
              ))
            )}
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Valor líquido = VAF próprio + crédito externo + crédito interno + crédito próprio −
              débito + acerto de crédito − acerto de débito.
            </p>
          </TabsContent>

          <TabsContent value="contribuintes" className="grid gap-4 pt-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Maiores quedas
              </p>
              {d.topQuedas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma queda registrada.</p>
              ) : (
                d.topQuedas.map((c) => (
                  <div
                    key={`q-${c.inscricao_estadual}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
                  >
                    <CaixaSelecaoIe ie={c.inscricao_estadual} sel={sel} rotulo={c.nome} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.nome ?? "(sem nome)"}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        IE {c.inscricao_estadual}
                        {c.situacao === "saiu" ? " · deixou de declarar" : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ReceitaIeBadge
                          registro={receita.registroDe(c.inscricao_estadual)}
                          cnpj={receita.cnpjDe(c.inscricao_estadual)}
                          origem={receita.origemDe(c.inscricao_estadual)}
                        />
                        <DataSituacaoRf registro={receita.registroDe(c.inscricao_estadual)} />
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-destructive">
                      {formatarMoeda(c.diferenca)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Maiores altas
              </p>
              {d.topAltas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alta registrada.</p>
              ) : (
                d.topAltas.map((c) => (
                  <div
                    key={`a-${c.inscricao_estadual}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2"
                  >
                    <CaixaSelecaoIe ie={c.inscricao_estadual} sel={sel} rotulo={c.nome} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.nome ?? "(sem nome)"}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        IE {c.inscricao_estadual}
                        {c.situacao === "entrou" ? " · novo declarante" : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <ReceitaIeBadge
                          registro={receita.registroDe(c.inscricao_estadual)}
                          cnpj={receita.cnpjDe(c.inscricao_estadual)}
                          origem={receita.origemDe(c.inscricao_estadual)}
                        />
                        <DataSituacaoRf registro={receita.registroDe(c.inscricao_estadual)} />
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm text-emerald-600">
                      {formatarMoeda(c.diferenca)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <Info className="h-3.5 w-3.5" />
            Conclusão
          </p>
          <p className="mt-1 text-sm">{d.conclusao}</p>
        </div>

        {d.alertas.length > 0 && (
          <Alert>
            <AlertTitle className="text-sm">Ressalvas de comparabilidade</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                {d.alertas.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            Base: {formatarMoeda(d.valorBase)}
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            Comparado/estimado: {formatarMoeda(d.valorAtual)}
          </Badge>
          <Badge
            variant="outline"
            className={`font-mono text-xs ${
              d.sentido === "reduziu"
                ? "text-destructive"
                : d.sentido === "aumentou"
                  ? "text-emerald-600"
                  : ""
            }`}
          >
            Diferença: {formatarMoeda(d.diferenca)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
