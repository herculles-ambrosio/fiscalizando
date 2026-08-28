import { useEffect, useMemo, useRef, useState } from "react";
import { NotaRemessa } from "@/components/NotaRemessa";
import { Download, FileUp, HelpCircle, Printer, Save, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useNomesContribuintes } from "@/hooks/useNomesContribuintes";
import {
  apuracaoDoHistorico,
  baixarDetalhamento,
  useCargasComRetorno,
  useRevalidarDetalhamento,
  useSalvarIndice,
  type DetalhamentoIndice,
  type IndiceSalvo,
} from "@/hooks/useIndicesHistorico";
import { podeRevalidar } from "@/lib/vaf/revalidarIndice";
import { nomeMunicipioSef } from "@/lib/vaf/municipiosSef";
import { HistoricoIndices } from "@/components/HistoricoIndices";
import { formatarCnpj, formatarData, formatarMoeda } from "@/lib/format";
import { decodificarArquivo } from "@/lib/vaf/parser";
import { anoDoArquivo, remessaDoArquivo, rotuloRemessa, REMESSA_MAXIMA } from "@/lib/vaf/tipoRetorno";
import {
  apurarIndice,
  conferirLiquido,
  csvIndice,
  estimarIndiceProvisorio,
  formatarIndice,
  possuiIndice,
  type ApuracaoIndice,
  type LinhaContribuinte,
  type LinhaMunicipio,
} from "@/lib/vaf/indice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  nomeDoProdutor,
  type ProdutoresPortal,
  type ResumoCreditoPortal,
} from "@/lib/vaf/creditoPortal";
import CreditoProprioPortal from "@/components/analises/CreditoProprioPortal";

import { baixarCsv as baixarCsvArquivo, montarCsv } from "@/lib/csv";



function Kpi({
  rotulo,
  valor,
  detalhe,
  destaque,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
  ajuda?: React.ReactNode;
}) {
  return (
    <div
      className={
        destaque
          ? "flex min-w-0 flex-col justify-between gap-1 rounded-xl border border-primary/40 bg-primary/5 p-3"
          : "flex min-w-0 flex-col justify-between gap-1 rounded-xl border border-border bg-card p-3"
      }
    >
      {ajuda ? (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="flex cursor-help items-center gap-1 text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
                {rotulo}
                <HelpCircle className="h-3 w-3 shrink-0" />
              </p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1.5">{ajuda}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <p className="text-[10px] uppercase leading-tight tracking-wide text-muted-foreground">
          {rotulo}
        </p>
      )}
      <p
        className={
          destaque
            ? "break-words text-right font-display text-base font-semibold leading-tight text-primary sm:text-lg lg:text-xl"
            : "break-words text-right font-display text-base font-semibold leading-tight sm:text-lg"
        }
      >
        {valor}
      </p>
      {detalhe && (
        <p className="text-right text-[11px] leading-snug text-muted-foreground">{detalhe}</p>
      )}
    </div>
  );
}


function LinhaValor({
  rotulo,
  valor,
  negativo,
}: {
  rotulo: string;
  valor: number;
  negativo?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span
        className={
          negativo
            ? "font-mono text-sm font-medium text-destructive"
            : "font-mono text-sm font-medium"
        }
      >
        {negativo ? "− " : ""}
        {formatarMoeda(valor)}
      </span>
    </div>
  );
}

