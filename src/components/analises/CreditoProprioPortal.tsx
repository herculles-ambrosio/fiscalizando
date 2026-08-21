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
import { lerCreditoPortal, type ResumoCreditoPortal } from "@/lib/vaf/creditoPortal";

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
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionar(file: File | null) {
    setErro(null);
    if (!file) return;
    try {
      const resumo = lerCreditoPortal(await file.arrayBuffer(), file.name, codigoSef);
      if (resumo.creditoProprio <= 0) {
        setErro("A planilha não trouxe notas de Crédito próprio com “ENTRA” para esta prefeitura.");
        onPlanilha(null);
        return;
      }
      onPlanilha(resumo);
      toast.success(
        `Crédito próprio carregado: ${formatarMoeda(resumo.creditoProprio)} (${resumo.totalNotasProprio} notas).`,
      );
    } catch (e) {
      onPlanilha(null);
      setErro(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
  }

  const pendente = !planilha;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          void selecionar(e.target.files?.[0] ?? null);
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
              Crédito próprio (AF/SIARE)
            </p>
            <p className="text-xs text-muted-foreground">
              {planilha
                ? `Vindo da planilha ${planilha.arquivoNome} — ${planilha.totalNotasProprio} notas, ano base ${planilha.anoBase ?? "—"}.`
                : "O arquivo de retorno não trouxe o crédito próprio. Envie o relatório de créditos do Portal do VAF (CSV) para completar a projeção."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={pendente ? "default" : "outline"}
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="mr-2 h-4 w-4" />
              {planilha ? "Trocar planilha" : "Carregar planilha do Portal"}
            </Button>
            {planilha && (
              <Button variant="ghost" size="sm" onClick={() => onPlanilha(null)}>
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
