import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CRITERIOS } from "@/lib/icms/criterios";
import { normalizarMunicipio } from "@/lib/icms/esportes/parser";
import { useRankingTodosCriterios } from "@/hooks/useCriterios";

/**
 * Pontuação de cada município nos critérios já importados, com o peso real do
 * Anexo I da Lei 18.030/2009. O índice ponderado é o índice do município no
 * critério multiplicado pelo peso do critério — é ele que soma no índice geral
 * de participação, então o total da última coluna mostra quanto os critérios
 * importados representam hoje para cada município.
 */
export function PontuacaoCriterios({ municipios }: { municipios: string[] }) {
  const chaves = useMemo(() => municipios.map((n) => normalizarMunicipio(n)), [municipios]);
  const { data: linhas, isLoading } = useRankingTodosCriterios(chaves);

  const { criterios, tabela } = useMemo(() => {
    const porCriterio = new Map<string, Map<string, number>>();
    const anos = new Map<string, { ano: number; fonte: string }>();
    for (const l of linhas ?? []) {
      const mapa = porCriterio.get(l.criterio) ?? new Map<string, number>();
      mapa.set(l.municipio, l.indice_percentual);
      porCriterio.set(l.criterio, mapa);
      anos.set(l.criterio, { ano: l.ano_base, fonte: l.fonte_relatorio });
    }
    const criterios = CRITERIOS.filter((c) => porCriterio.has(c.slug)).map((c) => ({
      slug: c.slug,
      nome: c.nome,
      peso: c.percentual != null ? c.percentual / 100 : null,
      percentual: c.percentual,
      ano: anos.get(c.slug) ?? null,
      valores: porCriterio.get(c.slug)!,
    }));
    const tabela = municipios.map((nome, i) => {
      const chave = chaves[i] ?? "";
      const celulas = criterios.map((c) => {
        const indice = c.valores.get(chave) ?? null;
        return {
          slug: c.slug,
          indice,
          ponderado: indice != null && c.peso != null ? indice * c.peso : null,
        };
      });
      return {
        nome,
        celulas,
        total: celulas.reduce((s, c) => s + (c.ponderado ?? 0), 0),
      };
    });
    tabela.sort((a, b) => b.total - a.total);
    return { criterios, tabela };
  }, [linhas, municipios, chaves]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pontuação por critério (relatórios importados)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : !criterios.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ainda não há relatórios de critérios importados. Importe em Critérios para comparar a
            pontuação de cada município.
          </p>
        ) : (
          <div className="space-y-3 overflow-x-auto">
            <p className="text-xs text-muted-foreground">
              Índice de cada município no critério e o mesmo índice já multiplicado pelo peso do
              Anexo I. A última coluna soma os critérios importados.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Município</TableHead>
                  {criterios.map((c) => (
                    <TableHead key={c.slug} className="text-right">
                      <span className="block">{c.nome}</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        peso {c.percentual != null ? `${c.percentual}%` : "—"}
                        {c.ano ? ` · ${c.ano.ano} ${c.ano.fonte}` : ""}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total ponderado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabela.map((l) => (
                  <TableRow key={l.nome}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    {l.celulas.map((c) => (
                      <TableCell key={c.slug} className="text-right tabular-nums">
                        {c.indice == null ? (
                          <Badge variant="outline">não pontua</Badge>
                        ) : (
                          <>
                            <span className="block">
                              {c.indice.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              ponderado{" "}
                              {c.ponderado?.toLocaleString("pt-BR", { maximumFractionDigits: 6 }) ??
                                "—"}
                            </span>
                          </>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {l.total.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
