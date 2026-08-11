import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SituacaoBadge } from "@/components/SituacaoBadge";
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
import { formatarCnpj, formatarData, formatarMoeda, formatarPercentual } from "@/lib/format";


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
  situacoes: string[];
};

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
  const [gerando, setGerando] = useState(false);
  const [chaveModelo, setChaveModelo] = useState<string>("");

  const disponiveis = modelosParaSituacoes(modelos, contribuinte?.situacoes ?? []);
  const modelo = disponiveis.find((m) => m.chave === chaveModelo) ?? disponiveis[0] ?? null;
  const precisaOficio = disponiveis.length > 0;
  const configOk = !!config?.nome_prefeitura && !!config?.cidade_data;

  async function gerarOficio() {
    if (!contribuinte || !config || !modelo) return;
    setGerando(true);
    try {
      const brasao = await carregarBrasao(config.brasao_path);
      const alvo = {
        nome: contribuinte.nome,
        cnpj: contribuinte.cnpj,
        inscricao_estadual: contribuinte.inscricao_estadual,
        endereco: contribuinte.endereco,
      };
      const blob = await gerarDocxOficio({
        contribuinte: alvo,
        modelo,
        config,
        exercicio,
        dataOficio: hojeIso(),
        brasao,
      });
      baixarBlob(blob, nomeArquivoOficio(alvo));
      toast.success("Ofício gerado.");
    } catch (erro) {
      toast.error("Falha ao gerar o ofício.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
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
              {contribuinte.situacoes.map((s) => (
                <SituacaoBadge key={s} situacao={s} />
              ))}
            </div>

            {precisaOficio && (
              <div className="space-y-2 rounded-lg border p-3">
                <Button
                  className="w-full"
                  onClick={() => void gerarOficio()}
                  disabled={gerando || !configOk}
                >
                  {gerando ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Gerar ofício de retificação
                </Button>
                {!configOk && (
                  <p className="text-xs text-muted-foreground">
                    Preencha os dados da prefeitura em Configurações para emitir o ofício.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="CNAE" valor={contribuinte.cnae ?? "—"} />
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
