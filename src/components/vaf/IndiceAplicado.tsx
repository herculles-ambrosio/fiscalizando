import { Link } from "@tanstack/react-router";
import { Landmark, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda } from "@/lib/format";
import { formatarIndice } from "@/lib/vaf/indice";
import { useIndiceAplicado } from "@/hooks/useIndiceAplicado";

/**
 * Bloco padrão "Índice médio aplicado — base oficial".
 * Mostra o índice publicado pelo Estado que está valendo no exercício e,
 * quando informado, compara com o índice apurado na tela. Não altera cálculos.
 */
export function IndiceAplicadoBase({
  municipioId,
  exercicioAplicacao,
  indiceApurado,
  rotuloApurado = "índice apurado",
  className,
}: {
  municipioId: string | null;
  exercicioAplicacao: number | null;
  indiceApurado?: number | null;
  rotuloApurado?: string;
  className?: string;
}) {
  const { data, isLoading } = useIndiceAplicado(municipioId, exercicioAplicacao);

  if (!municipioId || !exercicioAplicacao || isLoading) return null;

  const base = "rounded-xl border border-border bg-muted/30 p-4" + (className ? ` ${className}` : "");

  if (!data) {
    return (
      <div className={base}>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Índice médio aplicado em {exercicioAplicacao} — base oficial
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A resolução da SEF-MG com os índices aplicados em {exercicioAplicacao} ainda não foi
          importada.{" "}
          <Link
            to="/consultoria/resolucao"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Importar agora
          </Link>
          .
        </p>
      </div>
    );
  }

  const media = data.media_indices == null ? null : Number(data.media_indices);
  const apurado = indiceApurado == null ? null : Number(indiceApurado);
  const delta = media != null && apurado != null ? apurado - media : null;
  const pct = delta != null && media ? (delta / media) * 100 : null;
  const positivo = (delta ?? 0) >= 0;

  return (
    <div className={base}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          Índice médio aplicado em {data.exercicio_aplicacao} — base oficial
        </p>
        <Badge variant="outline" className="text-[10px]">
          Resolução SEF {data.resolucao} · apuração {data.ano_a}/{data.ano_b}
        </Badge>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-3">
        <Item
          rotulo={`Índice ${data.ano_a}`}
          valor={data.indice_a == null ? "—" : `${formatarIndice(Number(data.indice_a))}%`}
          nota={data.vaf_a == null ? undefined : `VAF ${formatarMoeda(Number(data.vaf_a))}`}
        />
        <Item
          rotulo={`Índice ${data.ano_b}`}
          valor={data.indice_b == null ? "—" : `${formatarIndice(Number(data.indice_b))}%`}
          nota={data.vaf_b == null ? undefined : `VAF ${formatarMoeda(Number(data.vaf_b))}`}
        />
        <Item
          rotulo={`Média aplicada em ${data.exercicio_aplicacao}`}
          valor={media == null ? "—" : `${formatarIndice(media)}%`}
          destaque
        />
      </div>

      {delta != null && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={
              positivo
                ? "inline-flex items-center gap-1 font-mono text-emerald-600"
                : "inline-flex items-center gap-1 font-mono text-destructive"
            }
          >
            {positivo ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {positivo ? "+" : "−"}
            {formatarIndice(Math.abs(delta))}
            {pct != null && (
              <>
                {" "}
                ({positivo ? "+" : "−"}
                {Math.abs(pct).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)
              </>
            )}
          </span>
          <span>
            — o {rotuloApurado} está {positivo ? "acima" : "abaixo"} do índice médio aplicado.
          </span>
        </p>
      )}
    </div>
  );
}

function Item({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string | undefined;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={destaque ? "font-mono text-base font-semibold" : "font-mono text-sm"}>{valor}</p>
      {nota && <p className="font-mono text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}
