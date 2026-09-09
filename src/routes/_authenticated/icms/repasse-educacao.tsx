/**
 * Tela dedicada ao repasse do critério Educação: valor pago por município
 * (planilha enviada ou portal da FJP) comparado com o índice calculado a
 * partir do relatório importado.
 */

import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepasseEducacaoFjp } from "@/components/icms/RepasseEducacaoFjp";
import { VazioIcms } from "@/components/icms/VazioIcms";
import { useCriterioAnos, type FonteRelatorio } from "@/hooks/useCriterios";

export const Route = createFileRoute("/_authenticated/icms/repasse-educacao")({
  head: () => ({
    meta: [
      { title: "Repasse da Educação por município | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Compare o valor pago de ICMS do critério Educação em cada município com o índice calculado no relatório da FJP.",
      },
      { property: "og:title", content: "Repasse da Educação por município" },
      {
        property: "og:description",
        content:
          "Valor pago por município no critério Educação comparado com o índice calculado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RepasseEducacao,
});

function RepasseEducacao() {
  const { data: anos } = useCriterioAnos("educacao");
  const [combo, setCombo] = useState("");

  useEffect(() => {
    if (anos?.length && !combo) setCombo(`${anos[0]!.ano}|${anos[0]!.fonte}`);
  }, [anos, combo]);

  const [anoStr, fonteStr] = combo.split("|");
  const ano = anoStr ? Number(anoStr) : null;
  const fonte = (fonteStr as FonteRelatorio | undefined) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Repasse da Educação</h1>
          <p className="text-sm text-muted-foreground">
            Valor pago por município no critério Educação, comparado com o índice calculado a
            partir do relatório importado.
          </p>
        </div>
        {!!anos?.length && (
          <Select value={combo} onValueChange={setCombo}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Relatório" />
            </SelectTrigger>
            <SelectContent>
              {anos.map((a) => (
                <SelectItem key={`${a.ano}|${a.fonte}`} value={`${a.ano}|${a.fonte}`}>
                  {a.ano} — {a.fonte}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!anos?.length ? (
        <VazioIcms />
      ) : (
        <RepasseEducacaoFjp anoBase={ano} fonte={fonte} />
      )}
    </div>
  );
}
