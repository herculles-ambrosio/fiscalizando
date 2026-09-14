import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { formatarCnpj, formatarValorGrid } from "@/lib/format";
import { formatarIndice } from "@/lib/vaf/indice";
import { impactoPorContribuinte, type MovimentoDeclarante } from "@/lib/vaf/evolucao";

const POR_PAGINA = 20;

const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export default function ImpactoContribuintes({
  movimentos,
  indiceAtual,
  nomeArquivo,
}: {
  movimentos: MovimentoDeclarante[];
  indiceAtual: number | null;
  nomeArquivo: string;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const { linhas, total } = useMemo(
    () => impactoPorContribuinte(movimentos, indiceAtual),
    [movimentos, indiceAtual],
  );

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter(
      (l) =>
        l.inscricao_estadual.toLowerCase().includes(t) ||
        (l.nome ?? "").toLowerCase().includes(t) ||
        (l.cnpj ?? "").includes(t.replace(/\D/g, "")),
    );
  }, [linhas, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, totalPaginas);
  const naTela = filtradas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  function exportar() {
    baixarCsv(
      nomeArquivo,
      montarCsv(
        [
          "Inscrição estadual",
          "CNPJ",
          "Contribuinte",
          "VAF comparado/estimado",
          "Participação (%)",
          "Acumulado (%)",
          "Impacto no índice (pontos)",
          "Variação vs. base (%)",
        ],
        filtradas.map((l) => [
          l.inscricao_estadual,
          l.cnpj ?? "",
          l.nome ?? "",
          l.vafAtual,
          l.participacaoPct,
          l.acumuladoPct,
          l.pontosIndice ?? "",
          l.variacaoPct ?? "",
        ]),
      ),
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nome, CNPJ ou inscrição"
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            VAF total do arquivo comparado: {formatarValorGrid(total)}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={exportar}
            disabled={filtradas.length === 0}
            className="ml-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar visíveis ({filtradas.length})
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contribuinte</TableHead>
              <TableHead>Inscrição</TableHead>
              <TableHead className="text-right">VAF comparado</TableHead>
              <TableHead className="text-right">Participação</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
              <TableHead className="text-right">Impacto no índice</TableHead>
              <TableHead className="text-right">Variação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {naTela.map((l) => (
              <TableRow key={l.inscricao_estadual}>
                <TableCell>
                  <span className="font-medium">{l.nome ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatarCnpj(l.cnpj)}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{l.inscricao_estadual}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatarValorGrid(l.vafAtual)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">
                  {pct(l.participacaoPct)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {pct(l.acumuladoPct)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.pontosIndice == null ? "—" : `${formatarIndice(l.pontosIndice)}%`}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {l.variacaoPct == null ? "—" : pct(l.variacaoPct)}
                </TableCell>
              </TableRow>
            ))}
            {naTela.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum contribuinte com VAF no arquivo comparado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
            <span>
              Página {atual} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={atual <= 1}
                onClick={() => setPagina(atual - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={atual >= totalPaginas}
                onClick={() => setPagina(atual + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
