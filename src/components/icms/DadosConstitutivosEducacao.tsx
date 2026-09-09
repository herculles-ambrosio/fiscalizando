/**
 * Números brutos que a Fundação João Pinheiro usou para calcular o índice de
 * Educação do município, comparados com a média dos demais municípios. O que
 * está muito fora da média é o que costuma indicar erro de lançamento no censo
 * ou nas bases da SEE — exatamente o que se contesta no prazo de recurso.
 */

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { useDadosConstitutivos, type VersaoEducacao } from "@/hooks/useEducacao";

function numeroBr(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function DadosConstitutivosEducacao({
  exercicio,
  versao,
  municipio,
  municipioNome,
}: {
  exercicio: number | null;
  versao: VersaoEducacao;
  municipio: string | null;
  municipioNome: string;
}) {
  const { data, isLoading } = useDadosConstitutivos(exercicio, versao, municipio);
  const [busca, setBusca] = useState("");

  const linhas = useMemo(() => {
    const lista = (data?.linhas ?? []).map((l) => {
      const media = data?.medias.get(l.coluna_origem) ?? null;
      const valor = l.valor_num;
      const diferenca = valor != null && media ? ((valor - media) / Math.abs(media)) * 100 : null;
      return { ...l, media, diferenca };
    });
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? lista.filter((l) => l.coluna_origem.toLowerCase().includes(termo))
      : lista;
    return filtradas.sort(
      (a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0),
    );
  }, [data, busca]);

  const foraDaCurva = linhas.filter((l) => l.diferenca != null && Math.abs(l.diferenca) >= 40);

  if (!municipio) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Escolha uma prefeitura para ver os dados constitutivos.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-base">
          Dados constitutivos de {municipioNome} — exercício {exercicio ?? "—"} (
          {versao === "provisorio" ? "provisório" : "definitivo"})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {foraDaCurva.length
            ? `${foraDaCurva.length} número(s) muito distante(s) da média dos demais municípios — confira antes de decidir se cabe recurso.`
            : "Nenhum número muito distante da média dos demais municípios."}
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Procurar indicador"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={!linhas.length}
            onClick={() =>
              baixarCsv(
                `educacao-dados-${municipio}-${exercicio}.csv`,
                montarCsv(
                  ["Indicador", "Valor do município", "Média estadual", "Diferença (%)"],
                  linhas.map((l) => [
                    l.coluna_origem,
                    l.valor_num ?? l.valor_texto ?? "",
                    l.media ?? "",
                    l.diferenca == null ? "" : l.diferenca.toFixed(1),
                  ]),
                ),
              )
            }
          >
            <Download className="mr-2 size-4" />
            Baixar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !linhas.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado constitutivo importado para este exercício. Importe a planilha da FJP na aba
            de importação.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Indicador</th>
                  <th className="py-2 text-right">Município</th>
                  <th className="py-2 text-right">Média do Estado</th>
                  <th className="py-2 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.coluna_origem} className="border-b last:border-0">
                    <td className="py-2 pr-3">{l.coluna_origem}</td>
                    <td className="py-2 text-right">
                      {l.valor_num == null ? (l.valor_texto ?? "—") : numeroBr(l.valor_num)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{numeroBr(l.media)}</td>
                    <td className="py-2 text-right">
                      {l.diferenca == null ? (
                        "—"
                      ) : Math.abs(l.diferenca) >= 40 ? (
                        <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                          {l.diferenca > 0 ? "+" : ""}
                          {l.diferenca.toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {l.diferenca > 0 ? "+" : ""}
                          {l.diferenca.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
