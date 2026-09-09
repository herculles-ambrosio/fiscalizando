/**
 * Números brutos que a Fundação João Pinheiro usou para calcular o índice de
 * Educação do município, comparados com a média dos demais municípios.
 *
 * A comparação crua gera falso alarme quando a rede municipal não atende a
 * etapa (sem aluno, o número é zero por ausência de base de cálculo) e quando o
 * indicador é uma taxa em que quanto menor, melhor. Por isso a tela separa o
 * que merece atenção, o que é resultado positivo e o que não se aplica.
 */

import { useMemo, useState } from "react";
import { ChevronDown, Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { baixarCsv, montarCsv } from "@/lib/csv";
import { useDadosConstitutivos, useMetadadosIndicadores, type VersaoEducacao } from "@/hooks/useEducacao";
import {
  classificar,
  direcaoDoIndicador,
  etapaDoIndicador,
  separarColuna,
  type Classificacao,
} from "@/lib/icms/educacao/indicadores";

function numeroBr(v: number | null): string {
  return v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

const ROTULO: Record<Classificacao, string> = {
  atencao: "Atenção",
  positivo: "Resultado positivo",
  neutro: "Dentro da média",
  nao_aplicavel: "Não se aplica",
};

type LinhaClassificada = {
  coluna_origem: string;
  indicador: string;
  valor_num: number | null;
  valor_texto: string | null;
  media: number | null;
  diferenca: number | null;
  classe: Classificacao;
};

function Tabela({ linhas }: { linhas: LinhaClassificada[] }) {
  return (
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
                ) : l.classe === "atencao" ? (
                  <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-600">
                    {l.diferenca > 0 ? "+" : ""}
                    {l.diferenca.toFixed(0)}%
                  </Badge>
                ) : l.classe === "positivo" ? (
                  <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
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
  );
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
  const { data: direcoes } = useMetadadosIndicadores();
  const [busca, setBusca] = useState("");

  const linhas = useMemo<LinhaClassificada[]>(() => {
    const atendidas = data?.atendidas ?? { anosIniciais: true, anosFinais: true };
    const mapa = direcoes ?? new Map();
    const lista = (data?.linhas ?? []).map((l) => {
      const media = data?.medias.get(l.coluna_origem) ?? null;
      const valor = l.valor_num;
      const diferenca = valor != null && media ? ((valor - media) / Math.abs(media)) * 100 : null;
      const { indicador } = separarColuna(l.coluna_origem);
      const classe = classificar({
        indicador,
        valor,
        diferenca,
        direcao: direcaoDoIndicador(indicador, mapa),
        etapa: etapaDoIndicador(indicador),
        atendidas,
      });
      return { ...l, indicador, media, diferenca, classe };
    });
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? lista.filter((l) => l.coluna_origem.toLowerCase().includes(termo))
      : lista;
    return filtradas.sort(
      (a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0),
    );
  }, [data, direcoes, busca]);

  const atencao = linhas.filter((l) => l.classe === "atencao");
  const positivos = linhas.filter((l) => l.classe === "positivo");
  const naoAplicaveis = linhas.filter((l) => l.classe === "nao_aplicavel");
  const atendidas = data?.atendidas ?? { anosIniciais: true, anosFinais: true };
  const etapasFora = [
    !atendidas.anosFinais ? "Anos Finais" : null,
    !atendidas.anosIniciais ? "Anos Iniciais" : null,
  ].filter(Boolean) as string[];

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
          {atencao.length
            ? `${atencao.length} indicador(es) merecem atenção — confira antes de decidir se cabe recurso.`
            : "Nenhum indicador fora da média que mereça atenção."}
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
                  [
                    "Indicador",
                    "Valor do município",
                    "Média estadual",
                    "Diferença (%)",
                    "Classificação",
                  ],
                  linhas.map((l) => [
                    l.coluna_origem,
                    l.valor_num ?? l.valor_texto ?? "",
                    l.media ?? "",
                    l.diferenca == null ? "" : l.diferenca.toFixed(1),
                    ROTULO[l.classe],
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
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !linhas.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum dado constitutivo importado para este exercício. Importe a planilha da FJP na aba
            de importação.
          </p>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Indicadores que merecem atenção{" "}
                <Badge className="ml-1 border-amber-500/40 bg-amber-500/10 text-amber-600">
                  {atencao.length}
                </Badge>
              </h3>
              {atencao.length ? (
                <Tabela linhas={atencao} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum indicador de etapa atendida está muito abaixo da média.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Resultados positivos{" "}
                <Badge className="ml-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
                  {positivos.length}
                </Badge>
              </h3>
              {positivos.length ? (
                <Tabela linhas={positivos} />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum destaque positivo.</p>
              )}
            </section>

            {naoAplicaveis.length ? (
              <Collapsible>
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-left text-sm">
                  <ChevronDown className="size-4 text-muted-foreground" />
                  <span className="font-semibold">Não aplicável a este município</span>
                  <Badge variant="secondary">{naoAplicaveis.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="mb-2 text-sm text-muted-foreground">
                    Rede municipal não atende {etapasFora.join(" e ") || "esta etapa"} — indicadores
                    desta etapa não se aplicam a este município (a rede estadual atende).
                  </p>
                  <Tabela linhas={naoAplicaveis} />
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
