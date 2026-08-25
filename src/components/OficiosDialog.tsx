import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, Eye, FileText, Loader2, Users } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { marcarStatusEmissoes, registrarEmissoes } from "@/lib/oficios/registro";
import { useModelos } from "@/hooks/useModelos";
import {
  baixarBlob,
  carregarBrasao,
  gerarZipOficios,
  nomeZip,
  type ProgressoOficios,
} from "@/lib/oficios/pacote";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import { ROTULO_SITUACAO, type ModeloOficio, type SituacaoOficio } from "@/lib/oficios/modelos";
import { hojeIso } from "@/lib/oficios/texto";
import { formatarCnpj } from "@/lib/format";
import type { ContribuinteOficio } from "@/lib/oficios/zerados";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useConsultarReceita, useSituacoesReceita } from "@/hooks/useSituacoesReceita";
import {
  limparCnpj,
  ROTULO_SITUACAO_RECEITA,
  SITUACOES_RECEITA,
  SITUACOES_RECEITA_ENCERRADAS,
  type SituacaoReceita,
} from "@/lib/receita/normalizar";

type ContribuinteLista = ContribuinteOficio & { id: string };

type Props = {
  cargaId: string;
  exercicio: number;
  selecionados: string[];
};

export function OficiosDialog({ cargaId, exercicio, selecionados }: Props) {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelos();
  const { municipioId } = useMunicipioAtivo();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [chaveModelo, setChaveModelo] = useState<string>("");
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

  const ativos = (modelos ?? []).filter((m) => m.ativo);
  const modelo: ModeloOficio | null =
    ativos.find((m) => m.chave === chaveModelo) ?? ativos[0] ?? null;
  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;

  // ---- Situação na Receita Federal: você escolhe para quais emitir ----
  const { data: receita } = useSituacoesReceita(lista.map((c) => c.cnpj));
  const consultaReceita = useConsultarReceita();
  const [permitidas, setPermitidas] = useState<(SituacaoReceita | "NAO_CONSULTADO")[]>([
    ...SITUACOES_RECEITA,
    "NAO_CONSULTADO",
  ]);

  const chaveReceita = (cnpj: string | null): SituacaoReceita | "NAO_CONSULTADO" => {
    const c = limparCnpj(cnpj);
    const reg = c ? receita?.[c] : null;
    return reg?.situacao ?? "NAO_CONSULTADO";
  };

  const contagemReceita = lista.reduce<Record<string, number>>((acc, c) => {
    const k = chaveReceita(c.cnpj);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  function filtrarPorReceita<T extends { cnpj: string | null }>(itens: T[]): T[] {
    return itens.filter((c) => permitidas.includes(chaveReceita(c.cnpj)));
  }

  const listaFinal = filtrarPorReceita(lista);
  const encerradasNaLista = SITUACOES_RECEITA_ENCERRADAS.reduce(
    (s, k) => s + (contagemReceita[k] ?? 0),
    0,
  );
  const alvo = listaFinal.find((c) => c.id === alvoId) ?? listaFinal[0] ?? null;

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
  }, [previaAtiva, dataOficio, escopo, alvoId, alvo?.id, modelo?.chave]);

  useEffect(() => {
    if (!aberto || !configOk || !modelo) return;
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
  }, [aberto, configOk, escopo, cargaId, modelo?.chave, selecionados.join(",")]);

  async function gerarPrevia() {
    if (!config || !modelo) return;
    if (!alvo) {
      toast.error("Nenhum contribuinte para pré-visualizar.");
      return;
    }
    setCarregandoPrevia(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const blob = await gerarDocxOficio({
        contribuinte: alvo,
        modelo,
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
      .order("nome");

    const situacao = modelo?.situacao as SituacaoOficio | undefined;
    if (situacao && situacao !== "GERAL") q = q.contains("situacoes", [situacao]);
    if (escopo === "selecionados") q = q.in("id", selecionados);

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as ContribuinteLista[];
  }

  async function gerar() {
    if (!config || !modelo) return;
    let ids: string[] = [];
    try {
      const contribuintes = filtrarPorReceita(await buscarContribuintes());
      if (!contribuintes.length) {
        toast.error("Nenhum contribuinte para este modelo.");
        return;
      }
      setProgresso({ fase: "documentos", feitos: 0, total: contribuintes.length });
      const nomeArquivoZip = nomeZip(
        modelo.chave,
        config.cidade_data.split("/")[0] ?? "municipio",
        exercicio,
      );
      if (municipioId) {
        ids = await registrarEmissoes({
          contribuintes,
          modelo,
          municipioId,
          cargaId,
          exercicio,
          tipo: "lote",
          arquivoNome: nomeArquivoZip,
        });
      }
      const zip = await gerarZipOficios({
        contribuintes,
        modelo,
        config,
        exercicio,
        dataOficio,
        brasaoPath: config.brasao_path,
        onProgresso: (p) => setProgresso(p),
      });
      baixarBlob(zip, nomeArquivoZip);
      await marcarStatusEmissoes(ids, "baixado");
      void queryClient.invalidateQueries({ queryKey: ["oficios-emitidos"] });
      toast.success(`${contribuintes.length} ofício(s) gerado(s).`, {
        description: "O download do ZIP foi iniciado.",
      });
      setTimeout(() => setAberto(false), 1200);
    } catch (erro) {
      await marcarStatusEmissoes(ids, "erro", erro instanceof Error ? erro.message : undefined);
      void queryClient.invalidateQueries({ queryKey: ["oficios-emitidos"] });
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
          Gerar ofícios
          {selecionados.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {selecionados.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emissão de ofícios</DialogTitle>
          <DialogDescription>
            Escolha o modelo; um arquivo .docx por empresa é entregue em um único ZIP.
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
              <Label>Modelo do ofício</Label>
              <Select value={modelo?.chave ?? ""} onValueChange={setChaveModelo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {ativos.map((m) => (
                    <SelectItem key={m.chave} value={m.chave}>
                      {m.nome} — {ROTULO_SITUACAO[m.situacao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <div className="flex items-center justify-between">
                <Label>Contribuintes</Label>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    selecionados.length > 0
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Users className="h-3 w-3" />
                  {selecionados.length} selecionado(s)
                </span>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={escopo === "todos"}
                    onChange={() => setEscopo("todos")}
                  />
                  Todos os contribuintes desta apuração compatíveis com o modelo
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
              {selecionados.length > 0 ? (
                <p className="text-xs text-primary">
                  A opção “Apenas os selecionados” gerará ofícios para {selecionados.length}{" "}
                  contribuinte(s).
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Para usar esta opção, marque os contribuintes na lista (caixas de seleção da
                  primeira coluna) antes de abrir este diálogo.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {carregandoLista
                  ? "Contando…"
                  : `${listaFinal.length} de ${lista.length} contribuinte(s) neste escopo (após o filtro da Receita).`}
              </p>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Situação na Receita Federal</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={consultaReceita.isPending || !lista.length}
                  onClick={() =>
                    consultaReceita.mutate(
                      { cnpjs: lista.map((c) => c.cnpj) },
                      {
                        onSuccess: (r) =>
                          toast.success(`Receita consultada: ${r.atualizados} atualizado(s).`),
                        onError: () => toast.error("Falha ao consultar a Receita Federal."),
                      },
                    )
                  }
                >
                  {consultaReceita.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Consultar Receita
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Marque para quais situações da Receita Federal o ofício deve ser emitido. Nada é
                bloqueado automaticamente — a escolha é sua.
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {([...SITUACOES_RECEITA, "NAO_CONSULTADO"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={permitidas.includes(s)}
                      onCheckedChange={(v) =>
                        setPermitidas((atual) =>
                          v === true ? [...new Set([...atual, s])] : atual.filter((x) => x !== s),
                        )
                      }
                    />
                    {ROTULO_SITUACAO_RECEITA[s]}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ({contagemReceita[s] ?? 0})
                    </span>
                  </label>
                ))}
              </div>
              {encerradasNaLista > 0 && (
                <p className="text-xs text-destructive">
                  Atenção: {encerradasNaLista} contribuinte(s) estão baixados ou com inscrição nula
                  na Receita Federal.
                </p>
              )}
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
                            : (alvo?.nome ?? "Nenhum contribuinte")}
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
                <p className="text-xs text-muted-foreground">Prévia de: {previaContribuinte}</p>
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
                  value={progresso.total > 0 ? (progresso.feitos / progresso.total) * 100 : 0}
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
            disabled={!configOk || !modelo || (!!progresso && progresso.fase !== "concluido")}
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
