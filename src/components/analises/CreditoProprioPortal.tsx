import { useRef, useState } from "react";
import { AlertTriangle, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatarMoeda } from "@/lib/format";
import {
  aplicarNomesProdutores,
  detectarTipoPlanilha,
  lerCreditoPortal,
  lerProdutoresPortal,
  type ProdutoresPortal,
  type ResumoCreditoPortal,
} from "@/lib/vaf/creditoPortal";
import { decodificarArquivo } from "@/lib/vaf/parser";

/**
 * Bloco destacado do Crédito próprio (AF/SIARE): avisa quando o retorno não
 * trouxe o valor e permite carregar o relatório de créditos do Portal do VAF.
 * Usado na Análise do VAF (Índice) e na Evolução do VAF.
 */
export default function CreditoProprioPortal({
  codigoSef,
  planilha,
  onPlanilha,
  anoBaseArquivo,
  creditoInternoArquivo,
  perguntar,
  onPerguntarChange,
  contexto,
  creditoNoArquivo,
  produtores,
  onProdutores,
}: {
  codigoSef: string;
  planilha: ResumoCreditoPortal | null;
  onPlanilha: (r: ResumoCreditoPortal | null) => void;
  anoBaseArquivo?: number | null | undefined;
  creditoInternoArquivo?: number | undefined;
  /** abre a pergunta "deseja dar carga na planilha?" */
  perguntar?: boolean | undefined;
  onPerguntarChange?: ((v: boolean) => void) | undefined;
  /** texto curto identificando de onde veio a pergunta */
  contexto?: string | undefined;
  /** o próprio retorno (índice definitivo/provisório) já traz o crédito */
  creditoNoArquivo?: boolean | undefined;
  /** relatório de produtores rurais carregado sozinho (só nomes) */
  produtores?: ProdutoresPortal | null | undefined;
  onProdutores?: ((p: ProdutoresPortal | null) => void) | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionar(files: File[]) {
    setErro(null);
    if (files.length === 0) return;
    try {
      const lidos = await Promise.all(
        files.map(async (f) => ({
          nome: f.name,
          buffer: await f.arrayBuffer(),
        })),
      );
      const classificados = lidos.map((f) => ({
        ...f,
        tipo: detectarTipoPlanilha(decodificarArquivo(f.buffer)),
      }));

      const arquivoCreditos = classificados.find((f) => f.tipo === "creditos");
      const arquivoProdutores = classificados.find((f) => f.tipo === "produtores");
      const desconhecidos = classificados.filter((f) => f.tipo === "desconhecida");

      if (!arquivoCreditos && !arquivoProdutores) {
        setErro(
          `Nenhum dos arquivos é do Portal do VAF (${desconhecidos.map((f) => f.nome).join(", ")}).`,
        );
        return;
      }

      // só produtores: complementa os nomes (da planilha carregada ou do arquivo de índice)
      if (!arquivoCreditos) {
        if (!planilha && !creditoNoArquivo) {
          setErro(
            "Envie primeiro o relatório de créditos (REL_CREDITO_...). O de produtores rurais só complementa os nomes dos remetentes.",
          );
          return;
        }
        const lidosProdutores = lerProdutoresPortal(
          arquivoProdutores!.buffer,
          arquivoProdutores!.nome,
        );
        onProdutores?.(lidosProdutores);
        if (planilha) onPlanilha(aplicarNomesProdutores(planilha, lidosProdutores));
        toast.success(
          `Nomes de remetentes carregados: ${lidosProdutores.total.toLocaleString("pt-BR")} produtores.`,
        );
        return;
      }


      let resumo = lerCreditoPortal(arquivoCreditos.buffer, arquivoCreditos.nome, codigoSef);
      if (resumo.creditoProprio <= 0) {
        setErro("A planilha não trouxe notas de Crédito próprio com “ENTRA” para esta prefeitura.");
        onPlanilha(null);
        return;
      }
      if (arquivoProdutores) {
        const lidosProdutores = lerProdutoresPortal(
          arquivoProdutores.buffer,
          arquivoProdutores.nome,
        );
        onProdutores?.(lidosProdutores);
        resumo = aplicarNomesProdutores(resumo, lidosProdutores);
      }
      onPlanilha(resumo);
      toast.success(
        `Crédito próprio carregado: ${formatarMoeda(resumo.creditoProprio)} (${resumo.totalNotasProprio} notas).`,
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  // em arquivos de índice o crédito já vem do retorno: nada fica pendente
  const pendente = !planilha && !creditoNoArquivo;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          void selecionar([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />


      <div
        className={
          pendente
            ? "space-y-2 rounded-lg border-2 border-amber-500 bg-amber-500/10 p-3 shadow-[0_0_0_4px_hsl(38_92%_50%/0.12)]"
            : "space-y-2 rounded-lg border-2 border-emerald-600/60 bg-emerald-500/10 p-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              {pendente && <AlertTriangle className="h-4 w-4 shrink-0" />}
              {creditoNoArquivo && !planilha
                ? "Nomes dos remetentes (produtor rural)"
                : "Crédito próprio (AF/SIARE)"}
            </p>
            <p className="text-xs text-muted-foreground">
              {planilha
                ? `Vindo da planilha ${planilha.arquivoNome} — ${planilha.totalNotasProprio} notas, ano base ${planilha.anoBase ?? "—"}.`
                : creditoNoArquivo
                  ? produtores
                    ? `Nomes de remetentes: ${produtores.total.toLocaleString("pt-BR")} produtores de ${produtores.arquivoNome}${produtores.anoBase != null ? ` (ano base ${produtores.anoBase})` : ""}.`
                    : "Este arquivo de índice já traz o crédito próprio. Carregue apenas o relatório de produtores rurais do Portal do VAF (REL_PRODUTOR_RURAL_...) para exibir o nome dos remetentes."
                  : "O arquivo de retorno não trouxe o crédito próprio. Selecione, na mesma pasta, o relatório de créditos do Portal do VAF (REL_CREDITO_...) e, se quiser os nomes dos remetentes, também o de produtores rurais (REL_PRODUTOR_RURAL_...)."}
            </p>
            {planilha &&
              (planilha.produtores ? (
                <p className="text-xs text-muted-foreground">
                  Nomes de remetentes: {planilha.produtores.total.toLocaleString("pt-BR")} produtores
                  de {planilha.produtores.arquivoNome} —{" "}
                  {planilha.totalNotasProprio > 0
                    ? Math.round(
                        (planilha.produtores.notasIdentificadas / planilha.totalNotasProprio) * 100,
                      )
                    : 0}
                  % das notas identificadas.
                  {planilha.produtores.anoBase != null &&
                    planilha.anoBase != null &&
                    planilha.produtores.anoBase !== planilha.anoBase &&
                    ` Atenção: ano base ${planilha.produtores.anoBase} difere do relatório de créditos (${planilha.anoBase}).`}
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Sem os nomes dos remetentes. Envie também o relatório de produtores rurais
                  (REL_PRODUTOR_RURAL_...) — pode selecionar os dois CSVs juntos.
                </p>
              ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant={pendente ? "default" : "outline"}
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {planilha
                ? "Trocar planilha"
                : creditoNoArquivo
                  ? produtores
                    ? "Trocar nomes de remetentes"
                    : "Carregar nomes de remetentes"
                  : "Carregar planilha do Portal"}
            </Button>
            {(planilha || (creditoNoArquivo && produtores)) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (planilha) onPlanilha(null);
                  else onProdutores?.(null);
                }}
              >
                Remover
              </Button>
            )}
          </div>
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertTitle>Planilha não aproveitada</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        {planilha && (
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Crédito próprio (ENTRA)</span>
              <span className="font-mono font-medium">{formatarMoeda(planilha.creditoProprio)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Crédito interno da planilha (conferência)</span>
              <span className="font-mono">{formatarMoeda(planilha.creditoInterno)}</span>
            </div>
            {creditoInternoArquivo != null && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Diferença × arquivo de retorno</span>
                <span className="font-mono">
                  {formatarMoeda(planilha.creditoInterno - creditoInternoArquivo)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Notas “NÃO ENTRA” (fora da base)</span>
              <span className="font-mono">{formatarMoeda(planilha.naoEntra)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Frete (não somado)</span>
              <span className="font-mono">{formatarMoeda(planilha.frete)}</span>
            </div>
            {planilha.ignoradasOutroMunicipio > 0 && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Notas de outro município</span>
                <span className="font-mono">
                  {planilha.ignoradasOutroMunicipio} ·{" "}
                  {formatarMoeda(planilha.valorIgnoradoOutroMunicipio)}
                </span>
              </div>
            )}
            {planilha.anoBase != null &&
              anoBaseArquivo != null &&
              planilha.anoBase !== anoBaseArquivo && (
                <p className="text-amber-600 sm:col-span-2">
                  Atenção: o ano base da planilha ({planilha.anoBase}) é diferente do ano do arquivo
                  de retorno ({anoBaseArquivo}).
                </p>
              )}
          </div>
        )}
      </div>

      <AlertDialog open={!!perguntar} onOpenChange={(v) => onPerguntarChange?.(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crédito próprio (AF/SIARE) não encontrado</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo de retorno{contexto ? ` ${contexto}` : ""} não trouxe o VAF B — Crédito
              próprio (AF/SIARE). Deseja dar carga na planilha de créditos do Portal do VAF (CSV)
              para completar a projeção?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onPerguntarChange?.(false);
                setTimeout(() => inputRef.current?.click(), 50);
              }}
            >
              Carregar planilha do Portal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
