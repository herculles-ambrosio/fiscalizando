import { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { descricaoIndicador } from "@/lib/icms/educacao/glossario";
import {
  useDadosConstitutivosMunicipios,
  useMetadadosIndicadores,
  type VersaoEducacao,
} from "@/hooks/useEducacao";
import {
  direcaoDoIndicador,
  etapaDoIndicador,
  etapasAtendidas,
  separarColuna,
} from "@/lib/icms/educacao/indicadores";

/** Aba da planilha da FJP que compõe cada índice. */
export function abaDoIndice(nome: string): string | null {
  const n = nome.toUpperCase();
  if (n.includes("(IAE)") || n.includes("ATENDIMENTO")) return "Atendimento";
  if (n.includes("(IRAP)") || n.includes("DESEMPENHO")) return "Desempenho";
  if (n.includes("(IRE)") || n.includes("RENDIMENTO")) return "Rendimento";
  if (n.includes("(IGE)") || n.includes("GESTÃO") || n.includes("GESTAO")) return "Gestão";
  return null;
}

const fmt = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });

export function ComparacaoIndicadoresEducacao({
  exercicio,
  versao,
  aba,
  meu,
  meuNome,
  melhor,
  melhorNome,
}: {
  exercicio: number | null;
  versao: VersaoEducacao;
  aba: string;
  meu: string;
  meuNome: string;
  melhor: string;
  melhorNome: string;
}) {
  const { data, isLoading } = useDadosConstitutivosMunicipios(exercicio, versao, [meu, melhor]);
  const { data: direcoes } = useMetadadosIndicadores();

  const linhas = useMemo(() => {
    const doMeu = (data ?? []).filter((l) => l.municipio === meu);
    const doMelhor = (data ?? []).filter((l) => l.municipio === melhor);
    const atendidas = etapasAtendidas(doMeu);
    const mapa = direcoes ?? new Map();
    const colunas = new Set(
      [...doMeu, ...doMelhor]
        .filter((l) => separarColuna(l.coluna_origem).aba === aba)
        .map((l) => l.coluna_origem),
    );
    return [...colunas]
      .map((coluna) => {
        const { indicador } = separarColuna(coluna);
        const a = doMeu.find((l) => l.coluna_origem === coluna);
        const b = doMelhor.find((l) => l.coluna_origem === coluna);
        const vMeu = a?.valor_num ?? null;
        const vMelhor = b?.valor_num ?? null;
        const direcao = direcaoDoIndicador(indicador, mapa);
        const etapa = etapaDoIndicador(indicador);
        const naoAplica =
          (etapa === "anos_finais" && !atendidas.anosFinais) ||
          (etapa === "anos_iniciais" && !atendidas.anosIniciais);
        const dif = vMeu != null && vMelhor != null ? vMeu - vMelhor : null;
        // Positivo = município melhor que o vizinho, respeitando a direção.
        const desempenho = dif == null ? 0 : direcao === "menor_melhor" ? -dif : dif;
        return {
          coluna,
          indicador,
          vMeu,
          vMelhor,
          textoMeu: a?.valor_texto ?? null,
          textoMelhor: b?.valor_texto ?? null,
          dif,
          desempenho,
          naoAplica,
          direcao,
        };
      })
      .sort((x, y) => {
        if (x.naoAplica !== y.naoAplica) return x.naoAplica ? 1 : -1;
        const px = x.desempenho < 0 ? 0 : 1;
        const py = y.desempenho < 0 ? 0 : 1;
        if (px !== py) return px - py;
        return x.indicador.localeCompare(y.indicador);
      });
  }, [data, direcoes, meu, melhor, aba]);

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando indicadores…</p>;
  if (!linhas.length)
    return (
      <p className="text-xs text-muted-foreground">
        Não há dados constitutivos da FJP importados para este exercício. Importe a planilha na
        aba "Importar relatório" para ver o detalhamento.
      </p>
    );

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left uppercase text-muted-foreground">
            <th className="py-2">Indicador ({aba})</th>
            <th className="py-2 text-right">{melhorNome} (melhor)</th>
            <th className="py-2 text-right">{meuNome}</th>
            <th className="py-2 text-right">Diferença</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const texto = descricaoIndicador(l.indicador);
            return (
              <tr
                key={l.coluna}
                className={`border-b last:border-0 ${l.naoAplica ? "text-muted-foreground" : ""}`}
              >
                <td className="py-1.5 pr-3">
                  <span className="inline-flex items-center gap-1">
                    {l.indicador}
                    {l.direcao === "menor_melhor" && (
                      <span className="text-muted-foreground">(menor é melhor)</span>
                    )}
                    {texto && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" aria-label={`O que é ${l.indicador}`}>
                              <HelpCircle className="size-3.5 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{texto}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {l.naoAplica && <Badge variant="secondary">não se aplica</Badge>}
                  </span>
                </td>
                <td className="py-1.5 text-right">{l.vMelhor == null ? (l.textoMelhor ?? "—") : fmt(l.vMelhor)}</td>
                <td className="py-1.5 text-right">{l.vMeu == null ? (l.textoMeu ?? "—") : fmt(l.vMeu)}</td>
                <td
                  className={`py-1.5 text-right font-semibold ${
                    l.naoAplica || l.dif == null || l.desempenho === 0
                      ? "text-muted-foreground"
                      : l.desempenho < 0
                        ? "text-destructive"
                        : "text-emerald-600"
                  }`}
                >
                  {l.dif == null ? "—" : `${l.dif > 0 ? "+" : ""}${fmt(l.dif)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
