import { useEffect, useRef, useState } from "react";
import { Eye, FileText, Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { usePerfil } from "@/hooks/usePerfil";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import {
  novaChave,
  useExcluirModelo,
  useModelos,
  useSalvarModelo,
} from "@/hooks/useModelos";
import {
  MODELOS_PADRAO,
  PLACEHOLDERS,
  ROTULO_SITUACAO,
  SITUACOES_OFICIO,
  type ModeloOficio,
  type SituacaoOficio,
} from "@/lib/oficios/modelos";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import { carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CONTRIBUINTE_EXEMPLO = {
  nome: "EMPRESA EXEMPLO LTDA",
  cnpj: "12345678000199",
  inscricao_estadual: "0011234567890",
  endereco: "RUA EXEMPLO, 100 - CENTRO",
};

export default function Modelos() {
  const { data: perfil } = usePerfil();
  const { data: config } = useConfiguracao();
  const { data: modelos, isLoading } = useModelos();
  const salvar = useSalvarModelo();
  const excluir = useExcluirModelo();

  const [chave, setChave] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<ModeloOficio | null>(null);
  const [previaBlob, setPreviaBlob] = useState<Blob | null>(null);
  const [gerandoPrevia, setGerandoPrevia] = useState(false);
  const previaRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLTextAreaElement | null>(null);

  const admin = perfil?.ehConsultoria || perfil?.papel === "prefeitura_admin";
  const personalizado = !!modelos?.find((m) => m.chave === rascunho?.chave && !!m.id);

  useEffect(() => {
    if (!modelos?.length) return;
    const atual = modelos.find((m) => m.chave === chave) ?? modelos[0]!;
    if (atual.chave !== chave) setChave(atual.chave);
    if (!rascunho || rascunho.chave !== atual.chave) setRascunho({ ...atual });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos, chave]);

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

  function atualizar(campos: Partial<ModeloOficio>) {
    setRascunho((r) => (r ? { ...r, ...campos } : r));
  }

  function inserirPlaceholder(texto: string) {
    const el = corpoRef.current;
    if (!el || !rascunho) return;
    const inicio = el.selectionStart ?? rascunho.corpo.length;
    const fim = el.selectionEnd ?? inicio;
    const novo = rascunho.corpo.slice(0, inicio) + texto + rascunho.corpo.slice(fim);
    atualizar({ corpo: novo });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + texto.length, inicio + texto.length);
    });
  }

  function criarModelo() {
    const nome = "Novo modelo";
    const modelo: ModeloOficio = {
      chave: novaChave(`${nome}_${Date.now()}`),
      nome,
      situacao: "GERAL",
      titulo: "OFÍCIO VAF {{exercicio}}",
      corpo: "Prezado,\n\n* Contribuinte: {{contribuinte}}\n* CNPJ: {{cnpj}}\n\nTexto do ofício.\n\nAtenciosamente.",
      ativo: true,
    };
    setChave(modelo.chave);
    setRascunho(modelo);
    setPreviaBlob(null);
  }

  async function verPrevia() {
    if (!rascunho) return;
    if (!config?.nome_prefeitura || !config.cidade_data) {
      toast.error("Preencha os dados da prefeitura em Configurações.");
      return;
    }
    setGerandoPrevia(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const blob = await gerarDocxOficio({
        modelo: rascunho,
        contribuinte: CONTRIBUINTE_EXEMPLO,
        config,
        exercicio: new Date().getFullYear() - 1,
        dataOficio: hojeIso(),
        brasao,
      });
      setPreviaBlob(blob);
    } catch (erro) {
      toast.error("Falha ao gerar a prévia.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setGerandoPrevia(false);
    }
  }

  async function gravar() {
    if (!rascunho) return;
    if (!rascunho.nome.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }
    try {
      await salvar.mutateAsync(rascunho);
      toast.success("Modelo salvo.");
    } catch (erro) {
      toast.error("Não foi possível salvar.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  async function restaurar() {
    if (!rascunho) return;
    const padrao = MODELOS_PADRAO.find((m) => m.chave === rascunho.chave);
    try {
      await excluir.mutateAsync(rascunho.chave);
      if (padrao) setRascunho({ ...padrao });
      else {
        setChave(null);
        setRascunho(null);
      }
      setPreviaBlob(null);
      toast.success(padrao ? "Modelo restaurado ao padrão." : "Modelo excluído.");
    } catch (erro) {
      toast.error("Não foi possível excluir.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Modelos de ofício</h1>
          <p className="text-sm text-muted-foreground">
            Textos usados na emissão dos ofícios por situação do contribuinte.
          </p>
        </div>
        {admin && (
          <Button variant="outline" onClick={criarModelo}>
            <Plus className="mr-2 h-4 w-4" />
            Novo modelo
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Modelos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              modelos?.map((m) => (
                <button
                  key={m.chave}
                  onClick={() => {
                    setChave(m.chave);
                    setRascunho({ ...m });
                    setPreviaBlob(null);
                  }}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    m.chave === rascunho?.chave ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span className="font-medium leading-tight">{m.nome}</span>
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {ROTULO_SITUACAO[m.situacao as SituacaoOficio] ?? m.situacao}
                    </Badge>
                    {!m.id && (
                      <span className="text-[10px] text-muted-foreground">padrão</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Edição do modelo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!rascunho ? (
              <p className="text-sm text-muted-foreground">Selecione um modelo à esquerda.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome do modelo</Label>
                    <Input
                      id="nome"
                      value={rascunho.nome}
                      disabled={!admin}
                      onChange={(e) => atualizar({ nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Situação atendida</Label>
                    <Select
                      value={rascunho.situacao}
                      disabled={!admin}
                      onValueChange={(v) => atualizar({ situacao: v as SituacaoOficio })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SITUACOES_OFICIO.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ROTULO_SITUACAO[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="titulo">Título do ofício</Label>
                  <Input
                    id="titulo"
                    value={rascunho.titulo}
                    disabled={!admin}
                    onChange={(e) => atualizar({ titulo: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cabecalho">Cabeçalho (opcional)</Label>
                  <Textarea
                    id="cabecalho"
                    rows={4}
                    className="font-mono text-xs"
                    placeholder={`Vazio = usa os dados da prefeitura das Configurações.\nEx.: {{prefeitura}}\nESTADO DE MINAS GERAIS`}
                    value={rascunho.cabecalho ?? ""}
                    disabled={!admin}
                    onChange={(e) => atualizar({ cabecalho: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Uma linha por linha do cabeçalho. A primeira linha sai em destaque. Campos
                    automáticos também funcionam aqui.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="corpo">Corpo do ofício</Label>
                  <Textarea
                    id="corpo"
                    ref={corpoRef}
                    rows={18}
                    className="font-mono text-xs"
                    value={rascunho.corpo}
                    disabled={!admin}
                    onChange={(e) => atualizar({ corpo: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Linha começando com <code>&gt;</code> vira citação em itálico, com{" "}
                    <code>#</code> vira linha centralizada em negrito e com <code>*</code> vira
                    campo no formato <code>* Rótulo: valor</code>. Linha em branco separa
                    parágrafos.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rodape">Rodapé (opcional)</Label>
                  <Textarea
                    id="rodape"
                    rows={3}
                    className="font-mono text-xs"
                    placeholder="Vazio = usa o endereço configurado da prefeitura."
                    value={rascunho.rodape ?? ""}
                    disabled={!admin}
                    onChange={(e) => atualizar({ rodape: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Margens da página (cm)</Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {MARGENS_CAMPOS.map((m) => (
                      <div key={m.campo} className="space-y-1.5">
                        <Label htmlFor={m.campo} className="text-xs text-muted-foreground">
                          {m.rotulo}
                        </Label>
                        <Input
                          id={m.campo}
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          disabled={!admin}
                          value={rascunho[m.campo] ?? MARGENS_PADRAO[m.campo]}
                          onChange={(e) =>
                            atualizar({
                              [m.campo]: e.target.value === "" ? undefined : Number(e.target.value),
                            } as Partial<ModeloOficio>)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>


                <div className="space-y-2">
                  <Label>Campos automáticos</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.chave}
                        type="button"
                        title={p.descricao}
                        disabled={!admin}
                        onClick={() => inserirPlaceholder(p.chave)}
                        className="rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {p.chave}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => void gravar()} disabled={!admin || salvar.isPending}>
                    {salvar.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar modelo
                  </Button>
                  <Button variant="outline" onClick={() => void verPrevia()} disabled={gerandoPrevia}>
                    {gerandoPrevia ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Ver prévia
                  </Button>
                  {admin && personalizado && (
                    <Button
                      variant="ghost"
                      onClick={() => void restaurar()}
                      disabled={excluir.isPending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      {MODELOS_PADRAO.some((m) => m.chave === rascunho.chave)
                        ? "Restaurar padrão"
                        : "Excluir modelo"}
                    </Button>
                  )}
                  <label className="ml-auto flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rascunho.ativo}
                      disabled={!admin}
                      onChange={(e) => atualizar({ ativo: e.target.checked })}
                    />
                    Disponível para emissão
                  </label>
                </div>

                {previaBlob && (
                  <div
                    ref={previaRef}
                    className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-2 [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-0 [&_.docx-wrapper>section.docx]:mx-auto [&_.docx-wrapper>section.docx]:shadow-sm"
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
