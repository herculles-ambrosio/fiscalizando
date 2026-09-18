import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMunicipios } from "@/hooks/useMunicipio";
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
import { buscarResolucao } from "@/lib/vaf/resolucao.functions";
import { casarMunicipios, parseAnexoResolucao, type AnexoResolucao } from "@/lib/vaf/resolucao";
import { formatarIndice } from "@/lib/vaf/indice";
import { useResolucoesCarregadas } from "@/hooks/useIndiceAplicado";

export const Route = createFileRoute("/_authenticated/consultoria/resolucao")({
  head: () => ({
    meta: [
      { title: "Índices da Resolução SEF | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Importe os índices de participação publicados nas resoluções da SEF-MG e use-os nas estatísticas das prefeituras que não são clientes.",
      },
      { property: "og:title", content: "Índices da Resolução SEF | Apura VAF 2.0" },
      {
        property: "og:description",
        content: "Leitura do anexo das resoluções da SEF-MG com os índices de todos os municípios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportarResolucao,
});

const URL_PADRAO =
  "https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/resolucoes/2026/rr6069_2026.html";

function ImportarResolucao() {
  const { data: municipios } = useMunicipios();
  const { data: carregadas = [] } = useResolucoesCarregadas();
  const buscar = useServerFn(buscarResolucao);
  const queryClient = useQueryClient();

  const [url, setUrl] = useState(URL_PADRAO);
  const [colado, setColado] = useState("");
  const [anexo, setAnexo] = useState<AnexoResolucao | null>(null);
  const [resolucao, setResolucao] = useState("");
  const [exercicio, setExercicio] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const casadas = useMemo(
    () => (anexo ? casarMunicipios(anexo.linhas, municipios ?? []) : []),
    [anexo, municipios],
  );
  const reconhecidos = casadas.filter((c) => c.municipioId);
  const naoReconhecidos = casadas.filter((c) => !c.municipioId);

  function aplicar(resultado: AnexoResolucao) {
    if (resultado.linhas.length === 0) {
      toast.error("Não encontrei a tabela do anexo nesse conteúdo.");
      return;
    }
    setAnexo(resultado);
    setResolucao(resultado.resolucao ?? "");
    setExercicio(resultado.exercicioAplicacao ? String(resultado.exercicioAplicacao) : "");
    toast.success(`${resultado.linhas.length} municípios lidos do anexo.`);
  }

  async function buscarPagina() {
    setCarregando(true);
    try {
      aplicar(await buscar({ data: { url } }));
    } catch (erro) {
      toast.error("Não consegui ler a página da resolução.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setCarregando(false);
    }
  }

  async function gravar() {
    if (!anexo) return;
    if (!resolucao.trim() || !exercicio.trim()) {
      toast.error("Informe o número da resolução e o exercício de aplicação.");
      return;
    }
    if (!anexo.anoA || !anexo.anoB) {
      toast.error("Não identifiquei os anos das colunas do anexo.");
      return;
    }
    setSalvando(true);
    const registros = casadas.map(({ linha, municipioId }) => ({
      municipio_id: municipioId,
      codigo_mun: linha.codigoMun,
      municipio_nome: linha.municipioNome,
      resolucao: resolucao.trim(),
      exercicio_aplicacao: Number(exercicio),
      ano_a: anexo.anoA!,
      vaf_a: linha.vafA,
      indice_a: linha.indiceA,
      ano_b: anexo.anoB!,
      vaf_b: linha.vafB,
      indice_b: linha.indiceB,
      media_indices: linha.mediaIndices,
      fonte_url: url,
    }));

    const { error } = await supabase
      .from("indices_resolucao")
      .upsert(registros, { onConflict: "resolucao,codigo_mun" });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível gravar os índices.", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["indices-resolucao"] });
    toast.success(`${registros.length} municípios gravados.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Índices da Resolução SEF</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importe o anexo com os índices de todos os municípios mineiros. Esses índices alimentam as
          estatísticas das prefeituras que não são clientes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resoluções já importadas</CardTitle>
        </CardHeader>
        <CardContent>
          {carregadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resolução importada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resolução</TableHead>
                  <TableHead>Aplicação</TableHead>
                  <TableHead>Anos de apuração</TableHead>
                  <TableHead className="text-right">Municípios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregadas.map((r) => (
                  <TableRow key={r.resolucao}>
                    <TableCell className="font-medium">{r.resolucao}</TableCell>
                    <TableCell>{r.exercicio_aplicacao}</TableCell>
                    <TableCell>
                      {r.ano_a}/{r.ano_b}
                    </TableCell>
                    <TableCell className="text-right font-mono">{r.municipios}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">1. Buscar pelo endereço da resolução</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="url">Endereço no site da Fazenda de Minas Gerais</Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <Button onClick={buscarPagina} disabled={carregando}>
            {carregando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Ler a resolução
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">2. Ou colar o conteúdo da tabela</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            rows={6}
            placeholder="Cole aqui a tabela copiada da página da resolução."
          />
          <Button
            variant="outline"
            onClick={() => aplicar(parseAnexoResolucao(colado))}
            disabled={!colado.trim()}
          >
            <Download className="mr-2 h-4 w-4" />
            Ler o conteúdo colado
          </Button>
        </CardContent>
      </Card>

      {anexo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">3. Conferir e gravar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="res">Resolução</Label>
                <Input id="res" value={resolucao} onChange={(e) => setResolucao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex">Exercício de aplicação</Label>
                <Input id="ex" value={exercicio} onChange={(e) => setExercicio(e.target.value)} />
              </div>
            </div>

            <Alert>
              <AlertTitle>
                {reconhecidos.length} de {casadas.length} municípios reconhecidos
              </AlertTitle>
              <AlertDescription className="text-xs">
                Anos das colunas: {anexo.anoA ?? "—"} e {anexo.anoB ?? "—"}.
                {naoReconhecidos.length > 0 && (
                  <>
                    {" "}
                    Sem cadastro no sistema:{" "}
                    {naoReconhecidos
                      .slice(0, 10)
                      .map((c) => c.linha.municipioNome)
                      .join(", ")}
                    {naoReconhecidos.length > 10 ? "…" : ""} (ficam gravados e são associados
                    automaticamente quando a prefeitura for cadastrada com o mesmo nome).
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Município</TableHead>
                    <TableHead className="text-right">Índice {anexo.anoA}</TableHead>
                    <TableHead className="text-right">Índice {anexo.anoB}</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casadas.slice(0, 60).map(({ linha, municipioId }) => (
                    <TableRow key={`${linha.codigoMun}-${linha.municipioNome}`}>
                      <TableCell className={municipioId ? "font-medium" : "text-muted-foreground"}>
                        {linha.municipioNome}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {linha.indiceA == null ? "—" : `${formatarIndice(linha.indiceA)}%`}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {linha.indiceB == null ? "—" : `${formatarIndice(linha.indiceB)}%`}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {linha.mediaIndices == null
                          ? "—"
                          : `${formatarIndice(linha.mediaIndices)}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={gravar} disabled={salvando}>
              {salvando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gravar {casadas.length} municípios
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
