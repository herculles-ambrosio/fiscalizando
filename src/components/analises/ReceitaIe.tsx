import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SituacaoReceitaBadge } from "@/components/SituacaoReceitaBadge";
import type { RegistroReceita } from "@/lib/receita/normalizar";
import { formatarData } from "@/lib/format";

/** Etiqueta da situação na Receita Federal para uma inscrição estadual. */
export function ReceitaIeBadge({
  registro,
  cnpj,
}: {
  registro: RegistroReceita | undefined;
  cnpj?: string | null;
}) {
  if (!registro) {
    return (
      <SituacaoReceitaBadge
        situacao={null}
        motivo={
          cnpj
            ? "CNPJ ainda não consultado na Receita Federal — use o botão Consultar Receita."
            : "Sem CNPJ no cadastro apurado para consultar a Receita Federal."
        }
      />
    );
  }
  const detalhes = [
    registro.situacao_data ? `Situação desde ${formatarData(registro.situacao_data)}` : null,
    registro.motivo ? `Motivo: ${registro.motivo}` : null,
    registro.consultado_em ? `Consultado em ${formatarData(registro.consultado_em)}` : null,
    registro.fonte ? `Fonte: ${registro.fonte}` : null,
  ].filter(Boolean);
  return <SituacaoReceitaBadge situacao={registro.situacao} motivo={detalhes.join(" · ")} />;
}

export function BotaoConsultarReceita({
  onConsultar,
  consultando,
  totalCnpjs,
  pendentes,
  semCnpj,
}: {
  onConsultar: () => void;
  consultando: boolean;
  totalCnpjs: number;
  pendentes: number;
  semCnpj: number;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={onConsultar}
      disabled={consultando || totalCnpjs === 0}
      title={
        totalCnpjs === 0
          ? "Nenhum CNPJ disponível nesta lista"
          : `${totalCnpjs} CNPJ(s) na lista · ${pendentes} sem consulta${semCnpj ? ` · ${semCnpj} sem CNPJ` : ""}`
      }
    >
      {consultando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      Consultar Receita
      {pendentes > 0 ? ` (${pendentes})` : ""}
    </Button>
  );
}
