import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmissoes } from "@/hooks/useEmissoes";
import { useModelos } from "@/hooks/useModelos";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { StatusEmissaoBadge } from "@/components/StatusEmissaoBadge";
import { useReemitirOficio } from "@/hooks/useReemitirOficio";
import type { EmissaoRegistro } from "@/lib/oficios/registro";
import { formatarCnpj, formatarDataHora } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/emissoes")({
  head: () => ({
    meta: [
      { title: "Histórico de ofícios emitidos" },
      {
        name: "description",
        content:
          "Consulte todos os ofícios VAF emitidos: data, usuário, município, exercício, modelo e status do download.",
      },
      { property: "og:title", content: "Histórico de ofícios emitidos" },
      {
        property: "og:description",
        content: "Rastreie a emissão de ofícios VAF por contribuinte, modelo e status do download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Emissoes,
});

function Emissoes() {
  const { municipio } = useMunicipioAtivo();
  const { data: modelos } = useModelos();
  const [busca, setBusca] = useState("");
  const [modeloChave, setModeloChave] = useState("todos");
  const [status, setStatus] = useState("todos");

  const [emitindoId, setEmitindoId] = useState<string | null>(null);
  const reemissao = useReemitirOficio();

  function reemitir(emissao: EmissaoRegistro) {
    setEmitindoId(emissao.id);
    reemissao.mutate(emissao, {
      onSuccess: () => toast.success("Ofício gerado novamente."),
      onError: (erro) =>
        toast.error("Falha ao gerar o ofício novamente.", {
          description: erro instanceof Error ? erro.message : undefined,
        }),
      onSettled: () => setEmitindoId(null),
    });
  }

  const { data, isLoading } = useEmissoes({
    busca,
    modeloChave: modeloChave === "todos" ? undefined : modeloChave,
    status: status === "todos" ? undefined : status,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Ofícios emitidos</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas as emissões {municipio ? `de ${municipio.nome}/${municipio.uf}` : ""} com
          data, usuário, exercício, modelo e status do download.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por contribuinte, CNPJ ou IE"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={modeloChave} onValueChange={setModeloChave}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Modelo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os modelos</SelectItem>
            {(modelos ?? []).map((m) => (
              <SelectItem key={m.chave} value={m.chave}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="baixado">Baixado</SelectItem>
            <SelectItem value="gerado">Gerado</SelectItem>
            <SelectItem value="erro">Falha</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contribuinte</TableHead>
                  <TableHead>CNPJ / IE</TableHead>
                  <TableHead>Exercício</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.length ? (
                  data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatarDataHora(e.criado_em)}
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-sm font-medium">
                        {e.nome_contribuinte ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatarCnpj(e.cnpj)}
                        <br />
                        IE {e.inscricao_estadual}
                      </TableCell>
                      <TableCell className="text-sm">{e.exercicio}</TableCell>
                      <TableCell className="text-sm">{e.modelo_nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {e.tipo_emissao === "lote" ? "Lote (ZIP)" : "Individual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{e.emitido_por_nome ?? "—"}</TableCell>
                      <TableCell>
                        <StatusEmissaoBadge status={e.status_download} />
                        {e.baixado_em && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatarDataHora(e.baixado_em)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reemitir(e)}
                          disabled={reemissao.isPending && emitindoId === e.id}
                        >
                          {reemissao.isPending && emitindoId === e.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileDown className="mr-2 h-3.5 w-3.5" />
                          )}
                          Baixar novamente
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      Nenhum ofício emitido ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
