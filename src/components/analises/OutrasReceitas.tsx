import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatarCnpj, formatarValorGrid } from "@/lib/format";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { nomeMunicipioSef } from "@/lib/vaf/municipiosSef";
import {
  compararOutrasEntradas,
  registroDaClassificacao,
  rotuloClassificacao,
  type LinhaOutrasEntradas,
  type OutrasEntradasArquivo,
} from "@/lib/vaf/outrasEntradas";

const POR_PAGINA = 50;

const municipio = (codigo: string): string => nomeMunicipioSef(codigo) ?? `Código ${codigo}`;

type Props = {
  base: OutrasEntradasArquivo | undefined;
  atual: OutrasEntradasArquivo | undefined;
  rotuloBase: string;
  rotuloAtual: string;
  nomeArquivoCsv: string;
};

export default function OutrasReceitas({
  base,
  atual,
  rotuloBase,
  rotuloAtual,
  nomeArquivoCsv,
}: Props) {
  const dados = useMemo(() => compararOutrasEntradas(base, atual), [base, atual]);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<LinhaOutrasEntradas | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return dados.linhas;
    return dados.linhas.filter((l) =>
      [
        l.inscricao_estadual,
        l.nome ?? "",
        l.cnpj ?? "",
        l.classificacoes.map(rotuloClassificacao).join(" "),
        l.municipios.map(municipio).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [dados.linhas, busca]);

  const totalFiltrado = filtradas.reduce((s, l) => s + l.atual, 0);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const diferenca = dados.totalAtual - dados.totalBase;

  const exportar = () => {
    const csv = montarCsv(
      [
        "IE",
        "CNPJ",
        "Contribuinte",
        "Classificacao",
        "Municipios",
        "Percentual",
        "Outras entradas base",
        "Outras entradas atual",
        "Diferenca",
      ],
      filtradas.map((l) => [
        l.inscricao_estadual,
        l.cnpj ?? "",
        l.nome ?? "",
        l.classificacoes.map(rotuloClassificacao).join(" | "),
        l.municipios.map(municipio).join(" | "),
        l.percentual.toFixed(2).replace(".", ","),
        l.base.toFixed(2).replace(".", ","),
        l.atual.toFixed(2).replace(".", ","),
        l.diferenca.toFixed(2).replace(".", ","),
      ]),
    );
    baixarCsv(nomeArquivoCsv, csv);
  };

  if (dados.linhas.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Nenhum dos arquivos comparados trouxe outras entradas (registros 07/08 da DAMEF).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { titulo: `Outras entradas — ${rotuloBase}`, valor: dados.totalBase, cor: "" },
          { titulo: `Outras entradas — ${rotuloAtual}`, valor: dados.totalAtual, cor: "" },
          {
            titulo: "Diferença",
            valor: diferenca,
            cor: diferenca < 0 ? "text-destructive" : diferenca > 0 ? "text-emerald-600" : "",
          },
        ].map((c) => (
          <Card key={c.titulo}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {c.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`font-mono text-lg font-semibold ${c.cor}`}>
                R$ {formatarValorGrid(c.valor)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Por classificação (registro 08 da DAMEF)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Código</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">{rotuloBase} (R$)</TableHead>
                <TableHead className="text-right">{rotuloAtual} (R$)</TableHead>
                <TableHead className="text-right">Diferença (R$)</TableHead>
                <TableHead className="w-28 text-right">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.classificacoes.map((c) => (
                <TableRow key={c.classificacao}>
                  <TableCell className="font-mono">
                    {c.classificacao === "0" ? "—" : c.classificacao}
                  </TableCell>
                  <TableCell>{c.rotulo}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatarValorGrid(c.base)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatarValorGrid(c.atual)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${c.diferenca < 0 ? "text-destructive" : c.diferenca > 0 ? "text-emerald-600" : ""}`}
                  >
                    {formatarValorGrid(c.diferenca)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {c.participacao.toFixed(2).replace(".", ",")}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Por contribuinte</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar IE, nome, CNPJ ou classificação"
                className="h-9 w-64 pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IE</TableHead>
                <TableHead>Contribuinte</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">{rotuloBase} (R$)</TableHead>
                <TableHead className="text-right">{rotuloAtual} (R$)</TableHead>
                <TableHead className="text-right">Diferença (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((l) => (
                <TableRow
                  key={l.inscricao_estadual}
                  className="cursor-pointer"
                  onClick={() => setDetalhe(l)}
                >
                  <TableCell className="font-mono text-xs">{l.inscricao_estadual}</TableCell>
                  <TableCell className="max-w-[16rem] truncate">
                    {l.nome ?? <span className="italic text-muted-foreground">Sem nome no arquivo</span>}
                    {l.cnpj && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {formatarCnpj(l.cnpj)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    {l.classificacoes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sem registro 08</span>
                    ) : (
                      l.classificacoes.map((c) => (
                        <Badge key={c} variant="secondary" className="text-[11px]">
                          {rotuloClassificacao(c)}
                        </Badge>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatarValorGrid(l.base)}</TableCell>
                  <TableCell className="text-right font-mono">{formatarValorGrid(l.atual)}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${l.diferenca < 0 ? "text-destructive" : l.diferenca > 0 ? "text-emerald-600" : ""}`}
                  >
                    {formatarValorGrid(l.diferenca)}
                  </TableCell>
                </TableRow>
              ))}
              {visiveis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum contribuinte para a busca informada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {filtradas.length.toLocaleString("pt-BR")} contribuinte(s) · total filtrado R${" "}
            <span className="font-mono">{formatarValorGrid(totalFiltrado)}</span> · total geral R${" "}
            <span className="font-mono">{formatarValorGrid(dados.totalAtual)}</span>
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              Anterior
            </Button>
            Página {paginaAtual} de {paginas}
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual >= paginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
            </Button>
          </span>
        </div>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome ?? detalhe?.inscricao_estadual}</DialogTitle>
            <DialogDescription>
              IE {detalhe?.inscricao_estadual}
              {detalhe?.cnpj ? ` · CNPJ ${formatarCnpj(detalhe.cnpj)}` : ""} · outras entradas R${" "}
              {formatarValorGrid(detalhe?.atual ?? 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Rateio por município e classificação</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Município</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Valor (R$)</TableHead>
                    <TableHead className="text-right">Computado (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detalhe?.detalhe?.rateios ?? []).map((r, i) => (
                    <TableRow key={`${r.municipio}-${r.classificacao}-${i}`}>
                      <TableCell>{municipio(r.municipio)}</TableCell>
                      <TableCell>{rotuloClassificacao(r.classificacao)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {r.percentual.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarValorGrid(r.valor)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarValorGrid(r.valorComputado)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(detalhe?.detalhe?.rateios.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-4 text-center text-sm text-muted-foreground">
                        A remessa não trouxe o registro 08 para este contribuinte.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Detalhamento por registro (14/15/18 a 22)
              </h4>
              {(detalhe?.detalhe?.detalhes.length ?? 0) === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Esta remessa não veio com os registros de detalhamento
                  {detalhe && detalhe.classificacoes.length > 0
                    ? ` (esperado o registro ${detalhe.classificacoes
                        .map(registroDaClassificacao)
                        .filter(Boolean)
                        .join(", ")} para a classificação declarada)`
                    : ""}
                  . O valor consta apenas de forma consolidada no registro 08.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Registro</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detalhe?.detalhe?.detalhes ?? []).map((d, i) => (
                      <TableRow key={`${d.registro}-${d.municipio}-${i}`}>
                        <TableCell className="font-mono">{d.registro}</TableCell>
                        <TableCell>{municipio(d.municipio)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {d.cnpj ? formatarCnpj(d.cnpj) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatarValorGrid(d.valor)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Conferência pelo registro 23 (receita bruta / VAF por município):{" "}
              <span className="font-mono">R$ {formatarValorGrid(detalhe?.detalhe?.total23 ?? 0)}</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
