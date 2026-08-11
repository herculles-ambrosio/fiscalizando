import { useEffect, useRef, useState } from "react";
import { Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { baixarBlob, carregarBrasao, gerarZipOficiosZerados, nomeZip } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { gerarDocxZerado, type ContribuinteOficio } from "@/lib/oficios/zerados";

type Props = {
  cargaId: string;
  exercicio: number;
  selecionados: string[];
};

export function OficiosZerados({ cargaId, exercicio, selecionados }: Props) {
  const { data: config } = useConfiguracao();
  const [aberto, setAberto] = useState(false);
  const [dataOficio, setDataOficio] = useState(hojeIso());
  const [escopo, setEscopo] = useState<"todos" | "selecionados">("todos");
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [previaBlob, setPreviaBlob] = useState<Blob | null>(null);
  const [previaContribuinte, setPreviaContribuinte] = useState<string | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const previaRef = useRef<HTMLDivElement | null>(null);

  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;

  useEffect(() => {
    if (!previaBlob || !previaRef.current) return;
    let cancelado = false;
    const alvo = previaRef.current;
    (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      alvo.innerHTML = "";
      await renderAsync(previaBlob, alvo, undefined, {
        className: "docx",
        inWrapper: true,
        ignoreHeight: true,
        ignoreWidth: false,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [previaBlob]);

  useEffect(() => {
    setPreviaBlob(null);
  }, [dataOficio, escopo]);

  async function gerarPrevia() {
    if (!config) return;
    setCarregandoPrevia(true);
    try {
      const contribuintes = await buscarContribuintes(1);
      const primeiro = contribuintes[0];
      if (!primeiro) {
        toast.error("Nenhum contribuinte zerado para pré-visualizar.");
        return;
      }
      const brasao = await carregarBrasao(config.brasao_path);
      const blob = await gerarDocxZerado({
        contribuinte: primeiro,
        config,
        exercicio,
        dataOficio,
        brasao,
      });
      setPreviaContribuinte(primeiro.nome ?? "—");
      setPreviaBlob(blob);
    } catch (erro) {
      toast.error("Falha ao gerar a prévia.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setCarregandoPrevia(false);
    }
  }


  async function buscarContribuintes(limite?: number): Promise<ContribuinteOficio[]> {
    let q = supabase
      .from("contribuintes_apurados")
      .select("id, nome, cnpj, inscricao_estadual, endereco")
      .eq("carga_id", cargaId)
      .contains("situacoes", ["ZERADO"])
      .order("nome");

    if (escopo === "selecionados") q = q.in("id", selecionados);
    if (limite) q = q.limit(limite);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ContribuinteOficio[];
  }

  async function gerar() {
    if (!config) return;
    try {
      const contribuintes = await buscarContribuintes();
      if (!contribuintes.length) {
        toast.error("Nenhum contribuinte zerado para gerar.");
        return;
      }
      setProgresso({ feitos: 0, total: contribuintes.length });
      const zip = await gerarZipOficiosZerados({
        contribuintes,
        config,
        exercicio,
        dataOficio,
        brasaoPath: config.brasao_path,
        onProgresso: (feitos, total) => setProgresso({ feitos, total }),
      });
      baixarBlob(zip, nomeZip(config.cidade_data.split("/")[0] ?? "municipio", exercicio));
      toast.success(`${contribuintes.length} ofício(s) gerado(s).`);
      setAberto(false);
    } catch (erro) {
      toast.error("Falha ao gerar os ofícios.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setProgresso(null);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !progresso && setAberto(v)}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Gerar ofícios de zerados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ofícios de retificação — zerados</DialogTitle>
          <DialogDescription>
            Um arquivo .docx por empresa, entregues em um único ZIP.
          </DialogDescription>
        </DialogHeader>

        {!configOk ? (
          <p className="text-sm text-muted-foreground">
            Preencha primeiro os dados da prefeitura em <strong>Configurações</strong> (nome da
            prefeitura e cidade/UF) para gerar os ofícios.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="data-oficio">Data do ofício</Label>
              <Input
                id="data-oficio"
                type="date"
                value={dataOficio}
                onChange={(e) => setDataOficio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Contribuintes</Label>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={escopo === "todos"}
                    onChange={() => setEscopo("todos")}
                  />
                  Todos os zerados desta apuração
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={escopo === "selecionados"}
                    disabled={!selecionados.length}
                    onChange={() => setEscopo("selecionados")}
                  />
                  Apenas os selecionados ({selecionados.length})
                </label>
              </div>
            </div>

            {progresso && (
              <div className="space-y-1.5">
                <Progress value={(progresso.feitos / progresso.total) * 100} />
                <p className="text-xs text-muted-foreground">
                  Gerando {progresso.feitos} de {progresso.total}…
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={gerar} disabled={!configOk || !!progresso}>
            {progresso && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
