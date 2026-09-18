import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useItensCriterioMunicipios, type FonteRelatorio } from "@/hooks/useCriterios";
import { formatarPopulacao, usePopulacao } from "@/hooks/usePopulacao";
import { regiaoDe, vizinhosDe } from "@/lib/icms/criterios/regioes";
import { baixarCsv, montarCsv } from "@/lib/csv";

export type LinhaRankingVizinho = {
  municipio: string;
  municipio_nome: string;
  nota_final: number;
  indice_percentual: number;
};

type Props = {
  slug: string;
  ano: number | null;
  fonte: FonteRelatorio | null;
  /** Ranking completo do critério (todos os municípios do relatório). */
  ranking: LinhaRankingVizinho[] | undefined;
  /** Chave normalizada do município em análise. */
  chaveMunicipio: string | null;
  nomeMunicipio: string | null;
  /** "pontos" ou "% do critério", conforme o critério. */
  unidade?: string;
};

const num = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

/**
 * Comparação com os municípios vizinhos (mesma região imediata do IBGE):
 * quem pontua mais, a distância para o município em análise e, item a item,
 * o que cada um precisa fazer para se aproximar de quem lidera a região.
 */
export function VizinhosCriterio({
  slug,
  ano,
  fonte,
  ranking,
  chaveMunicipio,
  nomeMunicipio,
  unidade = "pontos",
}: Props) {
  const populacao = usePopulacao();
  const [aberto, setAberto] = useState<string | null>(null);

  const regiao = regiaoDe(chaveMunicipio);
  const chavesVizinhas = useMemo(() => vizinhosDe(chaveMunicipio), [chaveMunicipio]);
  const { data: itens } = useItensCriterioMunicipios(slug, ano, fonte, chavesVizinhas);

  /** Pontuação por município e item (somando linhas repetidas do relatório). */
  const pontosPorItem = useMemo(() => {
    const mapa = new Map<string, Map<string, { nome: string; pontuacao: number }>>();
    for (const i of itens ?? []) {
      if (!i.item_codigo) continue;
      const doMunicipio = mapa.get(i.municipio) ?? new Map();
      const atual = doMunicipio.get(i.item_codigo);
      doMunicipio.set(i.item_codigo, {
        nome: i.item_nome,
        pontuacao: (atual?.pontuacao ?? 0) + (i.pontuacao ?? 0),
      });
      mapa.set(i.municipio, doMunicipio);
    }
    return mapa;
  }, [itens]);

  const linhas = useMemo(() => {
    const todos = ranking ?? [];
    const posicaoGeral = new Map(todos.map((l, i) => [l.municipio, i + 1]));
    const doGrupo = todos.filter((l) => chavesVizinhas.includes(l.municipio));
    // Vizinhos que nem aparecem no relatório entram zerados: é informação útil
    // (mostra quem da região ficou de fora do critério neste ano).
    const ausentes = chavesVizinhas
      .filter((c) => !doGrupo.some((l) => l.municipio === c))
      .map((c) => ({
        municipio: c,
        municipio_nome: c,
        nota_final: 0,
        indice_percentual: 0,
      }));
    return [...doGrupo, ...ausentes]
      .sort((a, b) => b.nota_final - a.nota_final)
      .map((l, i) => ({
        ...l,
        posicaoRegional: i + 1,
        posicaoGeral: posicaoGeral.get(l.municipio) ?? null,
        ehMeu: l.municipio === chaveMunicipio,
      }));
  }, [ranking, chavesVizinhas, chaveMunicipio]);

  const lider = linhas[0] ?? null;
  const minhaLinha = linhas.find((l) => l.ehMeu) ?? null;

  /** Itens em que o município fica atrás de algum vizinho. */
  const lacunas = useMemo(() => {
    if (!chaveMunicipio) return [];
    const meus = pontosPorItem.get(chaveMunicipio);
    const codigos = new Set<string>();
    for (const [, itensDoMun] of pontosPorItem) for (const c of itensDoMun.keys()) codigos.add(c);
    const lista: { codigo: string; nome: string; meu: number; melhor: number; quem: string; quantos: number }[] =
      [];
    for (const codigo of codigos) {
      const meu = meus?.get(codigo)?.pontuacao ?? 0;
      let melhor = 0;
      let quem = "";
      let quantos = 0;
      let nome = "";
      for (const linha of linhas) {
        if (linha.ehMeu) continue;
        const p = pontosPorItem.get(linha.municipio)?.get(codigo);
        if (!p || p.pontuacao <= 0) continue;
        quantos += 1;
        nome = p.nome;
        if (p.pontuacao > melhor) {
          melhor = p.pontuacao;
          quem = linha.municipio_nome;
        }
      }
      if (melhor > meu) lista.push({ codigo, nome: nome || codigo, meu, melhor, quem, quantos });
    }
    return lista.sort((a, b) => b.melhor - b.meu - (a.melhor - a.meu));
  }, [pontosPorItem, linhas, chaveMunicipio]);

  const ganhoPossivel = lacunas.reduce((s, l) => s + (l.melhor - l.meu), 0);

  /** O que falta a um vizinho para alcançar quem lidera a região. */
  const faltaPara = (chave: string) => {
    if (!lider) return [];
    const doLider = pontosPorItem.get(lider.municipio);
    const dele = pontosPorItem.get(chave);
    if (!doLider) return [];
    const lista: { nome: string; diferenca: number }[] = [];
    for (const [codigo, p] of doLider) {
      const seu = dele?.get(codigo)?.pontuacao ?? 0;
      if (p.pontuacao > seu) lista.push({ nome: p.nome, diferenca: p.pontuacao - seu });
    }
    return lista.sort((a, b) => b.diferenca - a.diferenca).slice(0, 8);
  };

  if (!chaveMunicipio || !regiao) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Escolha a prefeitura em análise para comparar com os municípios vizinhos.
        </CardContent>
      </Card>
    );
  }

  if (!ranking?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          A comparação com os vizinhos aparece assim que o relatório oficial deste critério for
          importado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Vizinhança de {nomeMunicipio ?? "—"} — região de {regiao.imediata}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {linhas.length} municípios da mesma região imediata (IBGE), ordenados pela pontuação
              no critério.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              baixarCsv(
                `${slug}-vizinhos-${nomeMunicipio ?? "municipio"}.csv`,
                montarCsv(
                  ["Posição na região", "Município", "População", "Pontuação", "Posição geral"],
                  linhas.map((l) => [
                    String(l.posicaoRegional),
                    l.municipio_nome,
                    String(populacao.de(l.municipio_nome) ?? ""),
                    String(l.nota_final),
                    String(l.posicaoGeral ?? ""),
                  ]),
                ),
              )
            }
          >
            <Download className="mr-2 size-4" />
            CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Município</th>
                <th className="p-2 text-right">População</th>
                <th className="p-2 text-right">Pontuação</th>
                <th className="p-2 text-right">Diferença</th>
                <th className="p-2 text-right">Geral</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const diferenca = minhaLinha ? l.nota_final - minhaLinha.nota_final : 0;
                const expandido = aberto === l.municipio;
                const falta = expandido ? faltaPara(l.municipio) : [];
                return (
                  <Fragment key={l.municipio}>
                    <tr
                      className={l.ehMeu ? "bg-emerald-50 font-medium dark:bg-emerald-950/20" : ""}
                    >
                      <td className="p-2">{l.posicaoRegional}</td>
                      <td className="p-2">
                        {l.municipio_nome}
                        {l.ehMeu && (
                          <Badge className="ml-2 bg-emerald-600 text-white hover:bg-emerald-600">
                            em análise
                          </Badge>
                        )}
                      </td>
                      <td className="p-2 text-right tabular-nums">
                        {formatarPopulacao(populacao.de(l.municipio_nome))}
                      </td>
                      <td className="p-2 text-right tabular-nums">{num(l.nota_final)}</td>
                      <td
                        className={`p-2 text-right tabular-nums ${
                          diferenca > 0
                            ? "text-destructive"
                            : diferenca < 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {l.ehMeu ? "—" : `${diferenca > 0 ? "+" : ""}${num(diferenca)}`}
                      </td>
                      <td className="p-2 text-right text-muted-foreground tabular-nums">
                        {l.posicaoGeral ?? "fora"}
                      </td>
                      <td className="p-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAberto(expandido ? null : l.municipio)}
                        >
                          {expandido ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="bg-muted/30">
                        <td colSpan={7} className="p-3 text-sm">
                          {lider && l.municipio === lider.municipio ? (
                            <p className="text-muted-foreground">
                              {l.municipio_nome} lidera a região neste critério.
                            </p>
                          ) : falta.length ? (
                            <>
                              <p className="mb-1 text-xs text-muted-foreground">
                                O que falta a {l.municipio_nome} para alcançar{" "}
                                {lider?.municipio_nome}:
                              </p>
                              <ul className="list-disc space-y-0.5 pl-5">
                                {falta.map((f) => (
                                  <li key={f.nome}>
                                    {f.nome} —{" "}
                                    <span className="font-medium">
                                      +{num(f.diferenca)} {unidade}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className="text-muted-foreground">
                              O relatório não traz o detalhamento por item deste município.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            O que {nomeMunicipio ?? "o município"} precisa fazer para alcançar a vizinhança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!lacunas.length ? (
            <p className="text-muted-foreground">
              Nenhum vizinho pontua item que {nomeMunicipio ?? "o município"} deixou de pontuar
              neste relatório.
            </p>
          ) : (
            <>
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                Igualando o melhor vizinho em cada item, {nomeMunicipio ?? "o município"} somaria
                cerca de{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  +{num(ganhoPossivel)} {unidade}
                </span>{" "}
                neste critério.
              </div>
              {lacunas.map((l) => (
                <div key={l.codigo} className="rounded-md border p-3">
                  <p className="font-medium">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.quantos} vizinho(s) pontuam este item; o melhor é {l.quem} com{" "}
                    {num(l.melhor)} {unidade}. Hoje {nomeMunicipio ?? "o município"} tem{" "}
                    {num(l.meu)}.
                  </p>
                  <Badge className="mt-2 bg-emerald-600 text-white hover:bg-emerald-600">
                    +{num(l.melhor - l.meu)} {unidade} ao igualar
                  </Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
