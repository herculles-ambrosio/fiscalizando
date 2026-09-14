/**
 * Detalhe das providências de um município no exercício comparado:
 * o plano de recuperação contribuinte a contribuinte, os ofícios emitidos
 * e as impugnações montadas.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusEmissaoBadge } from "@/components/StatusEmissaoBadge";
import { cn } from "@/lib/utils";
import {
  CORES_STATUS_ACAO,
  ROTULO_STATUS_ACAO,
  STATUS_ACAO,
  type StatusAcao,
} from "@/hooks/useAcoesRecuperacao";
import { rotuloStatus } from "@/hooks/useImpugnacoes";
import { useOficiosMunicipio, type AcaoPanorama } from "@/hooks/usePanoramaMunicipios";
import type { LinhaPanorama } from "@/lib/vaf/panorama";
import { diferencaItem } from "@/lib/vaf/impugnacao";
import { formatarCnpj, formatarData, formatarDataHora, formatarMoeda } from "@/lib/format";

export type AbaPlano = "plano" | "oficios" | "impugnacoes";

const rotuloAcao = (s: string): string => ROTULO_STATUS_ACAO[s as StatusAcao] ?? s;

function StatusAcaoBadge({ status }: { status: string }) {
  const classe = CORES_STATUS_ACAO[status as StatusAcao] ?? "border-border bg-muted";
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", classe)}>
      {rotuloAcao(status)}
    </Badge>
  );
}

function Vazio({ texto, acao }: { texto: string; acao?: { rotulo: string; onClick: () => void } }) {
  return (
    <div className="space-y-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p>{texto}</p>
      {acao && (
        <Button size="sm" variant="outline" onClick={acao.onClick}>
          {acao.rotulo}
        </Button>
      )}
    </div>
  );
}

export function PlanoMunicipio({
  linha,
  exercicio,
  aba,
  onAba,
  irPara,
}: {
  linha: LinhaPanorama;
  exercicio: number;
  aba: AbaPlano;
  onAba: (a: AbaPlano) => void;
  irPara: (destino: "analises" | "oficios" | "impugnacoes") => void;
}) {
  const acoes = linha.providencias.acoesDetalhe;
  const impugnacoes = linha.providencias.impugnacoes;
  const { data: oficios, isLoading: carregandoOficios } = useOficiosMunicipio(
    linha.municipioId,
    exercicio,
  );

  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [texto, setTexto] = useState("");

  const acoesVisiveis = useMemo(() => {
    const termo = texto.trim().toLowerCase();
    return acoes.filter((a: AcaoPanorama) => {
      if (statusFiltro !== "todos" && a.status !== statusFiltro) return false;
      if (!termo) return true;
      return (
        (a.nome_contribuinte ?? "").toLowerCase().includes(termo) ||
        a.inscricao_estadual.toLowerCase().includes(termo) ||
        (a.cnpj ?? "").includes(termo)
      );
    });
  }, [acoes, statusFiltro, texto]);

  const total = acoes.reduce((s, a) => s + Number(a.valor_recuperavel ?? 0), 0);
  const contribuintes = new Set(acoes.map((a) => a.inscricao_estadual || a.id)).size;

  return (
    <Tabs value={aba} onValueChange={(v) => onAba(v as AbaPlano)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="plano">Plano ({acoes.length})</TabsTrigger>
        <TabsTrigger value="oficios">
          Ofícios ({oficios?.length ?? linha.providencias.oficios})
        </TabsTrigger>
        <TabsTrigger value="impugnacoes">Impugnações ({impugnacoes.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="plano" className="space-y-3">
        {acoes.length ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Resumo rotulo="Contribuintes" valor={String(contribuintes)} />
              <Resumo rotulo="Valor no plano" valor={formatarMoeda(total)} />
              <Resumo rotulo="Com ofício enviado" valor={String(linha.providencias.acoesOficio)} />
              <Resumo rotulo="Concluídas" valor={String(linha.providencias.acoesConcluidas)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-52"
                placeholder="Buscar nome, IE ou CNPJ"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as situações</SelectItem>
                  {STATUS_ACAO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ROTULO_STATUS_ACAO[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contribuinte</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead className="text-right">A recuperar</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acoesVisiveis.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium">{a.nome_contribuinte ?? "—"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          IE {a.inscricao_estadual || "—"}
                          {a.cnpj ? ` · ${formatarCnpj(a.cnpj)}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">{a.acao_titulo}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatarMoeda(Number(a.valor_recuperavel ?? 0))}
                      </TableCell>
                      <TableCell>
                        <StatusAcaoBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!acoesVisiveis.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        Nenhum contribuinte com esse filtro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <Vazio
            texto={`Nenhuma ação registrada no plano de recuperação de ${exercicio}.`}
            acao={{ rotulo: "Abrir Análises do VAF", onClick: () => irPara("analises") }}
          />
        )}
      </TabsContent>

      <TabsContent value="oficios" className="space-y-3">
        {carregandoOficios ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : oficios?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contribuinte</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Emitido por</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oficios.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatarDataHora(o.criado_em)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{o.nome_contribuinte ?? "—"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        IE {o.inscricao_estadual}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{o.modelo_nome}</TableCell>
                    <TableCell className="text-xs">{o.emitido_por_nome ?? "—"}</TableCell>
                    <TableCell>
                      <StatusEmissaoBadge status={o.status_download} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Vazio
            texto={`Nenhum ofício emitido em ${exercicio}.`}
            acao={{ rotulo: "Abrir Ofícios", onClick: () => irPara("oficios") }}
          />
        )}
      </TabsContent>

      <TabsContent value="impugnacoes" className="space-y-3">
        {impugnacoes.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impugnação</TableHead>
                  <TableHead className="text-right">Contribuintes</TableHead>
                  <TableHead className="text-right">VAF contestado</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impugnacoes.map((i) => {
                  const itens = i.itens ?? [];
                  const contestado = itens.reduce((s, it) => s + diferencaItem(it), 0);
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <p className="font-medium">{i.nome}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Exercício {i.exercicio}
                          {i.ano_base ? ` · ano-base ${i.ano_base}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{itens.length}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatarMoeda(contestado)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {i.protocolo_numero ? `SEI ${i.protocolo_numero}` : "sem protocolo"}
                        {i.protocolado_em ? ` · ${formatarData(i.protocolado_em)}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="whitespace-nowrap">
                          {rotuloStatus(i.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Vazio
            texto={`Nenhuma impugnação montada para ${exercicio}.`}
            acao={{ rotulo: "Abrir Impugnações", onClick: () => irPara("impugnacoes") }}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{rotulo}</p>
      <p className="mt-0.5 font-medium tabular-nums">{valor}</p>
    </div>
  );
}