function TabelaMunicipios({
  linhas,
  titulo,
  nomePorCodigo,
}: {
  linhas: LinhaMunicipio[];
  titulo: string;
  nomePorCodigo: (c: string) => string;
}) {
  const soma = (f: (l: LinhaMunicipio) => number) => linhas.reduce((s, l) => s + f(l), 0);
  const total = soma((l) => l.valor);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{titulo}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Código</TableHead>
            <TableHead>Município</TableHead>
            <TableHead className="text-right">Valor AF</TableHead>
            <TableHead className="text-right">Valor NFA</TableHead>
            <TableHead className="text-right">Valor NFE</TableHead>
            <TableHead className="text-right">Valor NFF</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-20 text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.codigo}>
              <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
              <TableCell>{nomePorCodigo(l.codigo)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatarMoeda(l.af)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatarMoeda(l.nfa)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatarMoeda(l.nfe)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{formatarMoeda(l.nff)}</TableCell>
              <TableCell className="text-right font-mono">{formatarMoeda(l.valor)}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {(total ? (l.valor / total) * 100 : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
              </TableCell>
            </TableRow>
          ))}
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Nenhum registro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-mono text-xs">{formatarMoeda(soma((l) => l.af))}</TableCell>
            <TableCell className="text-right font-mono text-xs">{formatarMoeda(soma((l) => l.nfa))}</TableCell>
            <TableCell className="text-right font-mono text-xs">{formatarMoeda(soma((l) => l.nfe))}</TableCell>
            <TableCell className="text-right font-mono text-xs">{formatarMoeda(soma((l) => l.nff))}</TableCell>
            <TableCell className="text-right font-mono">{formatarMoeda(total)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function TabelaContribuintes({
  linhas,
  nomePorIe,
}: {
  linhas: LinhaContribuinte[];
  /** complemento de nome quando o arquivo não traz (ex.: produtor rural) */
  nomePorIe?: ((ie: string) => string | null) | undefined;
}) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Inscrição estadual</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Contribuinte</TableHead>
          <TableHead className="w-24">Município</TableHead>
          <TableHead className="w-28">Entrega</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l, i) => (
          <TableRow key={`${l.inscricao_estadual}-${i}`}>
            <TableCell className="font-mono text-xs">{l.inscricao_estadual}</TableCell>
            <TableCell className="font-mono text-xs">{formatarCnpj(l.cnpj)}</TableCell>
            <TableCell className="max-w-[22rem] truncate">
              {l.nome ?? nomePorIe?.(l.inscricao_estadual) ?? "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">{l.municipio}</TableCell>
            <TableCell className="text-xs">{formatarData(l.data)}</TableCell>
            <TableCell className="text-right font-mono">{formatarMoeda(l.valor)}</TableCell>
          </TableRow>
        ))}
        {linhas.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhum registro.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5}>Total ({linhas.length})</TableCell>
          <TableCell className="text-right font-mono">{formatarMoeda(total)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

const CHAVE_REF = "vaf_indice_referencia";

export default function IndiceView() {
  // "Nova análise" limpa a tela remontando o painel do zero
  const [resetKey, setResetKey] = useState(0);
  return <PaginaIndice key={resetKey} onNovaAnalise={() => setResetKey((k) => k + 1)} />;
}

function PaginaIndice({ onNovaAnalise }: { onNovaAnalise: () => void }) {
  const { municipio, municipioId, municipios } = useMunicipioAtivo();
  const salvarIndice = useSalvarIndice();

  const { data: config } = useConfiguracao();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [vafEstadualRef, setVafEstadualRef] = useState<string>("");
  const [fator, setFator] = useState<string>("1");
  const inputRef = useRef<HTMLInputElement>(null);
  const [planilha, setPlanilha] = useState<ResumoCreditoPortal | null>(null);
  // relatório de produtores rurais carregado sozinho (arquivos de índice já trazem o crédito)
  const [produtores, setProdutores] = useState<ProdutoresPortal | null>(null);
  const [perguntar, setPerguntar] = useState(false);
  const [registroHistorico, setRegistroHistorico] = useState<IndiceSalvo | null>(null);
  const [detalheHistorico, setDetalheHistorico] = useState<DetalhamentoIndice | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const { data: cargasRetorno = [] } = useCargasComRetorno(municipioId);
  const revalidar = useRevalidarDetalhamento(municipioId);


  // calibração é guardada por prefeitura, para não misturar referências ao trocar
  const chaveRef = `${CHAVE_REF}:${municipioId ?? "sem-municipio"}`;

  useEffect(() => {
    setVafEstadualRef("");
    setFator("1");
    try {
      const salvo = JSON.parse(localStorage.getItem(chaveRef) ?? "null") as {
        vafEstadual?: string;
        fator?: string;
      } | null;
      if (salvo?.vafEstadual) setVafEstadualRef(salvo.vafEstadual);
      if (salvo?.fator) setFator(salvo.fator);
    } catch {
      /* ignora */
    }
  }, [chaveRef]);

  useEffect(() => {
    localStorage.setItem(chaveRef, JSON.stringify({ vafEstadual: vafEstadualRef, fator }));
  }, [chaveRef, vafEstadualRef, fator]);

  const nomePorCodigo = useMemo(() => {
    const mapa = new Map(
      municipios.map((m) => [String(m.codigo_sef).padStart(3, "0"), `${m.nome}/${m.uf}`]),
    );
    return (codigo: string) => {
      const chave = codigo.padStart(3, "0");
      // prefeituras cadastradas primeiro; senão a relação oficial da SEF-MG
      return mapa.get(chave) ?? (nomeMunicipioSef(chave) ? `${nomeMunicipioSef(chave)}/MG` : "—");
    };
  }, [municipios]);

  const apuracaoArquivo = useMemo<ApuracaoIndice | null>(() => {
    if (!texto) return null;
    try {
      if (possuiIndice(texto)) return apurarIndice(texto);
      return estimarIndiceProvisorio(texto, {
        vafEstadualReferencia: Number(vafEstadualRef.replace(/[^0-9]/g, "")) || 0,
        fatorCalibragem: Number(fator.replace(",", ".")) || 1,
        codigoMunicipio: municipio?.codigo_sef ? String(municipio.codigo_sef).padStart(3, "0") : "",
        creditoProprioExterno: planilha?.creditoProprio ?? 0,
        arquivoCreditoProprio: planilha?.arquivoNome ?? "",
      });
    } catch {
      return null;
    }
  }, [texto, vafEstadualRef, fator, municipio?.codigo_sef, planilha]);

  // Índice reaberto a partir do histórico (sem o arquivo original)
  const apuracaoHistorico = useMemo<ApuracaoIndice | null>(
    () =>
      registroHistorico
        ? apuracaoDoHistorico(
            registroHistorico,
            municipio?.codigo_sef ? String(municipio.codigo_sef).padStart(3, "0") : "",
            detalheHistorico,
          )
        : null,
    [registroHistorico, municipio?.codigo_sef, detalheHistorico],
  );

  const apuracao = apuracaoHistorico ?? apuracaoArquivo;

  // inscrição estadual -> nome do contribuinte (a planilha do Portal só traz a IE)
  const { data: nomesGravados } = useNomesContribuintes(municipioId);
  const nomePorIe = useMemo(() => {
    const mapa = new Map<string, string>();
    const normalizar = (ie: string) => (ie ?? "").replace(/\D/g, "").replace(/^0+/, "");
    const registrar = (linhas: LinhaContribuinte[]) => {
      for (const l of linhas) {
        const chave = normalizar(l.inscricao_estadual);
        if (chave && l.nome && !mapa.has(chave)) mapa.set(chave, l.nome);
      }
    };
    if (apuracao) {
      registrar(apuracao.contribuintesVaf);
      registrar(apuracao.simei);
      registrar(apuracao.creditosExternos);
    }
    for (const [ie, nome] of Object.entries(nomesGravados ?? {})) {
      if (!mapa.has(ie)) mapa.set(ie, nome);
    }
    // relatório de produtores rurais do Portal (IE já normalizada na leitura)
    for (const [ie, nome] of produtores?.nomes ?? []) {
      if (!mapa.has(ie)) mapa.set(ie, nome);
    }
    return (ie: string) =>
      mapa.get(normalizar(ie)) ??
      // estabelecimento fora do relatório: usa a raiz da IE (mesmo produtor)
      (produtores ? (nomeDoProdutor(produtores, ie)?.nome ?? null) : null);
  }, [apuracao, nomesGravados, produtores]);

  // Assim que um retorno mensal é carregado sem o crédito próprio (AF/SIARE),
  // perguntamos se o usuário quer dar carga na planilha do Portal do VAF.
  useEffect(() => {
    if (registroHistorico) return;
    if (apuracao?.estimado && !planilha && apuracao.creditoProprio <= 0) setPerguntar(true);
  }, [registroHistorico, apuracao?.estimado, apuracao?.creditoProprio, planilha]);

  useEffect(() => {
    setPlanilha(null);
    setProdutores(null);
    setPerguntar(false);
    setRegistroHistorico(null);
    setDetalheHistorico(null);
  }, [municipioId]);

  async function carregarDoHistorico(r: IndiceSalvo) {
    setArquivo(null);
    setTexto(null);
    setErro(null);
    setPlanilha(null);
    setProdutores(null);
    setPerguntar(false);
    setDetalheHistorico(null);
    setRegistroHistorico(r);

    if (r.detalhamento_path) {
      setCarregandoDetalhe(true);
      try {
        const detalhe = await baixarDetalhamento(r.detalhamento_path);
        setDetalheHistorico(detalhe);
        if (detalhe?.planilha) setPlanilha(detalhe.planilha as ResumoCreditoPortal);
      } finally {
        setCarregandoDetalhe(false);
      }
    } else if (podeRevalidar(r, cargasRetorno)) {
      // índice salvo antes da gravação do detalhamento: reconstrói do arquivo guardado
      await revalidarRegistro(r);
    }
    if (r.vaf_estadual) setVafEstadualRef(String(Math.round(Number(r.vaf_estadual))));
    setFator(String(Number(r.fator_calibragem) || 1).replace(".", ","));
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success(
      `Índice ${r.tipo_indice} de ${r.exercicio} · ${rotuloRemessa(r.competencia_mes)} carregado na tela.`,
    );
  }



  async function revalidarRegistro(r: IndiceSalvo) {
    setCarregandoDetalhe(true);
    try {
      const detalhe = await revalidar.um.mutateAsync({ registro: r, cargas: cargasRetorno });
      setDetalheHistorico(detalhe);
      toast.success("Detalhamento reconstruído a partir do arquivo guardado.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível reconstruir o detalhamento.",
      );
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  function baixarCsvPlanilha() {
    if (!planilha) return;
    const csv = montarCsv(
      ["Tipo nota", "Numero/Chave", "Saida", "Remetente", "Nome do remetente", "Municipio remetente", "Destinatario", "Municipio destinatario", "Produto", "Valor"],
      planilha.notas.map((n) => [
        n.tipoNota,
        n.numero,
        n.data ?? "",
        n.remetente,
        n.remetenteNome ?? nomePorIe(n.remetente) ?? "",
        n.municipioRemetente,

        n.destinatario,
        n.municipioDestinatario,
        n.descricao,
        n.valor.toFixed(2).replace(".", ","),
      ]),
    );
    baixarCsvArquivo(`credito_proprio_portal_${planilha.anoBase ?? ""}.csv`, csv);
  }

  async function selecionar(file: File | null) {
    setRegistroHistorico(null);
    setDetalheHistorico(null);
    setArquivo(file);
    setTexto(null);
    setErro(null);
    if (!file) return;
    setCarregando(true);
    try {
      setTexto(decodificarArquivo(await file.arrayBuffer()));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(false);
    }
  }

  function baixarCsv() {
    if (!apuracao) return;
    const csv = csvIndice(apuracao, municipio?.nome ?? "");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // inclui a prefeitura ativa no nome para não confundir downloads após trocar de município
    const slug = (municipio?.nome ?? "municipio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    a.download = `indice_${apuracao.estimado ? "provisorio_estimado" : apuracao.tipoIndice}_${slug}_${apuracao.codigoMunicipio}_${apuracao.anoBase ?? ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const conferencia = apuracao && !apuracao.estimado ? conferirLiquido(apuracao) : null;
  const divergente =
    !!apuracao &&
    !!municipio?.codigo_sef &&
    !!apuracao.codigoMunicipio &&
    String(municipio.codigo_sef).padStart(3, "0") !== apuracao.codigoMunicipio.padStart(3, "0");
  const mostrarRelatorio = !!apuracao && !divergente;

  // Remessa e ano de entrega do arquivo (P443RT1226 -> remessa 12, entrega 2026); o exercício vem do ano base apurado.
  const competencia = useMemo(() => {
    if (registroHistorico)
      return {
        mes: registroHistorico.competencia_mes,
        ano: registroHistorico.competencia_ano,
      };
    const nome = arquivo?.name ?? "";
    const mes = nome ? remessaDoArquivo(nome) : null;
    const ano = nome ? anoDoArquivo(nome) : null;
    const anoFallback = apuracao?.periodoFim ? Number(apuracao.periodoFim.slice(0, 4)) : null;
    return { mes, ano: ano ?? anoFallback };
  }, [registroHistorico, arquivo?.name, apuracao?.periodoFim]);

  const exercicio = apuracao?.anoBase ?? competencia.ano ?? null;

  // Períodos do retorno mensal costumam vir vazios/zerados ("0-12-31").
  // Aqui validamos e, quando possível, corrigimos para 01/01–31/12 do exercício.
  const periodo = useMemo(() => {
    const valido = (v: string | null | undefined) => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
      const [a, m, d] = v.split("-").map(Number);
      if (!a || !m || !d) return null;
      if (a < 1900 || a > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
      if (Number.isNaN(Date.parse(v))) return null;
      return v;
    };
    const inicioOriginal = apuracao?.periodoInicio ?? null;
    const fimOriginal = apuracao?.periodoFim ?? null;
    const inicioOk = valido(inicioOriginal);
    const fimOk = valido(fimOriginal);
    const inicio = inicioOk ?? (exercicio ? `${exercicio}-01-01` : null);
    const fim = fimOk ?? (exercicio ? `${exercicio}-12-31` : null);
    const invalido = (!!inicioOriginal && !inicioOk) || (!!fimOriginal && !fimOk);
    const ausente = !inicioOriginal || !fimOriginal;
    return { inicio, fim, corrigido: (invalido || ausente) && !!inicio && !!fim, invalido };
  }, [apuracao?.periodoInicio, apuracao?.periodoFim, exercicio]);

  async function salvarNoHistorico() {
    if (!apuracao || !municipioId) return;

    // validações do formulário antes de gravar
    if (!exercicio || exercicio < 1900 || exercicio > 2999) {
      toast.error("Exercício inválido no arquivo. Verifique o retorno antes de salvar.");
      return;
    }
    if (competencia.mes !== null && (competencia.mes < 1 || competencia.mes > REMESSA_MAXIMA)) {
      toast.error("Remessa inválida (deve ser de 1 a 13). Verifique o nome do arquivo.");
      return;
    }
    if (competencia.ano !== null && (competencia.ano < 1900 || competencia.ano > 2999)) {
      toast.error("Ano de entrega inválido. Verifique o nome do arquivo.");
      return;
    }
    if (!periodo.inicio || !periodo.fim) {
      toast.error("Não foi possível determinar o período apurado. Verifique o arquivo.");
      return;
    }
    if (periodo.inicio > periodo.fim) {
      toast.error("Período inválido: a data inicial é posterior à final.");
      return;
    }

    try {
      const r = await salvarIndice.mutateAsync({
        municipioId,
        apuracao: { ...apuracao, periodoInicio: periodo.inicio, periodoFim: periodo.fim },
        exercicio,
        competenciaMes: competencia.mes,
        competenciaAno: competencia.ano,
        arquivoNome: arquivo?.name ?? registroHistorico?.arquivo_nome ?? null,
        planilha,
      });
      toast.success(
        r.substituido
          ? "Índice atualizado no histórico desta remessa."
          : "Índice salvo no histórico.",
      );
      if (periodo.corrigido) {
        toast.info(
          `Período ajustado automaticamente para 01/01/${exercicio} a 31/12/${exercicio}.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o índice.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Índice do VAF</h1>
          <p className="text-sm text-muted-foreground">
            Envie o arquivo de índices da SEF-MG (provisório ou definitivo) ou um retorno mensal —
            neste caso o sistema projeta o índice provisório para previsões.

          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNovaAnalise}>
            Nova análise
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-2 h-4 w-4" />
            {arquivo ? "Trocar arquivo" : "Selecionar arquivo"}
          </Button>
          <Button
            variant="outline"
            disabled={!mostrarRelatorio || !exercicio || salvarIndice.isPending}
            onClick={salvarNoHistorico}
          >
            {salvarIndice.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar no histórico
          </Button>
          <Button variant="outline" disabled={!apuracao} onClick={baixarCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button disabled={!apuracao} onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {mostrarRelatorio && periodo.corrigido && (
        <Alert className="no-print">
          <AlertTitle>Período do arquivo será ajustado</AlertTitle>
          <AlertDescription>
            O retorno não trouxe um período apurado válido
            {periodo.invalido ? " (data fora de faixa)" : ""}. Ao salvar no histórico, o período será
            corrigido automaticamente para 01/01/{exercicio} a 31/12/{exercicio}.
          </AlertDescription>
        </Alert>
      )}


      {mostrarRelatorio && exercicio && (
        <p className="no-print text-xs text-muted-foreground">
          Será salvo como exercício <span className="font-medium">{exercicio}</span> ·{" "}
          <span className="font-medium">
            {rotuloRemessa(competencia.mes)}
            <NotaRemessa className="ml-1" />
            {competencia.ano ? ` · entrega ${competencia.ano}` : ""}
          </span>{" "}
          · {apuracao?.estimado ? "projeção provisória" : `índice ${apuracao?.tipoIndice}`}.
        </p>
      )}


      {registroHistorico && (
        <Alert className="no-print">
          <AlertTitle className="flex flex-wrap items-center gap-2">
            Índice carregado do histórico
            <Badge variant={registroHistorico.tipo_indice === "definitivo" ? "default" : "secondary"}>
              {registroHistorico.tipo_indice === "definitivo"
                ? "Definitivo"
                : registroHistorico.estimado
                  ? "Projeção"
                  : "Provisório"}
            </Badge>
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Exercício {registroHistorico.exercicio} ·{" "}
              {rotuloRemessa(registroHistorico.competencia_mes)}
              {registroHistorico.competencia_ano ? ` · entrega ${registroHistorico.competencia_ano}` : ""} ·
              arquivo{" "}
              <span className="font-mono">{registroHistorico.arquivo_nome ?? "não informado"}</span>
              {registroHistorico.origem_credito_proprio === "planilha"
                ? ` · crédito próprio do Portal do VAF (${registroHistorico.arquivo_credito_proprio ?? "planilha"})`
                : ""}
              .
            </p>
            <p className="text-xs">
              Os valores consolidados vêm do registro salvo. O detalhamento por município e por
              contribuinte só aparece ao enviar novamente o arquivo de retorno.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRegistroHistorico(null);
                setPlanilha(null);
              }}
            >
              Limpar e voltar ao arquivo
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {arquivo && (
        <p className="no-print text-xs text-muted-foreground">
          Arquivo: <span className="font-mono">{arquivo.name}</span> ·{" "}
          {(arquivo.size / 1024 / 1024).toFixed(2)} MB
        </p>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo e apurando o arquivo…
        </div>
      )}

      {erro && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>Não foi possível apurar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {divergente && apuracao && (
        <Alert variant="destructive" className="no-print">
          <AlertTitle>Arquivo de outro município</AlertTitle>
          <AlertDescription>
            O arquivo é do município de código {apuracao.codigoMunicipio}, diferente da prefeitura
            ativa ({municipio?.codigo_sef} — {municipio?.nome}). Troque a prefeitura ativa para
            apurar este índice.
          </AlertDescription>
        </Alert>
      )}

      {!registroHistorico && apuracao?.estimado && (
        <Card className="no-print border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Projeção do índice provisório</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Este arquivo de retorno mensal não traz o registro de índice fechado pela SEF-MG
              (tipo 16/17). O sistema projeta o índice com os dados do próprio arquivo: créditos
              externos (registros 11/35), créditos e débitos entre municípios (12/13) — exatos — e
              VAF próprio somado das declarações (registro 10), que é a parte estimada. Use para
              previsão e estratégia, não como valor oficial.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vaf-estadual-ref">VAF estadual de referência (R$)</Label>
                <Input
                  id="vaf-estadual-ref"
                  inputMode="numeric"
                  placeholder="ex.: 925287575000"
                  value={vafEstadualRef}
                  onChange={(e) => setVafEstadualRef(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {apuracao.origemVafEstadual === "arquivo"
                    ? "O arquivo já informa o VAF estadual; a referência é ignorada."
                    : "Informe o VAF estadual do último índice definitivo para projetar o percentual."}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fator-calibragem">Fator de calibragem do VAF próprio</Label>
                <Input
                  id="fator-calibragem"
                  inputMode="decimal"
                  placeholder="1"
                  value={fator}
                  onChange={(e) => setFator(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Razão entre o VAF próprio do último definitivo e a soma declarada daquele ano
                  (ex.: 1,17). Mantenha 1 para não calibrar.
                </p>
              </div>
            </div>

            {/* Crédito próprio (AF/SIARE) — só vem nos definitivos */}
            <CreditoProprioPortal
              codigoSef={municipio?.codigo_sef ? String(municipio.codigo_sef) : ""}
              planilha={planilha}
              onPlanilha={setPlanilha}
              anoBaseArquivo={apuracao.anoBase}
              creditoInternoArquivo={apuracao.creditoInterno}
              perguntar={perguntar}
              onPerguntarChange={setPerguntar}
              contexto={arquivo ? `“${arquivo.name}”` : undefined}
              produtores={produtores}
              onProdutores={setProdutores}
            />

          </CardContent>
        </Card>
      )}

      {/* Índice definitivo/provisório: o crédito já vem do arquivo, só faltam os nomes */}
      {!registroHistorico && apuracao && !apuracao.estimado && (
        <div className="no-print">
          <CreditoProprioPortal
            codigoSef={municipio?.codigo_sef ? String(municipio.codigo_sef) : ""}
            planilha={planilha}
            onPlanilha={setPlanilha}
            anoBaseArquivo={apuracao.anoBase}
            creditoInternoArquivo={apuracao.creditoInterno}
            contexto={arquivo ? `“${arquivo.name}”` : undefined}
            creditoNoArquivo
            produtores={produtores}
            onProdutores={setProdutores}
          />
        </div>
      )}


      {apuracao && !apuracao.estimado && planilha && (
        <Alert className="no-print">
          <AlertTitle>Crédito próprio oficial mantido</AlertTitle>
          <AlertDescription>
            Este arquivo já traz o índice fechado da SEF-MG. Crédito próprio do arquivo:{" "}
            {formatarMoeda(apuracao.creditoProprio)} · planilha do Portal:{" "}
            {formatarMoeda(planilha.creditoProprio)} (diferença{" "}
            {formatarMoeda(planilha.creditoProprio - apuracao.creditoProprio)}).
          </AlertDescription>
        </Alert>
      )}


      {mostrarRelatorio && apuracao && (
        <div id="relatorio-indice" className="space-y-6">
          {/* Cabeçalho institucional */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {config?.estado ?? "Estado de Minas Gerais"}
                </p>
                <h2 className="font-display text-xl font-semibold">
                  {config?.nome_prefeitura || municipio?.nome || "Município"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Declaração Anual do Movimento Econômico Fiscal — Ano base{" "}
                  {apuracao.anoBase ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  VAF — Valor Adicionado Fiscal consolidado · Município {apuracao.codigoMunicipio}{" "}
                  {municipio?.nome ?? ""}
                </p>
              </div>
              <div className="text-right">
                <Badge
                  variant={apuracao.tipoIndice === "definitivo" ? "default" : "secondary"}
                  className="uppercase"
                >
                  {apuracao.estimado ? "Projeção · provisório" : `Índice ${apuracao.tipoIndice}`}
                </Badge>

                <p className="mt-2 text-xs text-muted-foreground">
                  Período: {formatarData(apuracao.periodoInicio)} a{" "}
                  {formatarData(apuracao.periodoFim)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Emitido em {new Date().toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <Kpi
              rotulo={
                apuracao.estimado
                  ? "Índice de participação - projetado"
                  : `Índice de participação - ${apuracao.tipoIndice}`
              }
              valor={formatarIndice(apuracao.indice)}
              detalhe={
                apuracao.estimado
                  ? "Projeção com base no retorno mensal — não oficial"
                  : "Participação percentual no VAF estadual"
              }
              destaque
              ajuda={
                <>
                  <p>
                    <strong>Índice</strong> = valor líquido do município ÷ VAF estadual × 100.
                  </p>
                  <p>
                    {apuracao.estimado
                      ? "Projeção estimada a partir do retorno mensal (registros 10/11/12/13/35/40); não substitui o índice oficial da SEF-MG."
                      : "Índice fechado pela SEF-MG (registro 16/17) presente no arquivo."}
                  </p>
                </>
              }
            />
            <Kpi
              rotulo={
                apuracao.estimado
                  ? "Valor líquido - projetado"
                  : "Valor líquido - apurado (VAF municipal)"
              }
              valor={formatarMoeda(apuracao.valorLiquido)}
              ajuda={
                <>
                  <p>
                    <strong>Valor líquido</strong> = VAF próprio + crédito externo (11/35) + crédito
                    interno (12) + crédito próprio − débito (13) + acerto de crédito − acerto de
                    débito.
                  </p>
                  <p>
                    {apuracao.estimado
                      ? "Estimado a partir do retorno mensal, com fator de calibragem aplicado ao VAF próprio."
                      : "Valor fechado no arquivo de índice da SEF-MG."}
                  </p>
                </>
              }
            />

            <Kpi
              rotulo="VAF estadual - referência"
              valor={formatarMoeda(apuracao.vafEstadual)}
              ajuda={
                <p>
                  Total do VAF do Estado usado como denominador do índice. Vem do arquivo quando há
                  índice fechado; na projeção usa a referência informada nos parâmetros.
                </p>
              }
            />
            <Kpi
              rotulo="Declarações - arquivo processado"
              valor={apuracao.totalDeclaracoes.toLocaleString("pt-BR")}
              detalhe={`${apuracao.creditosExternos.length} créditos externos · ${apuracao.simei.length} SIMEI`}
              ajuda={
                <p>
                  Quantidade de declarações de VAF lidas no arquivo, com o detalhe de créditos
                  externos (registros 11/35) e contribuintes SIMEI (registro 40).
                </p>
              }
            />

          </div>

          {/* Blocos VAF A / B / C */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base">VAF A</CardTitle>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Composição do VAF A"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-medium">Composição do VAF próprio</p>
                          {apuracao.vafProprioNormal !== undefined ? (
                            <>
                              <div className="flex justify-between gap-4">
                                <span>VAF A - 1 (regime normal)</span>
                                <span className="font-mono">
                                  {formatarMoeda(apuracao.vafProprioNormal ?? 0)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>VAF A - SN (Simples Nacional)</span>
                                <span className="font-mono">
                                  {formatarMoeda(apuracao.vafProprioSn ?? 0)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>SIMEI</span>
                                <span className="font-mono">
                                  {formatarMoeda(apuracao.vafProprioSimei ?? 0)}
                                </span>
                              </div>
                              {(apuracao.vafProprioNaoCompoe ?? 0) > 0 && (
                                <div className="flex justify-between gap-4">
                                  <span>VAF negativo (não compõe o índice)</span>
                                  <span className="font-mono">
                                    −{formatarMoeda(apuracao.vafProprioNaoCompoe ?? 0)}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-muted-foreground">
                              VAF próprio declarado (registro 07). VAF negativo não compõe o índice.
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Crédito externo: operações de entrada interestaduais (registros 11/35).
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="VAF próprio" valor={apuracao.vafProprio} />
                <LinhaValor rotulo="Crédito externo" valor={apuracao.creditoExterno} />

                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(apuracao.vafProprio + apuracao.creditoExterno)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base">VAF B</CardTitle>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Composição do VAF B"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-medium">Composição do VAF B</p>
                          <p>
                            <strong>Crédito interno:</strong> operações interestaduais com
                            outros municípios (registro 12).
                          </p>
                          <p>
                            <strong>Crédito próprio:</strong> AF/SIARE{" "}
                            {apuracao.origemCreditoProprio === "planilha"
                              ? `— origem: planilha do Portal do VAF${
                                  apuracao.arquivoCreditoProprio
                                    ? ` (${apuracao.arquivoCreditoProprio})`
                                    : ""
                                }`
                              : "— origem: arquivo de retorno da SEF-MG"}
                            .
                          </p>
                          <p>
                            <strong>Débito:</strong> saídas interestaduais (registro 13).
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="Crédito interno" valor={apuracao.creditoInterno} />
                <LinhaValor rotulo="Crédito próprio" valor={apuracao.creditoProprio} />
                <LinhaValor rotulo="Débito" valor={apuracao.debito} negativo />
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(
                      apuracao.creditoInterno + apuracao.creditoProprio - apuracao.debito,
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base">VAF C</CardTitle>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Composição do VAF C"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-medium">Composição do VAF C</p>
                          <p>
                            <strong>Acerto de crédito:</strong> ajuste de ofício aplicado pela
                            SEF-MG que aumenta o valor líquido.
                          </p>
                          <p>
                            <strong>Acerto de débito:</strong> ajuste de ofício aplicado pela
                            SEF-MG que reduz o valor líquido.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent>
                <LinhaValor rotulo="Acerto de crédito" valor={apuracao.acertoCredito} />
                <LinhaValor rotulo="Acerto de débito" valor={apuracao.acertoDebito} negativo />
                <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatarMoeda(apuracao.acertoCredito - apuracao.acertoDebito)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Memória de cálculo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" /> Memória de cálculo do valor líquido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LinhaValor rotulo="(+) VAF próprio" valor={apuracao.vafProprio} />
              <LinhaValor rotulo="(+) Crédito externo" valor={apuracao.creditoExterno} />
              <LinhaValor rotulo="(+) Crédito interno" valor={apuracao.creditoInterno} />
              <LinhaValor rotulo="(+) Crédito próprio" valor={apuracao.creditoProprio} />
              <LinhaValor rotulo="(−) Débito" valor={apuracao.debito} negativo />
              <LinhaValor rotulo="(+) Acerto de crédito" valor={apuracao.acertoCredito} />
              <LinhaValor rotulo="(−) Acerto de débito" valor={apuracao.acertoDebito} negativo />
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold">
                <span>= Valor líquido</span>
                <span className="font-mono">{formatarMoeda(apuracao.valorLiquido)}</span>
              </div>
              {conferencia && Math.abs(conferencia.diferenca) > 0.5 && (
                <p className="mt-2 text-xs text-destructive">
                  Divergência de {formatarMoeda(conferencia.diferenca)} entre a soma dos blocos e o
                  valor líquido informado no arquivo.
                </p>
              )}
              {conferencia && Math.abs(conferencia.diferenca) <= 0.5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Conferência dos blocos VAF A + B + C bate com o valor líquido do arquivo.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detalhamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhamento</CardTitle>
            </CardHeader>
            <CardContent>
              {carregandoDetalhe && (
                <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando o detalhamento salvo…
                </p>
              )}
              {registroHistorico && !carregandoDetalhe && !detalheHistorico && (
                <Alert className="mb-4">
                  <AlertTitle>Detalhamento não disponível</AlertTitle>
                  <AlertDescription className="space-y-2">
                    {podeRevalidar(registroHistorico, cargasRetorno) ? (
                      <p>
                        O arquivo de retorno deste índice está guardado no sistema. Clique em
                        "Revalidar detalhamento" para reconstruir as listas.
                      </p>
                    ) : (
                      <>
                        <p>
                          Este índice foi salvo antes da gravação do detalhamento e o arquivo de
                          origem não está guardado no sistema. Para regravar:
                        </p>
                        <ol className="list-decimal space-y-1 pl-5">
                          <li>
                            Selecione o arquivo de retorno
                            {registroHistorico.arquivo_nome
                              ? ` "${registroHistorico.arquivo_nome}"`
                              : " da SEF-MG"}{" "}
                            no campo acima.
                          </li>
                          {registroHistorico.origem_credito_proprio === "planilha" && (
                            <li>
                              Envie também a planilha do Portal do VAF
                              {registroHistorico.arquivo_credito_proprio
                                ? ` "${registroHistorico.arquivo_credito_proprio}"`
                                : ""}{" "}
                              — é a única forma de recompor a aba "Crédito próprio".
                            </li>
                          )}
                          <li>
                            Confirme exercício {registroHistorico.exercicio} ·{" "}
                            {rotuloRemessa(registroHistorico.competencia_mes)} e clique em "Salvar no
                            histórico": o registro é substituído, mantendo o mesmo índice.
                          </li>
                        </ol>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="no-print"
                      disabled={
                        revalidar.um.isPending || !podeRevalidar(registroHistorico, cargasRetorno)
                      }
                      onClick={() => revalidarRegistro(registroHistorico)}
                    >
                      {revalidar.um.isPending && (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      )}
                      Revalidar detalhamento
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <Tabs defaultValue="externos">
                <TabsList className="no-print">
                  <TabsTrigger value="externos">
                    Créditos externos ({apuracao.creditosExternos.length})
                  </TabsTrigger>
                  <TabsTrigger value="municipios">Entre municípios</TabsTrigger>
                  <TabsTrigger value="contribuintes">
                    VAF por contribuinte ({apuracao.contribuintesVaf.length})
                  </TabsTrigger>
                  <TabsTrigger value="simei">SIMEI ({apuracao.simei.length})</TabsTrigger>
                  {(planilha || apuracao.creditoProprio > 0) && (
                    <TabsTrigger value="proprio">
                      Crédito próprio
                      {planilha ? ` (${planilha.totalNotasProprio})` : ""}
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="externos" className="mt-4">
                  <TabelaContribuintes
                    linhas={apuracao.creditosExternos}
                    nomePorIe={nomePorIe}
                  />
                </TabsContent>

                <TabsContent value="municipios" className="mt-4 space-y-6">
                  <TabelaMunicipios
                    titulo="Créditos recebidos de outros municípios"
                    linhas={apuracao.creditosPorMunicipio}
                    nomePorCodigo={nomePorCodigo}
                  />
                  <TabelaMunicipios
                    titulo="Débitos transferidos a outros municípios"
                    linhas={apuracao.debitosPorMunicipio}
                    nomePorCodigo={nomePorCodigo}
                  />
                </TabsContent>

                <TabsContent value="contribuintes" className="mt-4">
                  <TabelaContribuintes
                    linhas={apuracao.contribuintesVaf.slice(0, 300)}
                    nomePorIe={nomePorIe}
                  />
                  {apuracao.contribuintesVaf.length > 300 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mostrando os 300 maiores. Use o CSV para a lista completa.
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="simei" className="mt-4">
                  <TabelaContribuintes linhas={apuracao.simei} />
                </TabsContent>

                {planilha && (
                  <TabsContent value="proprio" className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        Notas com <span className="font-medium">ENTRA</span> e{" "}
                        <span className="font-medium">Crédito próprio</span> na planilha{" "}
                        <span className="font-mono text-xs">{planilha.arquivoNome}</span>.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="no-print"
                        onClick={baixarCsvPlanilha}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar notas
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Tipo</TableHead>
                          <TableHead className="text-right">Notas</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planilha.porTipoNota.map((t) => (
                          <TableRow key={t.tipo}>
                            <TableCell>{t.tipo}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {t.quantidade.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatarMoeda(t.valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {planilha.totalNotasProprio.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarMoeda(planilha.creditoProprio)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>

                    <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                      <Input
                        className="w-full sm:max-w-xs"
                        placeholder="Buscar por remetente, IE, nota ou produto…"
                        value={buscaNotas}
                        onChange={(e) => setBuscaNotas(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {notasFiltradas.length.toLocaleString("pt-BR")} de{" "}
                        {planilha.notas.length.toLocaleString("pt-BR")} notas ·{" "}
                        <span className="font-medium text-foreground">
                          {formatarMoeda(totalFiltrado)}
                        </span>
                        {semNome > 0 &&
                          ` · ${semNome.toLocaleString("pt-BR")} sem nome de remetente`}
                      </p>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Tipo</TableHead>
                          <TableHead>Número / chave</TableHead>
                          <TableHead className="w-24">Saída</TableHead>
                          <TableHead>Remetente</TableHead>
                          <TableHead>Nome do remetente</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notasPagina.map((n, i) => (
                          <TableRow key={`${n.numero}-${i}`}>
                            <TableCell className="text-xs">{n.tipoNota}</TableCell>
                            <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                              {n.numero}
                            </TableCell>
                            <TableCell className="text-xs">{n.data ?? "—"}</TableCell>
                            <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                              {n.remetente}
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate">
                              {n.remetenteNome ?? nomePorIe(n.remetente) ?? "—"}
                            </TableCell>

                            <TableCell className="max-w-[18rem] truncate">{n.descricao}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatarMoeda(n.valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={6}>
                            Total {buscaNotas.trim() ? "do filtro" : "geral"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarMoeda(totalFiltrado)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>

                    <div className="flex flex-wrap items-center justify-between gap-2 no-print">
                      <p className="text-xs text-muted-foreground">
                        Página {paginaAtual} de {totalPaginas.toLocaleString("pt-BR")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={paginaAtual <= 1}
                          onClick={() => setPaginaNotas(paginaAtual - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={paginaAtual >= totalPaginas}
                          onClick={() => setPaginaNotas(paginaAtual + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>

                    {semNome > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Remetentes sem nome são estabelecimentos que não constam no relatório de
                        produtores rurais enviado (IE encerrada ou aberta depois da extração) —
                        quando outro estabelecimento do mesmo produtor está no relatório, o nome é
                        preenchido automaticamente pela raiz da inscrição estadual.
                      </p>
                    )}
                  </TabsContent>
                )}

                {!planilha && apuracao.creditoProprio > 0 && (
                  <TabsContent value="proprio" className="mt-4 space-y-4">
                    <Alert className="no-print">
                      <AlertTitle>Sem a lista de contribuintes neste arquivo</AlertTitle>
                      <AlertDescription>
                        O arquivo de retorno trouxe o crédito próprio apenas consolidado
                        (AF + SIARE = {formatarMoeda(apuracao.creditoProprio)}); a SEF-MG não
                        detalha as notas nele. Para ver os contribuintes, anexe abaixo, do Portal
                        do VAF:
                        <span className="mt-1 block font-mono text-xs">
                          REL_CREDITO_{(municipio?.nome ?? "MUNICIPIO").toUpperCase()}_….csv
                        </span>
                        <span className="block font-mono text-xs">
                          REL_PRODUTOR_RURAL_{(municipio?.nome ?? "MUNICIPIO").toUpperCase()}_….csv
                          (opcional — traz o nome dos remetentes)
                        </span>
                      </AlertDescription>
                    </Alert>

                    {/* carga do CSV sem sair da análise */}
                    <div className="no-print">
                      <CreditoProprioPortal
                        codigoSef={municipio?.codigo_sef ? String(municipio.codigo_sef) : ""}
                        planilha={planilha}
                        onPlanilha={setPlanilha}
                        anoBaseArquivo={apuracao.anoBase}
                        creditoInternoArquivo={apuracao.creditoInterno}
                        contexto={arquivo ? `“${arquivo.name}”` : undefined}
                        creditoNoArquivo
                        produtores={produtores}
                        onProdutores={setProdutores}
                      />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Crédito próprio — AF</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarMoeda(apuracao.creditoProprioAf)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Crédito próprio — SIARE</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarMoeda(apuracao.creditoProprioSiare)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarMoeda(apuracao.creditoProprio)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            {config?.endereco_rodape || ""}
          </p>
        </div>
      )}

      {!apuracao && !carregando && !erro && (
        <Card className="no-print border-dashed">
          <CardContent className="py-14 text-center">
            <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Selecione o arquivo de índices ou o retorno mensal (ex.:{" "}
              <span className="font-mono">P443RT…​.txt</span>) para apurar VAF A, VAF B, VAF C,
              valor líquido e índice.

            </p>
          </CardContent>
        </Card>
      )}

      <HistoricoIndices municipioId={municipioId} onCarregar={carregarDoHistorico} />

    </div>
  );
}
