import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  baixarRelatorioEsportes,
  descobrirRelatoriosEsportes,
  gravarAtividadesEsportes,
  gravarRankingEsportes,
  limparEsportes,
} from "@/lib/icms/esportes.functions";
import { registrarImportacao } from "@/lib/icms/criterios.functions";
import {
  HistoricoRelatoriosEncontrados,
  LinksDiretos,
  registrarRelatoriosEncontrados,
} from "@/components/icms/RelatoriosEncontrados";

import {
  extrairBlocos,
  extrairRanking,
  identificarRelatorioEsportes,
  mapearAtividade,
} from "@/lib/icms/esportes/parser";
import { useAtividadesReferencia, type FonteRelatorio } from "@/hooks/useEsportes";

type Resumo = {
  municipios: number;
  ranking: number;
  atividades: number;
  naoMapeadas: string[];
};

export function IngestaoEsportes() {
  const cliente = useQueryClient();
  const { data: referencia } = useAtividadesReferencia();
  const descobrir = useServerFn(descobrirRelatoriosEsportes);
  const baixar = useServerFn(baixarRelatorioEsportes);
  const limpar = useServerFn(limparEsportes);
  const gravarRanking = useServerFn(gravarRankingEsportes);
  const gravarAtividades = useServerFn(gravarAtividadesEsportes);
  const registrar = useServerFn(registrarImportacao);

  const [anoBase, setAnoBase] = useState<number>(new Date().getFullYear() - 2);
  const [fonte, setFonte] = useState<FonteRelatorio>("definitivo");
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<
    { url: string; texto: string; tipo: string; ano: number | null }[]
  >([]);
  const [buscando, setBuscando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  async function buscarLinks() {
    setBuscando(true);
    try {
      const r = await descobrir({ data: undefined as never });
      setLinks(r.relatorios);
      if (!r.relatorios.length) toast.info("Nenhum relatório localizado no site. Cole a URL do PDF.");
      await registrarRelatoriosEncontrados("esportes", r.relatorios).catch(() => undefined);
      void cliente.invalidateQueries({ queryKey: ["relatorios-encontrados", "esportes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o site.");
    } finally {
      setBuscando(false);
    }
  }

  async function processar(
    dados: Uint8Array,
    origem?: { url?: string; arquivoNome?: string },
    referenciaSelecionada?: { ano?: number | null; tipo?: string | null },
  ) {
    setRodando(true);
    setResumo(null);

    try {
      const { extrairPaginas } = await import("@/lib/icms/esportes/pdf");
      setEtapa("Lendo o PDF");
      const paginas = await extrairPaginas(dados, (p, total) =>
        setProgresso(Math.round((p / total) * 70)),
      );

      const identificacao = identificarRelatorioEsportes(paginas);
      const anoImportado = identificacao.anoBase ?? referenciaSelecionada?.ano ?? anoBase;
      const tipoSelecionado = referenciaSelecionada?.tipo;
      const fonteImportada =
        identificacao.fonte ??
        (tipoSelecionado === "preliminar" || tipoSelecionado === "definitivo"
          ? tipoSelecionado
          : fonte);
      setAnoBase(anoImportado);
      setFonte(fonteImportada);

      setEtapa("Organizando os dados");
      const ranking = extrairRanking(paginas);
      const blocos = extrairBlocos(paginas.flatMap((p) => p.linhas.map((l) => l.texto)));
      const ref = referencia ?? [];
      const naoMapeadas = new Set<string>();
      const itens = blocos.map((b) => {
        const mapa = mapearAtividade(b.atividadeNome, ref);
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
        throw new Error("O arquivo não parece ser o relatório do Critério Esportes.");
      }

      setEtapa("Gravando");
      await limpar({ data: { anoBase: anoImportado, fonte: fonteImportada } });
      for (let i = 0; i < ranking.length; i += 300) {
        await gravarRanking({
          data: { anoBase: anoImportado, fonte: fonteImportada, linhas: ranking.slice(i, i + 300) },
        });
        setProgresso(70 + Math.round(((i + 300) / Math.max(ranking.length, 1)) * 10));
      }
      for (let i = 0; i < itens.length; i += 150) {
        await gravarAtividades({
          data: { anoBase: anoImportado, fonte: fonteImportada, itens: itens.slice(i, i + 150) },
        });
        setProgresso(80 + Math.round(((i + 150) / Math.max(itens.length, 1)) * 20));
      }

      setProgresso(100);
      setResumo({
        municipios: new Set(itens.map((i) => i.municipio)).size,
        ranking: ranking.length,
        atividades: itens.length,
        naoMapeadas: [...naoMapeadas],
      });
      try {
        await registrar({
          data: {
            criterio: "esportes",
            anoBase: anoImportado,
            fonte: fonteImportada,
            origem: origem?.url ? "url" : "arquivo",
            url: origem?.url ?? null,
            arquivoNome: origem?.arquivoNome ?? null,
            paginas: paginas.length,
            registrosRanking: ranking.length,
            registrosItens: itens.length,
            municipios: new Set(itens.map((i) => i.municipio)).size,
            naoMapeados: [...naoMapeadas],
            divergencias: [],
          },
        });
      } catch {
        // o histórico é apenas informativo; não interrompe a carga
      }
      await cliente.invalidateQueries({ queryKey: ["esportes-anos"] });
      await cliente.invalidateQueries({ queryKey: ["esportes-ranking"] });
      await cliente.invalidateQueries({ queryKey: ["esportes-atividades"] });
      await cliente.invalidateQueries({ queryKey: ["criterio-importacoes"] });
      toast.success("Dados do critério Esportes atualizados.");

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o relatório.");
    } finally {
      setRodando(false);
      setEtapa("");
    }
  }

  async function importarUrl(
    alvo: string,
    referenciaSelecionada?: { ano?: number | null; tipo?: string | null },
  ) {
    if (!alvo) {
      toast.error("Informe o endereço do PDF.");
      return;
    }
    setRodando(true);
    setEtapa("Baixando o relatório");
    setProgresso(2);
    try {
      const r = await baixar({ data: { url: alvo } });
      const binario = atob(r.base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      await processar(bytes, { url: alvo }, referenciaSelecionada);
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
          <CardTitle className="text-base">Importar relatório do Critério Esportes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ano-base">Ano-base do relatório</Label>
              <Input
                id="ano-base"
                type="number"
                value={anoBase}
                onChange={(e) => setAnoBase(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo do relatório</Label>
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteRelatorio)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="definitivo">Definitivo</SelectItem>
                  <SelectItem value="preliminar">Preliminar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Button variant="outline" size="sm" onClick={buscarLinks} disabled={buscando || rodando}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Procurar no site oficial
            </Button>
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <Label htmlFor="url-pdf">Ou cole o endereço do PDF</Label>
              <Input
                id="url-pdf"
                placeholder="https://observatoriodoesporte.mg.gov.br/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => importarUrl(url)} disabled={rodando}>
              <Download className="h-4 w-4" />
              Importar do endereço
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="arquivo-pdf">Ou envie o arquivo</Label>
              <Input
                id="arquivo-pdf"
                type="file"
                accept="application/pdf"
                disabled={rodando}
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo)
                    await processar(new Uint8Array(await arquivo.arrayBuffer()), {
                      arquivoNome: arquivo.name,
                    });
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {links.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Relatórios encontrados</p>
              {links.map((l) => (
                <div key={l.url} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    <Badge variant="outline" className="mr-2 capitalize">
                      {l.tipo}
                    </Badge>
                    {l.texto}
                    {l.ano ? (
                      <span className="ml-2 text-xs text-muted-foreground">ano-base {l.ano}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <LinksDiretos url={l.url} />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={rodando}
                      onClick={() => {
                        if (l.ano) setAnoBase(l.ano);
                        if (l.tipo === "preliminar" || l.tipo === "definitivo") setFonte(l.tipo);
                        void importarUrl(l.url, { ano: l.ano, tipo: l.tipo });
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Usar
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <HistoricoRelatoriosEncontrados
            criterio="esportes"
            desabilitado={rodando}
            onUsar={(l) => {
              if (l.ano) setAnoBase(l.ano);
              if (l.tipo === "preliminar" || l.tipo === "definitivo") setFonte(l.tipo);
              void importarUrl(l.url, { ano: l.ano, tipo: l.tipo });
            }}
          />

          {rodando && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{etapa}…</p>
              <Progress value={progresso} />
            </div>
          )}

          {resumo && (
            <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <p>
                {resumo.ranking} municípios no ranking, {resumo.atividades} atividades detalhadas em{" "}
                {resumo.municipios} municípios.
              </p>
              {resumo.naoMapeadas.length > 0 && (
                <div>
                  <p className="font-medium">Atividades sem correspondência no Anexo V:</p>
                  <ul className="list-inside list-disc text-muted-foreground">
                    {resumo.naoMapeadas.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
