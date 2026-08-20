import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SituacaoBadge } from "@/components/SituacaoBadge";
import { SituacaoCadastralBadge } from "@/components/SituacaoCadastralBadge";
import { REGIME_SIMEI, REGIME_SIMPLES_NACIONAL } from "@/lib/vaf/apurar";
import { formatarCnae } from "@/lib/vaf/cnae";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { useModelos, modelosParaSituacoes } from "@/hooks/useModelos";
import { baixarBlob, carregarBrasao } from "@/lib/oficios/pacote";
import { hojeIso } from "@/lib/oficios/texto";
import { gerarDocxOficio } from "@/lib/oficios/documento";
import { nomeArquivoOficio } from "@/lib/oficios/zerados";
import { marcarStatusEmissoes, registrarEmissoes } from "@/lib/oficios/registro";
import { useEmissoes } from "@/hooks/useEmissoes";
import { useReemitirOficio } from "@/hooks/useReemitirOficio";
import type { EmissaoRegistro } from "@/lib/oficios/registro";
import { StatusEmissaoBadge } from "@/components/StatusEmissaoBadge";
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda, formatarPercentual } from "@/lib/format";



export type ContribuinteLinha = {
  id: string;
  municipio_id: string;
  inscricao_estadual: string;
  cnpj: string | null;
  nome: string | null;
  endereco: string | null;
  cnae: string | null;
  entregou_declaracao: boolean;
  vaf_atual: number | null;
  vaf_anterior: number | null;
  variacao_pct: number | null;
  data_entrega: string | null;
  regime_recolhimento?: string | null;
  situacoes: string[];
  situacao_cadastral?: string | null;
  situacao_cadastral_data?: string | null;
  mes_inicio_atividade?: number | null;
  mes_fim_atividade?: number | null;
};

function rotuloRegime(regime: string | null): string {
  if (!regime) return "—";
  if (regime === REGIME_SIMEI) return `SIMEI (MEI) · ${regime}`;
  if (regime === REGIME_SIMPLES_NACIONAL) return `Simples Nacional · ${regime}`;
  return regime;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-medium break-words">{valor ?? "—"}</p>
    </div>
  );
}

