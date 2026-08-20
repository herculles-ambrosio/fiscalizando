import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  abrirAnexo,
  formatarTamanho,
  useAnexosAcao,
  useEnviarAnexo,
  useExcluirAnexo,
} from "@/hooks/useAnexosAcao";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  referencia: string | null;
  acaoChave: string;
  inscricaoEstadual?: string;
  observacaoAtual: string | null;
  onSalvarObservacao: (texto: string | null) => void;
};

export default function AnotacoesAcao({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  referencia,
  acaoChave,
  inscricaoEstadual = "",
  observacaoAtual,
  onSalvarObservacao,
}: Props) {
  const [texto, setTexto] = useState(observacaoAtual ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) setTexto(observacaoAtual ?? "");
  }, [aberto, observacaoAtual]);

  const { data: anexos } = useAnexosAcao(referencia);
  const enviar = useEnviarAnexo();
  const excluir = useExcluirAnexo();

  const meus = (anexos ?? []).filter(
    (a) => a.acao_chave === acaoChave && a.inscricao_estadual === inscricaoEstadual,
  );

  function selecionar(arquivos: FileList | null) {
    if (!arquivos?.length || !referencia) return;
    const lista = Array.from(arquivos);
    void Promise.all(
      lista.map((arquivo) =>
        enviar.mutateAsync({ referencia, acaoChave, inscricaoEstadual, arquivo }),
      ),
    )
      .then(() => toast.success(`${lista.length} anexo(s) enviado(s).`))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Falha ao enviar o anexo."),
      )
      .finally(() => {
        if (inputRef.current) inputRef.current.value = "";
      });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Observações e anexos</DialogTitle>
          <DialogDescription>
            {titulo}
            {subtitulo ? ` · ${subtitulo}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!referencia ? (
          <p className="text-sm text-muted-foreground">
            Salve ou carregue a evolução para gravar observações e anexos desta análise.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="obs-acao" className="text-xs">
                Observação
              </Label>
              <Textarea
                id="obs-acao"
                rows={4}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex.: contribuinte retificou a DAPI de agosto; aguardando protocolo da SEFAZ."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Anexos (comprovantes, protocolos, respostas)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={enviar.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  {enviar.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Anexar arquivo
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => selecionar(e.target.files)}
                />
              </div>

              {meus.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum anexo até agora.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {meus.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 p-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                        onClick={() =>
                          void abrirAnexo(a).catch(() =>
                            toast.error("Não foi possível abrir o anexo."),
                          )
                        }
                      >
                        {a.arquivo_nome}
                        <span className="ml-2 text-muted-foreground">
                          {formatarTamanho(a.tamanho)}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          excluir.mutate(a, {
                            onSuccess: () => toast.success("Anexo removido."),
                            onError: () => toast.error("Falha ao remover o anexo."),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
          <Button
            disabled={!referencia}
            onClick={() => {
              onSalvarObservacao(texto.trim() ? texto.trim() : null);
              onFechar();
            }}
          >
            Salvar observação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
