import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PIPELINES, type Pipeline } from "@/lib/icms/criterios/pipelines";
import {
  bytesDeBase64,
  escolherRelatorio,
  interpretarPaginas,
  type RelatorioEncontrado,
} from "@/lib/icms/criterios/sincronizar";
import {
  baixarRelatorioCriterio,
  descobrirRelatoriosCriterio,
  gravarItensCriterio,
  gravarRankingCriterio,
  limparCriterio,
  registrarImportacao,
} from "@/lib/icms/criterios.functions";
import {
  baixarRelatorioEsportes,
  descobrirRelatoriosEsportes,
  gravarAtividadesEsportes,
  gravarRankingEsportes,
  limparEsportes,
} from "@/lib/icms/esportes.functions";
import { extrairBlocos, extrairRanking, mapearAtividade } from "@/lib/icms/esportes/parser";
import type { ItemReferencia } from "@/lib/icms/criterios/tabela";
import type { FonteRelatorio } from "@/hooks/useCriterios";

type Situacao = "parado" | "procurando" | "baixando" | "lendo" | "gravando" | "ok" | "falha";

type Estado = {
  situacao: Situacao;
  mensagem: string;
  progresso: number;
  links: RelatorioEncontrado[];
  urlManual: string;
};

const INICIAL: Estado = {
  situacao: "parado",
  mensagem: "",
  progresso: 0,
  links: [],
  urlManual: "",
};

/** O que já está gravado hoje em cada critério (ano, tipo e nº de municípios). */
function useCobertura() {
  return useQuery({
    queryKey: ["criterio-cobertura"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const mapa: Record<string, { ano: number; fonte: string; municipios: number }> = {};
      for (const p of PIPELINES) {
        const esportes = p.slug === "esportes";
        const tabela = esportes ? "esportes_ranking_municipio" : "criterio_ranking_municipio";
        const base = supabase.from(tabela) as unknown as {
          select: (
            colunas: string,
            opcoes?: { count: "exact"; head: boolean },
          ) => PromiseLike<{ data: unknown[] | null; count: number | null }> & {
            eq: (coluna: string, valor: string | number) => ReturnType<typeof base.select>;
            order: (
              coluna: string,
              opcoes: { ascending: boolean },
            ) => ReturnType<typeof base.select>;
            limit: (n: number) => ReturnType<typeof base.select>;
          };
        };
        let consulta = base
          .select("ano_base, fonte_relatorio")
          .order("ano_base", { ascending: false })
          .limit(1);
        if (!esportes) consulta = consulta.eq("criterio", p.slug);
        const { data } = await consulta;
        const topo = data?.[0] as { ano_base: number; fonte_relatorio: string } | undefined;
        if (!topo) continue;
        let contagem = base
          .select("municipio", { count: "exact", head: true })
          .eq("ano_base", topo.ano_base)
          .eq("fonte_relatorio", topo.fonte_relatorio);
        if (!esportes) contagem = contagem.eq("criterio", p.slug);
        const { count } = await contagem;
        mapa[p.slug] = {
          ano: topo.ano_base,
          fonte: topo.fonte_relatorio,
          municipios: count ?? 0,
        };
      }
      return mapa;
    },
  });
}

