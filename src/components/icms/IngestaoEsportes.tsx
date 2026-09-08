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
import { extrairBlocos, extrairRanking, mapearAtividade } from "@/lib/icms/esportes/parser";
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

  const [anoBase, setAnoBase] = useState<number>(new Date().getFullYear() - 2);
  const [fonte, setFonte] = useState<FonteRelatorio>("definitivo");
  const [url, setUrl] = useState("");
  const [links, setLinks] = useState<{ url: string; texto: string; tipo: string }[]>([]);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar o site.");
    } finally {
      setBuscando(false);
    }
  }

  async function processar(dados: Uint8Array) {
    setRodando(true);
    setResumo(null);
    try {
      const { extrairPaginas } = await import("@/lib/icms/esportes/pdf");
      setEtapa("Lendo o PDF");
      const paginas = await extrairPaginas(dados, (p, total) =>
        setProgresso(Math.round((p / total) * 70)),
      );

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
      await limpar({ data: { anoBase, fonte } });
      for (let i = 0; i < ranking.length; i += 300) {
        await gravarRanking({ data: { anoBase, fonte, linhas: ranking.slice(i, i + 300) } });
        setProgresso(70 + Math.round(((i + 300) / Math.max(ranking.length, 1)) * 10));
      }
      for (let i = 0; i < itens.length; i += 150) {
        await gravarAtividades({ data: { anoBase, fonte, itens: itens.slice(i, i + 150) } });
        setProgresso(80 + Math.round(((i + 150) / Math.max(itens.length, 1)) * 20));
      }

      setProgresso(100);
      setResumo({
        municipios: new Set(itens.map((i) => i.municipio)).size,
        ranking: ranking.length,
        atividades: itens.length,
        naoMapeadas: [...naoMapeadas],
      });
      await cliente.invalidateQueries({ queryKey: ["esportes-anos"] });
      await cliente.invalidateQueries({ queryKey: ["esportes-ranking"] });
      await cliente.invalidateQueries({ queryKey: ["esportes-atividades"] });
      toast.success("Dados do critério Esportes atualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar o relatório.");
    } finally {
      setRodando(false);
      setEtapa("");
    }
  }

  async function importarUrl(alvo: string) {
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
      await processar(bytes);
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
                  if (arquivo) await processar(new Uint8Array(await arquivo.arrayBuffer()));
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
                  </span>
                  <Button size="sm" variant="ghost" disabled={rodando} onClick={() => importarUrl(l.url)}>
                    <Upload className="h-4 w-4" />
                    Usar
                  </Button>
                </div>
              ))}
            </div>
          )}

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
