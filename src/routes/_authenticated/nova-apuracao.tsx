import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { processarApuracao, type ProgressoEtapa } from "@/lib/vaf/processar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROTULO_TIPO_RETORNO,
  TIPOS_RETORNO,
  anoDoArquivo,
  sugerirTipoRetorno,
  type TipoRetorno,
} from "@/lib/vaf/tipoRetorno";


export const Route = createFileRoute("/_authenticated/nova-apuracao")({
  head: () => ({
    meta: [
      { title: "Nova apuração VAF" },
      {
        name: "description",
        content:
          "Envie os arquivos de contribuintes ativos e de retorno VAF/DAMEF da SEF-MG para gerar uma nova apuração.",
      },
      { property: "og:title", content: "Nova apuração VAF" },
      {
        property: "og:description",
        content: "Processe os arquivos da SEF-MG e gere a apuração VAF do município.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovaApuracao,
});

function NovaApuracao() {
  const { data: perfil } = usePerfil();
  const { municipioId } = useMunicipioAtivo();
  const navigate = useNavigate();
  const [ativos, setAtivos] = useState<File | null>(null);
  const [retorno, setRetorno] = useState<File | null>(null);
  const [tipoRetorno, setTipoRetorno] = useState<TipoRetorno>("mensal");
  const [mesReferencia, setMesReferencia] = useState<number | null>(null);
  const [competenciaMes, setCompetenciaMes] = useState<number | null>(null);
  const [competenciaAno, setCompetenciaAno] = useState<number | null>(null);
  const [limiar, setLimiar] = useState(30);
  const [dataLimite, setDataLimite] = useState("");
  const [progresso, setProgresso] = useState<ProgressoEtapa | null>(null);

  const [erro, setErro] = useState<string | null>(null);

  const processando = progresso !== null && progresso.percentual < 100;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!ativos || !retorno) {
      setErro("Selecione os dois arquivos da SEF-MG.");
      return;
    }
    let usuarioId = perfil?.id ?? null;
    if (!usuarioId) {
      const { data } = await supabase.auth.getUser();
      usuarioId = data.user?.id ?? null;
    }
    if (!usuarioId) {
      setErro("Sessão expirada. Entre novamente para processar a apuração.");
      return;
    }
    if (!municipioId) {
      setErro("Selecione um município antes de processar.");
      return;
    }
    setErro(null);
    setProgresso({ etapa: "Iniciando", percentual: 0 });
    try {
      const cargaId = await processarApuracao({
        municipioId,
        usuarioId,
        arquivoAtivos: ativos,
        arquivoRetorno: retorno,
        opcoes: {
          limiarDiscrepancia: limiar / 100,
          dataLimiteEntrega: dataLimite || null,
        },
        tipoRetorno,
        mesReferencia: tipoRetorno === "mensal" ? mesReferencia : null,
        competenciaMes: competenciaMes,
        competenciaAno: competenciaAno,
        onProgresso: setProgresso,

      });
      navigate({ to: "/cargas/$cargaId", params: { cargaId } });
    } catch (e) {
      setProgresso(null);
      setErro(e instanceof Error ? e.message : "Falha ao processar os arquivos.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova apuração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os arquivos são lidos no seu navegador e apenas o resultado é gravado no sistema.
        </p>
      </div>

      <form onSubmit={enviar}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Arquivos da SEF-MG</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ativos">Contribuintes ativos (P443AT…)</Label>
              <Input
                id="ativos"
                type="file"
                accept=".txt"
                required
                onChange={(e) => setAtivos(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retorno">Retorno VAF/DAMEF (P443RT…)</Label>
              <Input
                id="retorno"
                type="file"
                accept=".txt"
                required
                onChange={(e) => {
                  const arquivo = e.target.files?.[0] ?? null;
                  setRetorno(arquivo);
                  if (arquivo) {
                    const sugestao = sugerirTipoRetorno(arquivo.name);
                    setTipoRetorno(sugestao.tipo);
                    setMesReferencia(sugestao.mes);
                    setCompetenciaMes(sugestao.mes && sugestao.mes <= 12 ? sugestao.mes : null);
                    setCompetenciaAno(anoDoArquivo(arquivo.name));
                  }
                }}

              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo-retorno">Tipo de retorno</Label>
              <Select
                value={tipoRetorno}
                onValueChange={(v) => setTipoRetorno(v as TipoRetorno)}
              >
                <SelectTrigger id="tipo-retorno">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RETORNO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULO_TIPO_RETORNO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sugerido pelo nome do arquivo (remessa 13 = índice definitivo). Ajuste se
                necessário.
              </p>
            </div>

            {tipoRetorno === "mensal" && (
              <div className="space-y-2">
                <Label htmlFor="mes-referencia">Remessa/mês de referência</Label>
                <Input
                  id="mes-referencia"
                  type="number"
                  min={1}
                  max={13}
                  value={mesReferencia ?? ""}
                  onChange={(e) =>
                    setMesReferencia(e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="limiar">Limiar de discrepância (%)</Label>
                <Input
                  id="limiar"
                  type="number"
                  min={1}
                  max={100}
                  value={limiar}
                  onChange={(e) => setLimiar(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Variação do VAF em relação ao exercício anterior.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-limite">Data limite de entrega</Label>
                <Input
                  id="data-limite"
                  type="date"
                  value={dataLimite}
                  onChange={(e) => setDataLimite(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Em branco, usa 31/05 do ano seguinte ao exercício.
                </p>
              </div>
            </div>

            {progresso && (
              <div className="space-y-2">
                <Progress value={progresso.percentual} />
                <p className="text-xs text-muted-foreground">
                  {progresso.etapa} · {progresso.percentual}%
                </p>
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <Button type="submit" className="w-full" disabled={processando}>
              {processando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Processar apuração
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