export function SincronizacaoOficial() {
  const cliente = useQueryClient();
  const { data: cobertura } = useCobertura();

  const descobrir = useServerFn(descobrirRelatoriosCriterio);
  const baixar = useServerFn(baixarRelatorioCriterio);
  const limpar = useServerFn(limparCriterio);
  const gravarRanking = useServerFn(gravarRankingCriterio);
  const gravarItens = useServerFn(gravarItensCriterio);
  const registrar = useServerFn(registrarImportacao);
  const descobrirEsp = useServerFn(descobrirRelatoriosEsportes);
  const baixarEsp = useServerFn(baixarRelatorioEsportes);
  const limparEsp = useServerFn(limparEsportes);
  const gravarRankingEsp = useServerFn(gravarRankingEsportes);
  const gravarAtividadesEsp = useServerFn(gravarAtividadesEsportes);

  const [anoBase, setAnoBase] = useState<number>(new Date().getFullYear() - 1);
  const [fonte, setFonte] = useState<FonteRelatorio>("definitivo");
  const [tudoRodando, setTudoRodando] = useState(false);
  const [estados, setEstados] = useState<Record<string, Estado>>(() =>
    Object.fromEntries(PIPELINES.map((p) => [p.slug, INICIAL])),
  );

  const mudar = useCallback((slug: string, parcial: Partial<Estado>) => {
    setEstados((atual) => ({ ...atual, [slug]: { ...(atual[slug] ?? INICIAL), ...parcial } }));
  }, []);

  async function atualizarTelas() {
    for (const chave of [
      "criterio-anos",
      "criterio-ranking",
      "criterio-ranking-todos",
      "criterio-itens",
      "criterio-itens-varios",
      "criterio-potencial",
      "criterio-importacoes",
      "criterios-com-dados",
      "criterio-cobertura",
      "esportes-anos",
      "esportes-ranking",
      "esportes-atividades",
    ]) {
      await cliente.invalidateQueries({ queryKey: [chave] });
    }
  }

  async function referenciaDe(slug: string): Promise<ItemReferencia[]> {
    const { data, error } = await supabase
      .from("criterio_itens_referencia")
      .select("codigo, nome_oficial, sinonimos, peso, requisito, ordem")
      .eq("criterio", slug)
      .order("ordem");
    if (error) throw error;
    return (data ?? []) as unknown as ItemReferencia[];
  }

  /** Lê os bytes do arquivo oficial e grava o ranking do critério. */
  async function carregar(
    pipeline: Pipeline,
    dados: Uint8Array,
    origem: "site" | "url" | "arquivo",
    identificacao: string | null,
  ) {
    const slug = pipeline.slug;
    mudar(slug, { situacao: "lendo", mensagem: "Lendo a tabela oficial", progresso: 45 });

    const { ehPdf, paginasDaPlanilha } = await import("@/lib/icms/criterios/planilhaTabela");
    let paginas: import("@/lib/icms/esportes/parser").PaginaTexto[];
    if (ehPdf(dados)) {
      const { extrairPaginas } = await import("@/lib/icms/esportes/pdf");
      paginas = await extrairPaginas(dados, (p, total) =>
        mudar(slug, { progresso: 20 + Math.round((p / total) * 40) }),
      );
    } else if (pipeline.formato === "planilha") {
      const { extrairEducacao } = await import("@/lib/icms/criterios/educacao");
      const r = extrairEducacao(dados);
      if (!r.ranking.length) throw new Error("A planilha não traz o quadro de índices esperado.");
      await gravarPadrao(
        pipeline,
        anoBase,
        fonte,
        r.ranking,
        r.itens,
        r.naoMapeados,
        [],
        origem,
        identificacao,
        0,
      );
      return;
    } else {
      const p = paginasDaPlanilha(dados);
      if (!p.paginas.length) throw new Error("A planilha oficial veio vazia.");
      paginas = p.paginas;
    }

    if (slug === "esportes") {
      await gravarEsportes(paginas, origem, identificacao);
      return;
    }

    const referencia = await referenciaDe(slug);
    const leitura = await interpretarPaginas(pipeline, referencia, paginas);
    if (!leitura.ranking.length && !leitura.itens.length) {
      throw new Error("O arquivo baixado não traz o quadro de pontuação por município.");
    }
    await gravarPadrao(
      pipeline,
      leitura.ano ?? anoBase,
      leitura.fonte ?? fonte,
      leitura.ranking,
      leitura.itens,
      leitura.naoMapeados,
      leitura.divergencias,
      origem,
      identificacao,
      paginas.length,
    );
  }

  async function gravarPadrao(
    pipeline: Pipeline,
    ano: number,
    fonteUso: FonteRelatorio,
    ranking: Awaited<ReturnType<typeof interpretarPaginas>>["ranking"],
    itens: Awaited<ReturnType<typeof interpretarPaginas>>["itens"],
    naoMapeados: string[],
    divergencias: { municipio: string; esperado: number; obtido: number }[],
    origem: "site" | "url" | "arquivo",
    identificacao: string | null,
    paginas: number,
  ) {
    const slug = pipeline.slug;
    mudar(slug, { situacao: "gravando", mensagem: "Atualizando o ranking", progresso: 70 });
    const ecologico = slug === "meio_ambiente";
    if (!ecologico) await limpar({ data: { criterio: slug, anoBase: ano, fonte: fonteUso } });

    for (let i = 0; i < ranking.length; i += 300) {
      await gravarRanking({
        data: { criterio: slug, anoBase: ano, fonte: fonteUso, linhas: ranking.slice(i, i + 300) },
      });
      mudar(slug, { progresso: 70 + Math.round(((i + 300) / Math.max(ranking.length, 1)) * 10) });
    }
    for (let i = 0; i < itens.length; i += 150) {
      await gravarItens({
        data: { criterio: slug, anoBase: ano, fonte: fonteUso, itens: itens.slice(i, i + 150) },
      });
      mudar(slug, { progresso: 80 + Math.round(((i + 150) / Math.max(itens.length, 1)) * 18) });
    }

    const municipios = new Set([
      ...ranking.map((r) => r.municipio),
      ...itens.map((i) => i.municipio),
    ]).size;
    try {
      await registrar({
        data: {
          criterio: slug,
          anoBase: ano,
          fonte: fonteUso,
          origem,
          url: origem === "arquivo" ? null : identificacao,
          arquivoNome: origem === "arquivo" ? identificacao : null,
          paginas,
          registrosRanking: ranking.length,
          registrosItens: itens.length,
          municipios,
          naoMapeados: naoMapeados.slice(0, 500),
          divergencias: divergencias.slice(0, 500),
        },
      });
    } catch {
      // o histórico é informativo; não interrompe a sincronização
    }

    mudar(slug, {
      situacao: "ok",
      progresso: 100,
      mensagem: `${municipios} municípios atualizados — exercício ${ano}, ${fonteUso === "definitivo" ? "definitivo" : "preliminar"}.`,
    });
    await atualizarTelas();
  }

  async function gravarEsportes(
    paginas: import("@/lib/icms/esportes/parser").PaginaTexto[],
    origem: "site" | "url" | "arquivo",
    identificacao: string | null,
  ) {
    mudar("esportes", { situacao: "gravando", mensagem: "Atualizando o ranking", progresso: 70 });
    const { data: ref } = await supabase
      .from("esportes_atividades_referencia")
      .select("codigo, nome_oficial, sinonimos, peso, requisito, ordem")
      .order("ordem");
    const ranking = extrairRanking(paginas);
    const blocos = extrairBlocos(paginas.flatMap((p) => p.linhas.map((l) => l.texto)));
    const naoMapeadas = new Set<string>();
    const itens = blocos.map((b) => {
      const mapa = mapearAtividade(b.atividadeNome, (ref ?? []) as never);
      if (!mapa) naoMapeadas.add(b.atividadeNome);
      return {
        municipio: b.municipio,
        municipioNome: b.municipioNome,
        atividadeNome: b.atividadeNome,
        atividadeCodigo: mapa?.codigo ?? null,
        pesoAnexoV: mapa ? Number(mapa.peso) : null,
        pesoAtividade: b.pesoAtividade,
        pesoRcl: b.pesoRcl,
        pontuacaoAtletas: b.pontuacaoAtletas,
        pontuacaoModalidades: b.pontuacaoModalidades,
        pontuacao: b.pontuacao,
        eventosTexto: b.eventosTexto.slice(0, 20000),
        qtdEventos: b.qtdEventos,
        totalParticipantes: b.totalParticipantes,
        modalidadesTexto: b.modalidadesTexto.slice(0, 8000),
      };
    });
    if (!ranking.length && !itens.length) {
      throw new Error("O arquivo baixado não é o relatório do Critério Esportes.");
    }
    await limparEsp({ data: { anoBase, fonte } });
    for (let i = 0; i < ranking.length; i += 300) {
      await gravarRankingEsp({ data: { anoBase, fonte, linhas: ranking.slice(i, i + 300) } });
    }
    for (let i = 0; i < itens.length; i += 150) {
      await gravarAtividadesEsp({ data: { anoBase, fonte, itens: itens.slice(i, i + 150) } });
    }
    try {
      await registrar({
        data: {
          criterio: "esportes",
          anoBase,
          fonte,
          origem,
          url: origem === "arquivo" ? null : identificacao,
          arquivoNome: origem === "arquivo" ? identificacao : null,
          paginas: paginas.length,
          registrosRanking: ranking.length,
          registrosItens: itens.length,
          municipios: new Set(itens.map((i) => i.municipio)).size,
          naoMapeados: [...naoMapeadas].slice(0, 500),
          divergencias: [],
        },
      });
    } catch {
      // histórico informativo
    }
    mudar("esportes", {
      situacao: "ok",
      progresso: 100,
      mensagem: `${ranking.length} municípios no ranking e ${itens.length} atividades — exercício ${anoBase}.`,
    });
    await atualizarTelas();
  }

  /** Busca no site oficial, baixa e grava — sem arrastar arquivo nenhum. */
  async function sincronizar(pipeline: Pipeline) {
    const slug = pipeline.slug;
    mudar(slug, {
      situacao: "procurando",
      mensagem: `Procurando a tabela oficial em ${pipeline.orgao}`,
      progresso: 8,
      links: [],
    });
    try {
      const achados: RelatorioEncontrado[] =
        slug === "esportes"
          ? (await descobrirEsp({ data: undefined as never })).relatorios.map((r) => ({
              url: r.url,
              texto: r.texto,
              tipo: r.tipo,
              ano: Number(r.texto.match(/(20\d{2})/)?.[1] ?? "") || null,
            }))
          : (await descobrir({ data: { criterio: slug, anoBase } })).relatorios;

      const escolhido = escolherRelatorio(achados, anoBase, fonte);
      if (!escolhido) {
        mudar(slug, {
          situacao: "falha",
          progresso: 0,
          links: achados,
          mensagem:
            "O site oficial não respondeu à leitura automática. Cole o endereço da publicação ou envie o arquivo abaixo.",
        });
        return;
      }

      mudar(slug, {
        situacao: "baixando",
        mensagem: `Baixando: ${escolhido.texto}`,
        progresso: 20,
        links: achados,
      });
      const baixado =
        slug === "esportes"
          ? await baixarEsp({ data: { url: escolhido.url } })
          : await baixar({ data: { criterio: slug, url: escolhido.url } });
      await carregar(pipeline, bytesDeBase64(baixado.base64), "site", escolhido.url);
    } catch (e) {
      mudar(slug, {
        situacao: "falha",
        progresso: 0,
        mensagem:
          e instanceof Error
            ? e.message
            : "Não foi possível ler a tabela oficial automaticamente agora.",
      });
    }
  }

  async function sincronizarTudo() {
    setTudoRodando(true);
    for (const p of PIPELINES) {
      await sincronizar(p);
    }
    setTudoRodando(false);
    toast.success("Sincronização concluída. Os rankings já estão atualizados.");
  }

  async function usarEndereco(pipeline: Pipeline, endereco: string) {
    if (!endereco.trim()) {
      toast.error("Cole o endereço da publicação oficial.");
      return;
    }
    mudar(pipeline.slug, { situacao: "baixando", mensagem: "Baixando", progresso: 15 });
    try {
      const r =
        pipeline.slug === "esportes"
          ? await baixarEsp({ data: { url: endereco.trim() } })
          : await baixar({ data: { criterio: pipeline.slug, url: endereco.trim() } });
      await carregar(pipeline, bytesDeBase64(r.base64), "url", endereco.trim());
    } catch (e) {
      mudar(pipeline.slug, {
        situacao: "falha",
        progresso: 0,
        mensagem: e instanceof Error ? e.message : "Falha ao baixar a publicação.",
      });
    }
  }

  async function usarArquivo(pipeline: Pipeline, arquivo: File) {
    try {
      await carregar(
        pipeline,
        new Uint8Array(await arquivo.arrayBuffer()),
        "arquivo",
        arquivo.name,
      );
    } catch (e) {
      mudar(pipeline.slug, {
        situacao: "falha",
        progresso: 0,
        mensagem: e instanceof Error ? e.message : "Falha ao ler o arquivo.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar as tabelas oficiais de uma vez</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O sistema entra nas páginas oficiais de cada órgão, encontra a tabela de pontuação do
            exercício escolhido, lê os municípios e atualiza o ranking na hora. Quando o portal do
            Estado recusa a leitura automática, o critério mostra o endereço oficial para você
            concluir em um clique.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Exercício</Label>
              <Input
                type="number"
                value={anoBase}
                onChange={(e) => setAnoBase(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo da tabela</Label>
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteRelatorio)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preliminar">Preliminar</SelectItem>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={sincronizarTudo} disabled={tudoRodando}>
                {tudoRodando ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Atualizar todos os critérios
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {PIPELINES.map((p) => {
          const estado = estados[p.slug] ?? INICIAL;
          const ocupado =
            estado.situacao === "procurando" ||
            estado.situacao === "baixando" ||
            estado.situacao === "lendo" ||
            estado.situacao === "gravando";
          const atual = cobertura?.[p.slug];
          return (
            <Card key={p.slug}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{p.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground">{p.orgao}</p>
                  </div>
                  {estado.situacao === "ok" && (
                    <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                      <CheckCircle2 className="size-3" /> Atualizado
                    </Badge>
                  )}
                  {estado.situacao === "falha" && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" /> Precisa de você
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  {atual ? (
                    <>
                      Hoje no sistema: <strong>{atual.municipios} municípios</strong> — exercício{" "}
                      {atual.ano}, {atual.fonte}.
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Nenhuma pontuação gravada neste critério ainda.
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => sincronizar(p)}
                    disabled={ocupado || tudoRodando}
                  >
                    {ocupado ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}
                    Buscar agora
                  </Button>
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,application/pdf"
                      className="hidden"
                      disabled={ocupado}
                      onChange={async (e) => {
                        const arquivo = e.target.files?.[0];
                        if (arquivo) await usarArquivo(p, arquivo);
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
                      <Upload className="mr-2 size-4" />
                      Enviar arquivo
                    </span>
                  </label>
                </div>

                {ocupado && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{estado.mensagem}…</p>
                    <Progress value={estado.progresso} />
                  </div>
                )}

                {!ocupado && estado.mensagem && (
                  <p
                    className={
                      estado.situacao === "falha"
                        ? "rounded-md border border-amber-300 bg-amber-50 p-2 text-sm dark:border-amber-800 dark:bg-amber-950/20"
                        : "text-sm text-emerald-700 dark:text-emerald-400"
                    }
                  >
                    {estado.mensagem}
                  </p>
                )}

                {estado.links.length > 0 && (
                  <div className="space-y-1 rounded-md border p-2">
                    <p className="text-xs font-medium">Publicações encontradas no site oficial</p>
                    {estado.links.slice(0, 6).map((l) => (
                      <div key={l.url} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {l.ano ? `${l.ano} — ` : ""}
                          {l.texto}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ocupado}
                          onClick={() => usarEndereco(p, l.url)}
                        >
                          Usar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {estado.situacao === "falha" && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cole aqui o endereço da tabela oficial"
                      value={estado.urlManual}
                      onChange={(e) => mudar(p.slug, { urlManual: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => usarEndereco(p, estado.urlManual)}
                    >
                      Usar
                    </Button>
                  </div>
                )}

                {p.fontes && (
                  <div className="space-y-1">
                    {p.fontes.map((f) => (
                      <a
                        key={f.url}
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="size-3" />
                        {f.nome}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
