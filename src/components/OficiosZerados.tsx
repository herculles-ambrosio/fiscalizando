import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, Eye, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import {
  baixarBlob,
  carregarBrasao,
  gerarZipOficiosZerados,
  nomeZip,
  type ProgressoOficios,
} from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { formatarCnpj } from "@/lib/format";
import { gerarDocxZerado, type ContribuinteOficio } from "@/lib/oficios/zerados";
import { cn } from "@/lib/utils";

type ContribuinteLista = ContribuinteOficio & { id: string };

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
  const [progresso, setProgresso] = useState<ProgressoOficios | null>(null);
  const [previaBlob, setPreviaBlob] = useState<Blob | null>(null);
  const [previaContribuinte, setPreviaContribuinte] = useState<string | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [lista, setLista] = useState<ContribuinteLista[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [alvoId, setAlvoId] = useState<string | null>(null);
  const [comboAberto, setComboAberto] = useState(false);
  const [previaAtiva, setPreviaAtiva] = useState(false);

  const previaRef = useRef<HTMLDivElement | null>(null);

  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;
  const alvo = lista.find((c) => c.id === alvoId) ?? lista[0] ?? null;

  useEffect(() => {
    if (!previaBlob || !previaRef.current) return;
    let cancelado = false;
    const destino = previaRef.current;
    (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelado) return;
      destino.innerHTML = "";
      await renderAsync(previaBlob, destino, undefined, {
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
    if (!previaAtiva) return;
    setPreviaBlob(null);
    if (!alvo) return;
    let cancelado = false;
    const id = setTimeout(() => {
      if (!cancelado) void gerarPrevia();
    }, 150);
    return () => {
      cancelado = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previaAtiva, dataOficio, escopo, alvoId, alvo?.id]);


  useEffect(() => {
    if (!aberto || !configOk) return;
    let cancelado = false;
    setCarregandoLista(true);
    buscarContribuintes()
      .then((dados) => {
        if (cancelado) return;
        setLista(dados);
        setAlvoId((atual) => (dados.some((c) => c.id === atual) ? atual : (dados[0]?.id ?? null)));
      })
      .catch(() => {
        if (!cancelado) toast.error("Não foi possível carregar a lista de contribuintes.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoLista(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, configOk, escopo, cargaId, selecionados.join(",")]);

  async function gerarPrevia() {
    if (!config) return;
    if (!alvo) {
      toast.error("Nenhum contribuinte zerado para pré-visualizar.");
      return;
    }
    setCarregandoPrevia(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const blob = await gerarDocxZerado({
        contribuinte: alvo,
        config,
        exercicio,
        dataOficio,
        brasao,
      });
      setPreviaContribuinte(alvo.nome ?? "—");
      setPreviaBlob(blob);
    } catch (erro) {
      toast.error("Falha ao gerar a prévia.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setCarregandoPrevia(false);
    }
  }

  async function buscarContribuintes(): Promise<ContribuinteLista[]> {
    let q = supabase
      .from("contribuintes_apurados")
      .select("id, nome, cnpj, inscricao_estadual, endereco")
      .eq("carga_id", cargaId)
      .contains("situacoes", ["ZERADO"])
      .order("nome");

    if (escopo === "selecionados") q = q.in("id", selecionados);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ContribuinteLista[];
  }


  async function gerar() {
    if (!config) return;
    try {
      const contribuintes = await buscarContribuintes();
      if (!contribuintes.length) {
        toast.error("Nenhum contribuinte zerado para gerar.");
        return;
      }
      setProgresso({ fase: "documentos", feitos: 0, total: contribuintes.length });
      const zip = await gerarZipOficiosZerados({
        contribuintes,
        config,
        exercicio,
        dataOficio,
        brasaoPath: config.brasao_path,
        onProgresso: (p) => setProgresso(p),
      });
      baixarBlob(zip, nomeZip(config.cidade_data.split("/")[0] ?? "municipio", exercicio));
      toast.success(`${contribuintes.length} ofício(s) gerado(s).`, {
        description: "O download do ZIP foi iniciado.",
      });
      setTimeout(() => setAberto(false), 1200);
    } catch (erro) {
      toast.error("Falha ao gerar os ofícios.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
      setProgresso(null);
    }
  }


  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (progresso && progresso.fase !== "concluido") return;
        if (v) setProgresso(null);
        setAberto(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Gerar ofícios de zerados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label>Contribuinte da prévia</Label>
                  <Popover open={comboAberto} onOpenChange={setComboAberto}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboAberto}
                        disabled={carregandoLista || !lista.length}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {carregandoLista
                            ? "Carregando contribuintes…"
                            : (alvo?.nome ?? "Nenhum contribuinte zerado")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou CNPJ…" />
                        <CommandList>
                          <CommandEmpty>Nenhum contribuinte encontrado.</CommandEmpty>
                          <CommandGroup>
                            {lista.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome ?? ""} ${c.cnpj ?? ""} ${c.inscricao_estadual}`}
                                onSelect={() => {
                                  setAlvoId(c.id);
                                  setComboAberto(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    alvo?.id === c.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <span className="truncate">
                                  {c.nome ?? "—"}
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {formatarCnpj(c.cnpj)}
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreviaAtiva(true);
                    void gerarPrevia();
                  }}
                  disabled={carregandoPrevia || !!progresso || !alvo}
                >
                  {carregandoPrevia ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {previaBlob ? "Atualizar prévia" : "Ver prévia"}
                </Button>

              </div>
              {previaBlob && (
                <p className="text-xs text-muted-foreground">
                  Prévia de: {previaContribuinte}
                </p>
              )}

              <div
                ref={previaRef}
                className={
                  previaBlob
                    ? "max-h-[45vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx-wrapper>section.docx]:mx-auto [&_.docx-wrapper>section.docx]:shadow-sm"
                    : "hidden"
                }
              />
            </div>

            {progresso && (
              <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    {progresso.fase === "concluido" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {progresso.fase === "documentos"
                      ? "Gerando ofícios"
                      : progresso.fase === "compactando"
                        ? "Compactando ZIP"
                        : "Concluído"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {progresso.fase === "compactando"
                      ? `${progresso.feitos}%`
                      : `${progresso.feitos} / ${progresso.total}`}
                  </span>
                </div>
                <Progress
                  value={
                    progresso.total > 0 ? (progresso.feitos / progresso.total) * 100 : 0
                  }
                />
                <p className="truncate text-xs text-muted-foreground">
                  {progresso.fase === "concluido"
                    ? `${progresso.total} ofício(s) prontos — download iniciado.`
                    : progresso.fase === "compactando"
                      ? "Montando o arquivo ZIP…"
                      : (progresso.nomeAtual ?? "Preparando…")}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={gerar}
            disabled={!configOk || (!!progresso && progresso.fase !== "concluido")}
          >
            {!!progresso && progresso.fase !== "concluido" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Gerar ZIP
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
