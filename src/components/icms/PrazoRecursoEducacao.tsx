/**
 * Janela de recurso administrativo do critério Educação.
 *
 * A FJP publica o índice provisório no fim de agosto e abre cerca de 15 dias
 * para contestação por e-mail; o definitivo sai até 30 de setembro. Esse é o
 * único período do ano em que corrigir um dado errado ainda muda o repasse,
 * então a tela mostra o prazo em destaque e deixa a consultoria ajustar as
 * datas de cada exercício.
 */

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarCalendarioEducacao } from "@/lib/icms/educacao.functions";
import { useCalendarioEducacao, useRecursosEducacao } from "@/hooks/useEducacao";

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

export function PrazoRecursoEducacao({
  exercicio,
  versao,
  municipio,
  consultoria,
}: {
  exercicio: number | null;
  versao: "provisorio" | "definitivo";
  municipio: string | null;
  consultoria: boolean;
}) {
  const cliente = useQueryClient();
  const { data: calendario } = useCalendarioEducacao(exercicio);
  const { data: recursos } = useRecursosEducacao(exercicio, municipio);
  const salvar = useServerFn(salvarCalendarioEducacao);

  const [provisorio, setProvisorio] = useState("");
  const [limite, setLimite] = useState("");
  const [definitivo, setDefinitivo] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setProvisorio(calendario?.data_publicacao_provisorio ?? "");
    setLimite(calendario?.data_limite_recurso ?? "");
    setDefinitivo(calendario?.data_publicacao_definitivo ?? "");
    setResolucao(calendario?.resolucao_referencia ?? "");
  }, [calendario]);

  async function gravar() {
    if (!exercicio) return;
    setSalvando(true);
    try {
      await salvar({
        data: {
          exercicio,
          dataPublicacaoProvisorio: provisorio || null,
          dataLimiteRecurso: limite || null,
          dataPublicacaoDefinitivo: definitivo || null,
          resolucaoReferencia: resolucao || null,
        },
      });
      await cliente.invalidateQueries({ queryKey: ["educacao-calendario"] });
      toast.success("Calendário atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o calendário.");
    } finally {
      setSalvando(false);
    }
  }

  const dias = calendario?.data_limite_recurso ? diasAte(calendario.data_limite_recurso) : null;
  const janelaAberta = versao === "provisorio" && dias != null && dias >= 0;
  const email = calendario?.email_recurso ?? "leirobin@fjp.mg.gov.br";

  return (
    <div className="space-y-4">
      {janelaAberta ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertTitle>
            Janela de recurso aberta até {formatarData(calendario!.data_limite_recurso)} — faltam{" "}
            {dias} {dias === 1 ? "dia" : "dias"}
          </AlertTitle>
          <AlertDescription>
            Revise os dados constitutivos do município na aba ao lado antes de decidir se há erro a
            contestar. O recurso é enviado por e-mail para {email}, com a indicação do dado
            contestado e a documentação comprobatória.
          </AlertDescription>
        </Alert>
      ) : versao === "provisorio" && exercicio ? (
        <Alert>
          <CalendarClock className="size-4" />
          <AlertTitle>Prazo de recurso encerrado para o exercício {exercicio}</AlertTitle>
          <AlertDescription>
            A próxima janela abre por volta de agosto de {exercicio}, quando a Fundação João Pinheiro
            publica o índice provisório do exercício seguinte.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/40 bg-emerald-500/10">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle>Índice definitivo publicado</AlertTitle>
          <AlertDescription>
            Os números deste exercício já incorporam o resultado dos recursos. A próxima
            oportunidade de correção é o índice provisório do exercício seguinte, em agosto.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendário do exercício {exercicio ?? "—"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {consultoria ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Publicação do provisório</Label>
                  <Input type="date" value={provisorio} onChange={(e) => setProvisorio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Prazo final de recurso</Label>
                  <Input type="date" value={limite} onChange={(e) => setLimite(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Publicação do definitivo</Label>
                  <Input type="date" value={definitivo} onChange={(e) => setDefinitivo(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Resolução conjunta SEE/FJP do ano</Label>
                <Input
                  placeholder="Resolução Conjunta SEE/FJP nº 13/2024"
                  value={resolucao}
                  onChange={(e) => setResolucao(e.target.value)}
                />
              </div>
              <Button onClick={gravar} disabled={salvando || !exercicio}>
                <Save className="mr-2 size-4" />
                Salvar calendário
              </Button>
            </>
          ) : (
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>Provisório: {formatarData(calendario?.data_publicacao_provisorio ?? null)}</p>
              <p>Prazo de recurso: {formatarData(calendario?.data_limite_recurso ?? null)}</p>
              <p>Definitivo: {formatarData(calendario?.data_publicacao_definitivo ?? null)}</p>
            </div>
          )}
          {calendario?.nota_tecnica && (
            <div className="rounded-md border p-3">
              <p className="mb-1 text-sm font-medium">Nota técnica da publicação</p>
              <p className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {calendario.nota_tecnica}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!!recursos?.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recursos administrativos julgados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recursos.map((r, i) => (
              <div key={`${r.municipio}-${i}`} className="rounded-md border p-2">
                <p className="font-medium">{r.municipio_nome}</p>
                <p className="text-muted-foreground">{r.item_contestado}</p>
                {r.resultado && <p className="text-xs">Resultado: {r.resultado}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
