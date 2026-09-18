import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardPaste, Download, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  baixarRelatorioCriterio,
  descobrirRelatoriosCriterio,
  gravarItensCriterio,
  gravarRankingCriterio,
  limparCriterio,
  registrarImportacao,
} from "@/lib/icms/criterios.functions";
import {
  gravarDadosConstitutivos,
  gravarRecursosEducacao,
  limparEducacao,
  salvarCalendarioEducacao,
} from "@/lib/icms/educacao.functions";
import { extrairTabelaCriterio } from "@/lib/icms/criterios/tabela";
import { useImportacoes, useItensReferencia, type FonteRelatorio } from "@/hooks/useCriterios";
import type { Pipeline } from "@/lib/icms/criterios/pipelines";

type Resumo = {
  municipios: number;
  ranking: number;
  itens: number;
  naoMapeados: string[];
  cabecalho: string[];
};

export function IngestaoCriterio({ pipeline }: { pipeline: Pipeline }) {
  const cliente = useQueryClient();
  const { data: referencia } = useItensReferencia(pipeline.slug);
  const { data: importacoes } = useImportacoes(pipeline.slug);
  const jaImportados = new Set((importacoes ?? []).map((i) => i.url).filter(Boolean) as string[]);

  const descobrir = useServerFn(descobrirRelatoriosCriterio);
  const baixar = useServerFn(baixarRelatorioCriterio);
  const limpar = useServerFn(limparCriterio);
  const gravarRanking = useServerFn(gravarRankingCriterio);
  const gravarItens = useServerFn(gravarItensCriterio);
  const registrar = useServerFn(registrarImportacao);
  const limparEdu = useServerFn(limparEducacao);
  const gravarDados = useServerFn(gravarDadosConstitutivos);
  const gravarRecursos = useServerFn(gravarRecursosEducacao);
  const salvarCalendario = useServerFn(salvarCalendarioEducacao);
  const planilha = pipeline.formato === "planilha";

  const [anoBase, setAnoBase] = useState<number>(
    planilha ? new Date().getFullYear() + 1 : new Date().getFullYear() - 2,
  );
  const [fonte, setFonte] = useState<FonteRelatorio>("definitivo");
  const [url, setUrl] = useState("");
  const [texto, setTexto] = useState("");

  const [links, setLinks] = useState<
    { url: string; texto: string; tipo: string; ano: number | null }[]
  >([]);

  const [diagnostico, setDiagnostico] = useState<
    { pagina: string; situacao: string; encontrados: number }[]
  >([]);
  const [buscando, setBuscando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  async function buscarLinks() {
    setBuscando(true);
    try {
      const r = await descobrir({ data: { criterio: pipeline.slug, anoBase } });
      setLinks(r.relatorios);
      setDiagnostico(r.diagnostico ?? []);
      if (!r.relatorios.length) toast.info("Nenhum relatório localizado. Cole o endereço do PDF.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o site.");
    } finally {
      setBuscando(false);
    }
  }

  async function gravarResultado(
    paginas: import("@/lib/icms/esportes/parser").PaginaTexto[],
    origem: "site" | "url" | "arquivo" | "colado",
    identificacao: string | null,
    anoForcado?: number,
  ) {
    let ano = anoForcado ?? anoBase;
    let fonteUso: FonteRelatorio = fonte;
    let divergencias: { municipio: string; esperado: number; obtido: number }[] = [];
    setEtapa("Casando as colunas com os itens do critério");
    // Cada órgão publica em um formato: o ICMS Turismo traz um quadro único com
    // circuito, nota, RLPC, IRC, IIT e índice; o ICMS Ecológico traz vários
    // quadros (saneamento, unidades de conservação, fator de qualidade e
    // índice) em uma mesma publicação.
    let r = extrairTabelaCriterio(paginas, referencia ?? [], pipeline.colunasTotal);
    const ecologico = pipeline.slug === "meio_ambiente" || pipeline.slug === "meio-ambiente";
    if (pipeline.slug === "turismo") {
      const { extrairTurismo } = await import("@/lib/icms/criterios/turismo");
      const t = extrairTurismo(paginas);
      if (t.ranking.length) r = t;
    }
    if (ecologico && !r.itens.length) {
      const { extrairIcmsEcologico } = await import("@/lib/icms/criterios/ecologico");
      const e = extrairIcmsEcologico(paginas);
      if (e.itens.length) r = e;
    }
    // Patrimônio Cultural: o quadro do IEPHA tem 27 colunas e quase todas as
    // células vazias, então a leitura é posicional e traz o exercício e se a
    // pontuação é provisória ou definitiva no próprio cabeçalho.
    if (pipeline.slug === "patrimonio_cultural") {
      const { ehRelatorioIepha, extrairPatrimonioCultural } =
        await import("@/lib/icms/criterios/patrimonio");
      if (ehRelatorioIepha(paginas)) {
        const p = extrairPatrimonioCultural(paginas);
        if (p.ranking.length) {
          r = p;
          divergencias = p.divergencias;
          if (!anoForcado && p.exercicio) ano = p.exercicio;
          if (p.definitiva !== null) fonteUso = p.definitiva ? "definitivo" : "preliminar";
        }
      }
    }

    if (!r.itens.length && !r.ranking.length) {
      throw new Error(
        "Não foi possível reconhecer a tabela deste relatório. Confira se o conteúdo é o quadro de pontuação por município.",
      );
    }

    setEtapa("Gravando");
    // No Meio Ambiente as publicações se complementam, então uma não apaga a
    // outra; nos demais critérios o relatório novo substitui o anterior.
    if (!ecologico)
      await limpar({ data: { criterio: pipeline.slug, anoBase: ano, fonte: fonteUso } });

    for (let i = 0; i < r.ranking.length; i += 300) {
      await gravarRanking({
        data: {
          criterio: pipeline.slug,
          anoBase: ano,
          fonte: fonteUso,
          linhas: r.ranking.slice(i, i + 300),
        },
      });
      setProgresso(70 + Math.round(((i + 300) / Math.max(r.ranking.length, 1)) * 10));
    }
    for (let i = 0; i < r.itens.length; i += 150) {
      await gravarItens({
        data: {
          criterio: pipeline.slug,
          anoBase: ano,
          fonte: fonteUso,
          itens: r.itens.slice(i, i + 150),
        },
      });
      setProgresso(80 + Math.round(((i + 150) / Math.max(r.itens.length, 1)) * 20));
    }

    const municipios = new Set(r.itens.map((i) => i.municipio)).size;
    await registrar({
      data: {
        criterio: pipeline.slug,
        anoBase: ano,
        fonte: fonteUso,
        origem,
        url: origem === "url" || origem === "site" ? identificacao : null,
        arquivoNome: origem === "url" || origem === "site" ? null : identificacao,
        paginas: paginas.length,
        registrosRanking: r.ranking.length,
        registrosItens: r.itens.length,
        municipios,
        naoMapeados: r.naoMapeados,
        divergencias,
      },
    });

    setResumo({
      municipios,
      ranking: r.ranking.length,
      itens: r.itens.length,
      naoMapeados: r.naoMapeados,
      cabecalho: r.cabecalho,
    });
    setProgresso(100);
    await cliente.invalidateQueries({ queryKey: ["criterio-anos"] });
    await cliente.invalidateQueries({ queryKey: ["criterio-ranking"] });
    await cliente.invalidateQueries({ queryKey: ["criterio-itens"] });
    await cliente.invalidateQueries({ queryKey: ["criterio-importacoes"] });
    toast.success("Relatório importado.");
  }

  /**
   * O arquivo é reconhecido pelo conteúdo, não pela extensão: todo critério
   * aceita tanto o PDF quanto a planilha oficial. A planilha da Educação tem
   * leitura própria (abas de dados constitutivos, recursos e nota técnica);
   * nos demais critérios a planilha é convertida em linhas e segue pelo mesmo
   * caminho do PDF.
   */
  async function processar(
    dados: Uint8Array,
    origem: "site" | "url" | "arquivo",
    identificacao: string | null,
    anoForcado?: number,
  ) {
    const { ehPdf } = await import("@/lib/icms/criterios/planilhaTabela");
    const pdf = ehPdf(dados);
    if (planilha && !pdf) {
      await processarPlanilha(dados, origem, identificacao, anoForcado);
      return;
    }
    setRodando(true);
    setResumo(null);
    try {
      let paginas: import("@/lib/icms/esportes/parser").PaginaTexto[];
      if (pdf) {
        const { extrairPaginas } = await import("@/lib/icms/esportes/pdf");
        setEtapa("Lendo o PDF");
        paginas = await extrairPaginas(dados, (p, total) =>
          setProgresso(Math.round((p / total) * 70)),
        );
      } else {
        setEtapa("Lendo a planilha");
        setProgresso(40);
        const { paginasDaPlanilha } = await import("@/lib/icms/criterios/planilhaTabela");
        const p = paginasDaPlanilha(dados);
        if (!p.paginas.length) throw new Error("A planilha enviada está vazia.");
        paginas = p.paginas;
        setProgresso(70);
      }
      await gravarResultado(paginas, origem, identificacao, anoForcado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o relatório.");
    } finally {
      setRodando(false);
      setEtapa("");
    }
  }

  /**
   * Educação: a FJP publica uma planilha com várias abas (índices calculados,
   * dados constitutivos, dicionário, recursos e nota técnica). O ranking e os
   * quatro componentes vão para as tabelas comuns dos critérios; os números
   * brutos, os recursos e a nota técnica têm tabelas próprias.
   */
  async function processarPlanilha(
    dados: Uint8Array,
    origem: "site" | "url" | "arquivo",
    identificacao: string | null,
    anoForcado?: number,
  ) {
    const ano = anoForcado ?? anoBase;
    const versao = fonte === "definitivo" ? "definitivo" : "provisorio";
    setRodando(true);
    setResumo(null);
    try {
      setEtapa("Lendo a planilha");
      setProgresso(15);
      const { extrairEducacao, somaIndices } = await import("@/lib/icms/criterios/educacao");
      const r = extrairEducacao(dados);
      if (!r.ranking.length) {
        throw new Error(
          "Não foi possível reconhecer a planilha. Confira se é o arquivo dos índices de Educação publicado pela FJP.",
        );
      }

      setEtapa("Gravando os índices");
      setProgresso(35);
      await limpar({ data: { criterio: pipeline.slug, anoBase: ano, fonte } });
      await limparEdu({ data: { exercicio: ano, fonteVersao: versao } });

      for (let i = 0; i < r.ranking.length; i += 300) {
        await gravarRanking({
          data: {
            criterio: pipeline.slug,
            anoBase: ano,
            fonte,
            linhas: r.ranking.slice(i, i + 300),
          },
        });
      }
      setProgresso(50);
      for (let i = 0; i < r.itens.length; i += 150) {
        await gravarItens({
          data: { criterio: pipeline.slug, anoBase: ano, fonte, itens: r.itens.slice(i, i + 150) },
        });
      }

      setEtapa("Gravando os dados constitutivos");
      for (let i = 0; i < r.dadosConstitutivos.length; i += 2000) {
        await gravarDados({
          data: {
            exercicio: ano,
            fonteVersao: versao,
            linhas: r.dadosConstitutivos.slice(i, i + 2000),
          },
        });
        setProgresso(50 + Math.round(((i + 2000) / Math.max(r.dadosConstitutivos.length, 1)) * 35));
      }

      if (r.recursos.length) {
        setEtapa("Gravando os recursos administrativos");
        for (let i = 0; i < r.recursos.length; i += 500) {
          await gravarRecursos({
            data: { exercicio: ano, fonteVersao: versao, linhas: r.recursos.slice(i, i + 500) },
          });
        }
      }

      await salvarCalendario({
        data: {
          exercicio: ano,
          notaTecnica: r.notaTecnica,
          resolucaoReferencia: r.resolucao,
          ...(versao === "provisorio"
            ? {
                dataPublicacaoProvisorio: new Date().toISOString().slice(0, 10),
                // A FJP dá cerca de 15 dias para recurso; a data pode ser
                // corrigida na aba "Prazo de recurso".
                dataLimiteRecurso: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
              }
            : { dataPublicacaoDefinitivo: new Date().toISOString().slice(0, 10) }),
        },
      });

      const soma = somaIndices(r.ranking);
      const municipios = new Set(r.ranking.map((l) => l.municipio)).size;
      await registrar({
        data: {
          criterio: pipeline.slug,
          anoBase: ano,
          fonte,
          origem,
          url: origem === "url" || origem === "site" ? identificacao : null,
          arquivoNome: origem === "arquivo" ? identificacao : null,
          paginas: 0,
          registrosRanking: r.ranking.length,
          registrosItens: r.itens.length + r.dadosConstitutivos.length,
          municipios,
          naoMapeados: r.naoMapeados.slice(0, 500),
          divergencias: r.divergencias.slice(0, 500),
        },
      });

      setResumo({
        municipios,
        ranking: r.ranking.length,
        itens: r.itens.length + r.dadosConstitutivos.length,
        naoMapeados: r.naoMapeados,
        cabecalho: r.cabecalho,
      });
      setProgresso(100);
      for (const chave of [
        "criterio-anos",
        "criterio-ranking",
        "criterio-itens",
        "criterio-importacoes",
        "criterios-com-dados",
        "educacao-dados",
        "educacao-recursos",
        "educacao-calendario",
      ]) {
        await cliente.invalidateQueries({ queryKey: [chave] });
      }
      if (Math.abs(soma - 100) > 1) {
        toast.warning(
          `Planilha importada, mas a soma dos índices deu ${soma.toFixed(4)} — o esperado é 100. Confira se faltou alguma linha.`,
        );
      } else {
        toast.success("Planilha da Educação importada.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar a planilha.");
    } finally {
      setRodando(false);
      setEtapa("");
    }
  }

  async function processarColado() {
    if (texto.trim().length < 40) {
      toast.error("Cole o conteúdo do quadro de pontuação (cabeçalho e linhas dos municípios).");
      return;
    }
    setRodando(true);
    setResumo(null);
    setProgresso(20);
    try {
      setEtapa("Lendo o conteúdo colado");
      const { paginasDoTextoColado } = await import("@/lib/icms/criterios/colado");
      const { paginas, linhas } = paginasDoTextoColado(texto);
      setProgresso(60);
      await gravarResultado(paginas, "colado", `texto colado (${linhas} linhas)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o conteúdo colado.");
    } finally {
      setRodando(false);
      setEtapa("");
    }
  }

  async function importarUrl(endereco: string, origem: "site" | "url", anoForcado?: number) {
    if (!endereco.trim()) {
      toast.error("Informe o endereço do PDF.");
      return;
    }
    setRodando(true);
    setEtapa("Baixando o relatório");
    try {
      const r = await baixar({ data: { criterio: pipeline.slug, url: endereco.trim() } });
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await processar(bytes, origem, endereco.trim(), anoForcado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar o relatório.");
      setRodando(false);
      setEtapa("");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar relatório de {pipeline.nome}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fonte oficial: {pipeline.orgao}. {pipeline.comoFunciona}
          </p>
          {pipeline.aviso && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
              {pipeline.aviso}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{planilha ? "Exercício do repasse" : "Ano-base"}</Label>
              <Input
                type="number"
                value={anoBase}
                onChange={(e) => setAnoBase(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo do relatório</Label>
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteRelatorio)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preliminar">
                    {planilha ? "Provisório" : "Preliminar"}
                  </SelectItem>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={buscarLinks} disabled={buscando || rodando}>
              {buscando ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Search className="mr-2 size-4" />
              )}
              Procurar relatórios no site
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept={planilha ? ".xlsx,.xls" : "application/pdf"}
                className="hidden"
                disabled={rodando}
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0];
                  if (!arquivo) return;
                  const buffer = new Uint8Array(await arquivo.arrayBuffer());
                  await processar(buffer, "arquivo", arquivo.name);
                  e.target.value = "";
                }}
              />
              <Button asChild variant="outline" disabled={rodando}>
                <span>
                  <Upload className="mr-2 size-4" />
                  {planilha ? "Enviar planilha do computador" : "Enviar PDF do computador"}
                </span>
              </Button>
            </label>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder={
                planilha
                  ? "Cole aqui o endereço da planilha publicada pela FJP"
                  : "Cole aqui o endereço do PDF publicado pelo órgão"
              }
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={() => importarUrl(url, "url")} disabled={rodando}>
              <Download className="mr-2 size-4" />
              Importar
            </Button>
          </div>

          {!planilha && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Colar o quadro de pontuação</Label>
              <p className="text-xs text-muted-foreground">
                Se o relatório não abrir ou vier só em papel/Diário Oficial, copie o quadro (do PDF,
                do Excel ou de uma tabela do site) e cole aqui. A primeira linha deve ser o
                cabeçalho com os nomes das colunas e as demais uma linha por município.
              </p>
              <Textarea
                rows={8}
                className="font-mono text-xs"
                placeholder={
                  "Município\tÓrgão municipal\tConselho\tFundo\tPontuação\nABRE CAMPO\tSim\tSim\tNão\t12,50"
                }
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={processarColado} disabled={rodando}>
                  <ClipboardPaste className="mr-2 size-4" />
                  Importar o que foi colado
                </Button>
                <Button variant="ghost" onClick={() => setTexto("")} disabled={rodando || !texto}>
                  Limpar
                </Button>
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              {links.map((l) => {
                const importado = jaImportados.has(l.url);
                return (
                  <div key={l.url} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">
                      <Badge variant="outline" className="mr-2">
                        {l.tipo}
                      </Badge>
                      {l.texto}
                      {l.ano ? (
                        <span className="ml-2 text-xs text-muted-foreground">ano-base {l.ano}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {importado && (
                        <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
                          Importado
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={rodando}
                        onClick={() => {
                          if (l.ano) setAnoBase(l.ano);
                          void importarUrl(l.url, "site", l.ano ?? undefined);
                        }}
                      >
                        {importado ? "Importar de novo" : "Importar"}
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {links.length === 0 && diagnostico.length > 0 && (
            <div className="space-y-1 rounded-md border p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Páginas consultadas</p>
              {diagnostico.map((d) => (
                <p key={d.pagina} className="truncate">
                  {d.pagina} — {d.situacao} ({d.encontrados} relatórios)
                </p>
              ))}
            </div>
          )}

          {rodando && (
            <div className="space-y-2">
              <Progress value={progresso} />
              <p className="text-xs text-muted-foreground">{etapa}…</p>
            </div>
          )}

          {resumo && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>
                {resumo.municipios} municípios, {resumo.ranking} linhas de pontuação e{" "}
                {resumo.itens} itens gravados.
              </p>
              {resumo.cabecalho.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Colunas lidas: {resumo.cabecalho.join(" · ")}
                </p>
              )}
              {resumo.naoMapeados.length > 0 && (
                <div>
                  <p className="font-medium">Colunas sem item correspondente:</p>
                  <p className="text-xs text-muted-foreground">{resumo.naoMapeados.join(" · ")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