export function ContribuinteDetalhe({
  contribuinte,
  exercicio,
  aberto,
  onOpenChange,
}: {
  contribuinte: ContribuinteLinha | null;
  exercicio: number;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: config } = useConfiguracao();
  const { data: modelos } = useModelos();
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);
  const [chaveModelo, setChaveModelo] = useState<string>("");
  const [reemitindoId, setReemitindoId] = useState<string | null>(null);
  const reemissao = useReemitirOficio();

  function reemitir(emissao: EmissaoRegistro) {
    setReemitindoId(emissao.id);
    reemissao.mutate(emissao, {
      onSuccess: () => toast.success("Ofício gerado novamente."),
      onError: (erro) =>
        toast.error("Falha ao gerar o ofício novamente.", {
          description: erro instanceof Error ? erro.message : undefined,
        }),
      onSettled: () => setReemitindoId(null),
    });
  }
  const { data: emissoes } = useEmissoes({
    ativo: aberto && !!contribuinte,
    inscricaoEstadual: contribuinte?.inscricao_estadual,
    limite: 30,
  });


  const disponiveis = modelosParaSituacoes(modelos, contribuinte?.situacoes ?? []);
  const modelo = disponiveis.find((m) => m.chave === chaveModelo) ?? disponiveis[0] ?? null;
  const precisaOficio = disponiveis.length > 0;
  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;

  async function gerarOficio() {
    if (!contribuinte || !config || !modelo) return;
    setGerando(true);
    let ids: string[] = [];
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const alvo = {
        id: contribuinte.id,
        nome: contribuinte.nome,
        cnpj: contribuinte.cnpj,
        inscricao_estadual: contribuinte.inscricao_estadual,
        endereco: contribuinte.endereco,
      };
      const nomeArquivo = nomeArquivoOficio(alvo);
      ids = await registrarEmissoes({
        contribuintes: [alvo],
        modelo,
        municipioId: contribuinte.municipio_id,
        exercicio,
        tipo: "individual",
        arquivoNome: nomeArquivo,
      });
      const blob = await gerarDocxOficio({
        contribuinte: alvo,
        modelo,
        config,
        exercicio,
        dataOficio: hojeIso(),
        brasao,
      });
      baixarBlob(blob, nomeArquivo);
      await marcarStatusEmissoes(ids, "baixado");
      toast.success("Ofício gerado.");
    } catch (erro) {
      await marcarStatusEmissoes(ids, "erro", erro instanceof Error ? erro.message : undefined);
      toast.error("Falha ao gerar o ofício.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["oficios-emitidos"] });
      setGerando(false);
    }
  }



  const { data: historico, isFetching } = useQuery({
    enabled: aberto && !!contribuinte,
    queryKey: ["contribuinte-historico", contribuinte?.municipio_id, contribuinte?.inscricao_estadual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribuintes_apurados")
        .select("id, carga_id, vaf_atual, vaf_anterior, variacao_pct, data_entrega, situacoes, cargas(exercicio, criado_em)")
        .eq("municipio_id", contribuinte!.municipio_id)
        .eq("inscricao_estadual", contribuinte!.inscricao_estadual)
        .limit(50);
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        const ea = (a.cargas as { exercicio: number } | null)?.exercicio ?? 0;
        const eb = (b.cargas as { exercicio: number } | null)?.exercicio ?? 0;
        return eb - ea;
      });
    },
  });

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">{contribuinte?.nome ?? "Contribuinte"}</SheetTitle>
          <SheetDescription className="text-left">
            IE {contribuinte?.inscricao_estadual} · {formatarCnpj(contribuinte?.cnpj ?? null)}
          </SheetDescription>
        </SheetHeader>

        {contribuinte && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-1">
              <SituacaoCadastralBadge situacao={contribuinte.situacao_cadastral} />
              {contribuinte.situacoes.map((s) => (
                <SituacaoBadge key={s} situacao={s} />
              ))}
            </div>

            {precisaOficio && (
              <div className="space-y-2 rounded-lg border p-3">
                <Select value={modelo?.chave ?? ""} onValueChange={setChaveModelo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modelo do ofício" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((m) => (
                      <SelectItem key={m.chave} value={m.chave}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={() => void gerarOficio()}
                  disabled={gerando || !configOk || !modelo}
                >
                  {gerando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Gerar ofício
                </Button>

                {!configOk && (
                  <p className="text-xs text-muted-foreground">
                    Preencha os dados da prefeitura em Configurações para emitir o ofício.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="CNAE" valor={formatarCnae(contribuinte.cnae)} />
              <Campo
                rotulo="Situação cadastral"
                valor={
                  <>
                    {ROTULO_SITUACAO_CADASTRAL[
                      (contribuinte.situacao_cadastral as SituacaoCadastral) ?? "DESCONHECIDA"
                    ] ?? "—"}
                    {contribuinte.situacao_cadastral_data
                      ? ` · desde ${formatarData(contribuinte.situacao_cadastral_data)}`
                      : ""}
                  </>
                }
              />
              <Campo
                rotulo="Período de atividade"
                valor={
                  contribuinte.mes_inicio_atividade || contribuinte.mes_fim_atividade
                    ? `mês ${contribuinte.mes_inicio_atividade ?? 1} a ${contribuinte.mes_fim_atividade ?? 12}`
                    : "ano inteiro"
                }
              />
              <Campo
                rotulo="Regime"
                valor={rotuloRegime(contribuinte.regime_recolhimento ?? null)}
              />
              <Campo
                rotulo="Declaração"
                valor={contribuinte.entregou_declaracao ? "Entregue" : "Não entregue"}
              />
              <Campo rotulo="Entrega" valor={formatarData(contribuinte.data_entrega)} />
              <Campo rotulo="Variação" valor={formatarPercentual(contribuinte.variacao_pct)} />
              <Campo rotulo="VAF atual" valor={formatarMoeda(contribuinte.vaf_atual)} />
              <Campo rotulo="VAF anterior" valor={formatarMoeda(contribuinte.vaf_anterior)} />
            </div>

            <Campo rotulo="Endereço" valor={contribuinte.endereco ?? "—"} />

            <Separator />

            <div>
              <h3 className="mb-3 text-sm font-semibold">Histórico de ofícios emitidos</h3>
              {emissoes?.length ? (
                <ul className="space-y-2">
                  {emissoes.map((e) => (
                    <li key={e.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{e.modelo_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            Exercício {e.exercicio} ·{" "}
                            {e.tipo_emissao === "lote" ? "Lote (ZIP)" : "Individual"}
                          </p>
                        </div>
                        <StatusEmissaoBadge status={e.status_download} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatarDataHora(e.criado_em)} · {e.emitido_por_nome ?? "—"}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => reemitir(e)}
                        disabled={reemissao.isPending && reemitindoId === e.id}
                      >
                        {reemissao.isPending && reemitindoId === e.id ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-3.5 w-3.5" />
                        )}
                        Baixar novamente
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum ofício emitido ainda.</p>
              )}
            </div>

            <Separator />



            <div>
              <h3 className="mb-3 text-sm font-semibold">Histórico de cargas</h3>
              {isFetching && !historico ? (
                <div className="flex h-20 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : historico?.length ? (
                <ul className="space-y-3">
                  {historico.map((h) => {
                    const carga = h.cargas as { exercicio: number; criado_em: string } | null;
                    return (
                      <li key={h.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            Exercício {carga?.exercicio ?? "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatarData(carga?.criado_em ?? null)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">VAF atual</p>
                            <p className="font-medium">{formatarMoeda(h.vaf_atual)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">VAF anterior</p>
                            <p className="font-medium">{formatarMoeda(h.vaf_anterior)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Variação</p>
                            <p className="font-medium">{formatarPercentual(h.variacao_pct)}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(h.situacoes as string[]).map((s) => (
                            <SituacaoBadge key={s} situacao={s} />
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma outra apuração registrada.</p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
