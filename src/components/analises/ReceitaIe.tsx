import { useCallback, useMemo, useState } from "react";
import { Loader2, RefreshCw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SituacaoReceitaBadge } from "@/components/SituacaoReceitaBadge";
import type { RegistroReceita } from "@/lib/receita/normalizar";
import { formatarData } from "@/lib/format";
import { chaveIeReceita } from "@/lib/receita/porIe";
import {
  ProgressoConsultaReceita,
  type ProgressoReceita,
} from "@/components/receita/ProgressoConsultaReceita";
import type { ResumoSelecaoReceita } from "@/hooks/useReceitaPorIe";

/** Seleção de contribuintes (por inscrição estadual) para reconsulta imediata na Receita. */
export type SelecaoIes = {
  marcadas: string[];
  esta: (ie: string | null | undefined) => boolean;
  alternar: (ie: string | null | undefined, marcado: boolean) => void;
  definir: (ies: (string | null | undefined)[], marcado: boolean) => void;
  limpar: () => void;
};

export function useSelecaoIes(): SelecaoIes {
  const [marcadas, setMarcadas] = useState<string[]>([]);

  const alternar = useCallback((ie: string | null | undefined, marcado: boolean) => {
    const k = chaveIeReceita(ie);
    if (!k) return;
    setMarcadas((a) => (marcado ? [...new Set([...a, k])] : a.filter((x) => x !== k)));
  }, []);

  const definir = useCallback((ies: (string | null | undefined)[], marcado: boolean) => {
    const chaves = ies.map(chaveIeReceita).filter(Boolean);
    setMarcadas((a) =>
      marcado ? [...new Set([...a, ...chaves])] : a.filter((x) => !chaves.includes(x)),
    );
  }, []);

  return useMemo(
    () => ({
      marcadas,
      esta: (ie) => marcadas.includes(chaveIeReceita(ie)),
      alternar,
      definir,
      limpar: () => setMarcadas([]),
    }),
    [marcadas, alternar, definir],
  );
}

export function CaixaSelecaoIe({
  ie,
  sel,
  rotulo,
}: {
  ie: string | null | undefined;
  sel: SelecaoIes;
  rotulo?: string | null;
}) {
  return (
    <Checkbox
      checked={sel.esta(ie)}
      onCheckedChange={(v) => sel.alternar(ie, v === true)}
      aria-label={`Selecionar ${rotulo ?? ie ?? "contribuinte"} para reconsultar na Receita Federal`}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Caixa "marcar todos" de uma lista de inscrições. */
export function CaixaSelecaoTodas({
  ies,
  sel,
}: {
  ies: (string | null | undefined)[];
  sel: SelecaoIes;
}) {
  const chaves = ies.map(chaveIeReceita).filter(Boolean);
  const todas = chaves.length > 0 && chaves.every((k) => sel.marcadas.includes(k));
  return (
    <Checkbox
      checked={todas}
      disabled={chaves.length === 0}
      onCheckedChange={(v) => sel.definir(ies, v === true)}
      aria-label="Selecionar todos os contribuintes desta lista"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Barra de ação que aparece quando há contribuintes marcados. */
export function BarraSelecaoReceita({
  sel,
  onConsultar,
  consultando,
  progresso,
  resumo,
  onFecharResumo,
}: {
  sel: SelecaoIes;
  onConsultar: (ies: string[]) => void;
  consultando: boolean;
  progresso?: ProgressoReceita;
  resumo?: ResumoSelecaoReceita | null;
  onFecharResumo?: () => void;
}) {
  if (sel.marcadas.length === 0 && !resumo) return null;
  return (
    <div className="no-print space-y-2">
      {sel.marcadas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium">
            {sel.marcadas.length} contribuinte(s) selecionado(s)
          </span>
          <Button
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={consultando}
            onClick={() => onConsultar(sel.marcadas)}
          >
            {consultando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Consultar Receita dos selecionados
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={sel.limpar}>
            Limpar seleção
          </Button>
        </div>
      )}
      {progresso ? <ProgressoConsultaReceita progresso={progresso} /> : null}
      {resumo && !consultando ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-foreground">
            Reconsulta dos selecionados ({resumo.selecionados} contribuinte(s) ·{" "}
            {resumo.cnpjs} CNPJ(s)):
          </span>
          <span>{resumo.atualizados} atualizado(s)</span>
          <span>{resumo.cache} em cache</span>
          <span>{resumo.naoEncontrados} fora das bases públicas</span>
          <span>{resumo.falhas} sem resposta</span>
          {resumo.restantes ? <span>{resumo.restantes} restantes</span> : null}
          {onFecharResumo ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2 text-xs"
              onClick={onFecharResumo}
            >
              Fechar
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


/** Etiqueta da situação na Receita Federal para uma inscrição estadual. */
export function ReceitaIeBadge({
  registro,
  cnpj,
  origem,
}: {
  registro: RegistroReceita | undefined;
  cnpj?: string | null;
  /** De onde veio o CNPJ usado na consulta: cadastro apurado ou arquivo de retorno do VAF. */
  origem?: "cadastro" | "retorno" | null;
}) {
  const fonteCnpj =
    origem === "cadastro"
      ? "CNPJ obtido do cadastro apurado do município"
      : origem === "retorno"
        ? "CNPJ obtido do arquivo de retorno do VAF"
        : null;

  if (!registro) {
    return (
      <SituacaoReceitaBadge
        situacao={null}
        motivo={[
          cnpj
            ? "CNPJ ainda não consultado na Receita Federal — use o botão Consultar Receita."
            : "Sem CNPJ no cadastro apurado nem no retorno do VAF para consultar a Receita Federal.",
          fonteCnpj,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
    );
  }
  const detalhes = [
    registro.situacao_data ? `Situação desde ${formatarData(registro.situacao_data)}` : null,
    registro.motivo ? `Motivo: ${registro.motivo}` : null,
    registro.consultado_em ? `Consultado em ${formatarData(registro.consultado_em)}` : null,
    registro.fonte ? `Fonte: ${registro.fonte}` : null,
    fonteCnpj,
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

/** Reconsulta imediata apenas dos CNPJs que ficaram "sem resposta". */
export function BotaoReconsultarFalhas({
  total,
  onReconsultar,
  reconsultando,
}: {
  total: number;
  onReconsultar: () => void;
  reconsultando: boolean;
}) {
  if (total === 0) return null;
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-2"
      onClick={onReconsultar}
      disabled={reconsultando}
      title="Reconsulta agora apenas os CNPJs sem resposta das bases públicas. Eles também são reconsultados sozinhos, em horários escalonados."
    >
      {reconsultando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RotateCw className="h-3.5 w-3.5" />
      )}
      Reconsultar sem resposta ({total})
    </Button>
  );
}
