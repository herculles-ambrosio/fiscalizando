import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  useExcluirResolucaoSef,
  useResolucoesSef,
  useSalvarResolucaoSef,
  type ResolucaoSef,
} from "@/hooks/useResolucoesSef";

export const Route = createFileRoute("/_authenticated/consultoria/resolucao")({
  head: () => ({
    meta: [
      { title: "Resoluções SEF | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Cadastre as resoluções da SEF-MG com ano de apuração e ano de aplicação e importe os índices publicados de todos os municípios.",
      },
      { property: "og:title", content: "Resoluções SEF | Apura VAF 2.0" },
      {
        property: "og:description",
        content: "Cadastro das resoluções da SEF-MG com os índices oficiais de participação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroResolucoes,
});

const URL_PADRAO =
  "https://www.fazenda.mg.gov.br/empresas/legislacao_tributaria/resolucoes/2026/rr6069_2026.html";

function CadastroResolucoes() {
  const { data: municipios } = useMunicipios();
  const { data: cadastradas = [] } = useResolucoesSef();
  const salvar = useSalvarResolucaoSef();
  const excluir = useExcluirResolucaoSef();
  const buscar = useServerFn(buscarResolucao);

  const [url, setUrl] = useState(URL_PADRAO);
  const [colado, setColado] = useState("");
  const [anexo, setAnexo] = useState<AnexoResolucao | null>(null);
  const [numero, setNumero] = useState("");
  const [dataPublicacao, setDataPublicacao] = useState("");
  const [anoApuracao, setAnoApuracao] = useState("");
  const [anoAplicacao, setAnoAplicacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [carregando, setCarregando] = useState(false);

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
    setNumero((atual) => atual || (resultado.resolucao ?? "").split("/")[0] || "");
    setAnoAplicacao(
      (atual) =>
        atual || (resultado.exercicioAplicacao ? String(resultado.exercicioAplicacao) : ""),
    );
    setAnoApuracao((atual) => atual || (resultado.anoB ? String(resultado.anoB) : ""));
    toast.success(`${resultado.linhas.length} municípios lidos do anexo.`);
  }

  async function buscarPagina(endereco = url) {
    setCarregando(true);
    try {
      aplicar(await buscar({ data: { url: endereco } }));
    } catch (erro) {
      toast.error("Não consegui ler a página da resolução.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setCarregando(false);
    }
  }

  function reler(r: ResolucaoSef) {
    setNumero(r.numero);
    setAnoApuracao(String(r.ano_apuracao));
    setAnoAplicacao(String(r.ano_aplicacao));
    setDataPublicacao(r.data_publicacao ?? "");
    setObservacao(r.observacao ?? "");
    if (r.url) {
      setUrl(r.url);
      void buscarPagina(r.url);
    }
  }

  async function gravar() {
    if (!anexo) return;
    if (!numero.trim() || !anoApuracao.trim() || !anoAplicacao.trim()) {
      toast.error("Informe o número da resolução, o ano de apuração e o ano de aplicação.");
      return;
    }
    try {
      await salvar.mutateAsync({
        numero: numero.trim(),
        dataPublicacao: dataPublicacao || null,
        url: url || null,
        anoApuracao: Number(anoApuracao),
        anoAplicacao: Number(anoAplicacao),
        anoA: anexo.anoA,
        anoB: anexo.anoB,
        observacao: observacao.trim() || null,
        linhas: casadas,
      });
      toast.success(`Resolução ${numero} gravada com ${casadas.length} municípios.`);
    } catch (erro) {
      toast.error("Não foi possível gravar a resolução.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resoluções SEF</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre cada resolução com o ano de apuração e o ano de aplicação. Os índices publicados
          ficam disponíveis para comparação nas análises do VAF.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resoluções cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          {cadastradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma resolução cadastrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resolução</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Apuração</TableHead>
                  <TableHead>Aplicação</TableHead>
                  <TableHead className="text-right">Municípios</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cadastradas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.numero}</TableCell>
                    <TableCell>
                      {r.data_publicacao
                        ? new Date(`${r.data_publicacao}T12:00:00`).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>{r.ano_apuracao}</TableCell>
                    <TableCell>{r.ano_aplicacao}</TableCell>
                    <TableCell className="text-right font-mono">{r.municipios}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => reler(r)}>
                        Reler
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={excluir.isPending}
                        onClick={() => {
                          if (!confirm(`Excluir a resolução ${r.numero} e seus índices?`)) return;
                          excluir.mutate(r, {
                            onSuccess: () => toast.success("Resolução excluída."),
                            onError: (e) =>
                              toast.error("Não foi possível excluir.", {
                                description: e instanceof Error ? e.message : undefined,
                              }),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
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
          <Button onClick={() => buscarPagina()} disabled={carregando}>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="num">Número da resolução</Label>
                <Input id="num" value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dt">Data da publicação</Label>
                <Input
                  id="dt"
                  type="date"
                  value={dataPublicacao}
                  onChange={(e) => setDataPublicacao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apu">Ano de apuração</Label>
                <Input
                  id="apu"
                  value={anoApuracao}
                  onChange={(e) => setAnoApuracao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apl">Ano de aplicação</Label>
                <Input
                  id="apl"
                  value={anoAplicacao}
                  onChange={(e) => setAnoAplicacao(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observação</Label>
              <Input
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: índice provisório, sujeito a recurso."
              />
            </div>

            <Alert>
              <AlertTitle>
                {reconhecidos.length} de {casadas.length} municípios reconhecidos
              </AlertTitle>
              <AlertDescription className="text-xs">
                Anos das colunas do anexo: {anexo.anoA ?? "—"} e {anexo.anoB ?? "—"}.
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

            <Button onClick={gravar} disabled={salvar.isPending}>
              {salvar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gravar resolução com {casadas.length} municípios
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
