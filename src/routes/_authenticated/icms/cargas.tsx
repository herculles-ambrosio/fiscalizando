import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { useApagarCarga, useIcmsCargas } from "@/hooks/useIcms";
import { decodificarExtrato, exercicioDoNome, ROTULO_TIPO } from "@/lib/icms/extrato";
import { importarColetaRobinHood, importarExtrato } from "@/lib/icms/importar";
import { sincronizarRobinHood } from "@/lib/icms/robinhood.functions";
import { formatarDataHora } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/icms/cargas")({
  head: () => ({
    meta: [
      { title: "Importar extratos do ICMS — Robin Hood" },
      {
        name: "description",
        content:
          "Importe os extratos anuais de índice, transferências e comparativo do portal Robin Hood da FJP.",
      },
      { property: "og:title", content: "Importar extratos do ICMS — Robin Hood" },
      {
        property: "og:description",
        content: "Cargas mensais dos critérios de distribuição do ICMS aos municípios mineiros.",
      },
    ],
  }),
  component: CargasIcms,
});

function CargasIcms() {
  const { municipioId, municipio } = useMunicipioAtivo();
  const { data: cargas, isLoading } = useIcmsCargas();
  const apagar = useApagarCarga();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [anoFjp, setAnoFjp] = useState(String(new Date().getFullYear()));

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length || !municipioId) return;
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        const conteudo = decodificarExtrato(await arquivo.arrayBuffer());
        const exercicio = exercicioDoNome(arquivo.name, new Date().getFullYear());
        const r = await importarExtrato({
          municipioId,
          exercicio,
          arquivoNome: arquivo.name,
          conteudo,
        });
        toast.success(`${ROTULO_TIPO[r.tipo]} ${r.exercicio}: ${r.registros} valores importados.`);
        if (r.desconhecidos.length) {
          toast.warning(`Linhas não reconhecidas: ${r.desconhecidos.join(", ")}`);
        }
      }
      qc.invalidateQueries({ queryKey: ["icms-cargas"] });
      qc.invalidateQueries({ queryKey: ["icms-dados"] });
      qc.invalidateQueries({ queryKey: ["icms-comparativo"] });
      qc.invalidateQueries({ queryKey: ["icms-exercicios"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui ler este arquivo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function buscarFjp() {
    if (!municipioId || !municipio) return;
    setBuscando(true);
    try {
      const exercicio = Number(anoFjp);
      const r = await sincronizarRobinHood({
        data: {
          municipio: municipio.nome,
          codigoSef: municipio.codigo_sef ?? null,
          exercicio,
        },

      });
      if (!r.registros.length) {
        toast.warning(
          r.tentativas.length
            ? `O portal Robin Hood não devolveu dados. Tentativas: ${r.tentativas.join(" | ")}. Use a importação do arquivo.`
            : "O portal Robin Hood não devolveu dados para este município.",
          { duration: 12000 },
        );
        return;
      }

      const gravados = await importarColetaRobinHood({
        municipioId,
        exercicio,
        registros: r.registros,
        rotulo: `Portal Robin Hood — ${exercicio}${r.fonte === "historico" ? " (base histórica)" : ""}`,
      });
      toast.success(
        `${gravados} valores de ${r.mesesComDados.length} mês(es) importados direto do portal Robin Hood.`,
      );
      qc.invalidateQueries({ queryKey: ["icms-cargas"] });
      qc.invalidateQueries({ queryKey: ["icms-dados"] });
      qc.invalidateQueries({ queryKey: ["icms-exercicios"] });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Não consegui sincronizar com o portal Robin Hood: ${e.message}. Use a importação do arquivo.`
          : "Falha ao consultar o portal Robin Hood.",
      );
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Cargas do ICMS</h1>
        <p className="text-sm text-muted-foreground">
          Importe os extratos do portal Robin Hood (FJP). O sistema identifica sozinho se o arquivo é
          de índices, de transferências ou o comparativo entre municípios.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar arquivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xls,.xlsx,.html,.htm"
              className="hidden"
              onChange={(e) => enviar(e.target.files)}
            />
            <Button onClick={() => inputRef.current?.click()} disabled={enviando || !municipioId}>
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Escolher extratos
            </Button>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Índice anual — critério x mês, com o índice de participação.</li>
              <li>Transferência anual — critério x mês em reais.</li>
              <li>Comparativo — vários municípios x mês.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Reimportar o mesmo período atualiza os valores já gravados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sincronizar com o portal Robin Hood</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Busca no site oficial da Lei Robin Hood (FJP) todos os critérios do exercício —
              índices e valores, mês a mês — sem precisar do extrato. Se o portal estiver fora do
              ar, use a importação manual ao lado.
            </p>
            <div className="flex items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground" htmlFor="ano-fjp">
                  Exercício
                </label>
                <Input
                  id="ano-fjp"
                  value={anoFjp}
                  onChange={(e) => setAnoFjp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="h-9 w-28"
                />
              </div>
              <Button variant="outline" onClick={buscarFjp} disabled={buscando || !municipioId}>
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Sincronizar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extratos importados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !cargas?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum extrato importado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Exercício</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valores</TableHead>
                  <TableHead>Importado em</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[260px] truncate">{c.arquivo_nome}</TableCell>
                    <TableCell>{ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO]}</TableCell>
                    <TableCell>{c.exercicio}</TableCell>
                    <TableCell>
                      <Badge variant={c.origem === "fjp" ? "default" : "secondary"}>
                        {c.origem === "fjp" ? "FJP" : "Arquivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.linhas}</TableCell>
                    <TableCell>{formatarDataHora(c.criado_em)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => apagar.mutate(c.id)}
                        title="Remover registro da carga"
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
    </div>
  );
}
