import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nomeMunicipioSef } from "@/lib/vaf/municipiosSef";
import { normalizarCodigoSef } from "@/lib/vaf/municipioArquivo";

export const Route = createFileRoute("/_authenticated/consultoria/codigos-sef")({
  head: () => ({
    meta: [
      { title: "Códigos SEF das prefeituras | Apura VAF 2.0" },
      {
        name: "description",
        content:
          "Revise e corrija o código SEF-MG e o nome oficial de cada prefeitura cadastrada no Apura VAF.",
      },
      { property: "og:title", content: "Códigos SEF das prefeituras | Apura VAF 2.0" },
      {
        property: "og:description",
        content: "Confira o código SEF de cada prefeitura contra a tabela oficial da SEF-MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CodigosSef,
});

type Cadastro = { id: string; nome: string; uf: string; codigo_sef: string };

function CodigosSef() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [rascunho, setRascunho] = useState<Record<string, { nome: string; codigo: string }>>({});
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [aplicandoLote, setAplicandoLote] = useState(false);

  const podeEditar = !!perfil?.ehSuperadmin;

  const { data, isLoading } = useQuery({
    queryKey: ["municipios-sef-admin"],
    queryFn: async (): Promise<Cadastro[]> => {
      const { data, error } = await supabase
        .from("municipios")
        .select("id, nome, uf, codigo_sef")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data ?? [])
      .map((m) => {
        const codigo = normalizarCodigoSef(m.codigo_sef);
        const oficial = nomeMunicipioSef(codigo);
        const divergente =
          !!oficial && m.nome.trim().toLocaleLowerCase("pt-BR") !== oficial.toLocaleLowerCase("pt-BR");
        return { ...m, codigo, oficial, divergente };
      })
      .filter(
        (m) =>
          !termo ||
          m.nome.toLowerCase().includes(termo) ||
          (m.oficial ?? "").toLowerCase().includes(termo) ||
          (m.codigo ?? "").includes(termo),
      );
  }, [data, busca]);

  const linhasDivergentes = linhas.filter((l) => l.divergente);
  const divergentes = linhasDivergentes.length;
  const semCodigo = linhas.filter((l) => !l.oficial).length;

  const selecionadosVisiveis = linhasDivergentes.filter((l) => selecionados.includes(l.id));
  const todosSelecionados =
    linhasDivergentes.length > 0 && selecionadosVisiveis.length === linhasDivergentes.length;

  function alternarSelecao(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function aplicarOficialEmLote() {
    const alvos = linhasDivergentes.filter((l) => selecionados.includes(l.id) && l.oficial);
    if (alvos.length === 0) {
      toast.error("Selecione ao menos um cadastro divergente.");
      return;
    }
    setAplicandoLote(true);
    let sucesso = 0;
    const falhas: string[] = [];
    for (const alvo of alvos) {
      const { error } = await supabase
        .from("municipios")
        .update({ nome: alvo.oficial!, codigo_sef: alvo.codigo! })
        .eq("id", alvo.id);
      if (error) falhas.push(`${alvo.nome}: ${error.message}`);
      else sucesso++;
    }
    setAplicandoLote(false);
    setSelecionados([]);
    setRascunho({});
    await queryClient.invalidateQueries({ queryKey: ["municipios-sef-admin"] });
    await queryClient.invalidateQueries({ queryKey: ["municipios"] });
    await queryClient.invalidateQueries({ queryKey: ["carteira"] });
    if (sucesso > 0) {
      toast.success(
        `${sucesso} cadastro${sucesso > 1 ? "s" : ""} corrigido${sucesso > 1 ? "s" : ""} com o nome oficial da SEF-MG.`,
      );
    }
    if (falhas.length > 0) {
      toast.error(`${falhas.length} cadastro(s) não puderam ser corrigidos.`, {
        description: falhas.slice(0, 3).join(" · "),
      });
    }
  }

  async function salvar(linha: (typeof linhas)[number], nome: string, codigoBruto: string) {
    const codigo = normalizarCodigoSef(codigoBruto);
    if (!codigo) {
      toast.error("Informe um código SEF válido.");
      return;
    }
    if (nome.trim().length < 2) {
      toast.error("Informe o nome do município.");
      return;
    }
    setSalvandoId(linha.id);
    const { error } = await supabase
      .from("municipios")
      .update({ nome: nome.trim(), codigo_sef: codigo })
      .eq("id", linha.id);
    setSalvandoId(null);
    if (error) {
      toast.error("Não foi possível salvar.", { description: error.message });
      return;
    }
    toast.success(`Cadastro atualizado: ${nome.trim()} (código ${codigo}).`);
    setRascunho((r) => {
      const copia = { ...r };
      delete copia[linha.id];
      return copia;
    });
    await queryClient.invalidateQueries({ queryKey: ["municipios-sef-admin"] });
    await queryClient.invalidateQueries({ queryKey: ["municipios"] });
    await queryClient.invalidateQueries({ queryKey: ["carteira"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Códigos SEF</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira o código SEF-MG de cada prefeitura cadastrada contra a tabela oficial dos 853
          municípios. O nome oficial é o que identifica os arquivos na Nova Apuração.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cadastros</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{linhas.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Nome divergente
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{divergentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Código fora da tabela SEF
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{semCodigo}</CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-56">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-9"
          />
        </div>
        {podeEditar && divergentes > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setSelecionados(todosSelecionados ? [] : linhasDivergentes.map((l) => l.id))
              }
            >
              {todosSelecionados ? "Limpar seleção" : `Selecionar divergentes (${divergentes})`}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void aplicarOficialEmLote()}
              disabled={selecionadosVisiveis.length === 0 || aplicandoLote}
            >
              {aplicandoLote ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-1 h-3.5 w-3.5" />
              )}
              Aplicar nome oficial aos selecionados ({selecionadosVisiveis.length})
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código SEF</TableHead>
                  <TableHead>Nome cadastrado</TableHead>
                  <TableHead>Nome oficial (SEF-MG)</TableHead>
                  <TableHead className="w-40">Situação</TableHead>
                  {podeEditar && <TableHead className="w-44 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((m) => {
                  const draft = rascunho[m.id];
                  const nome = draft?.nome ?? m.nome;
                  const codigo = draft?.codigo ?? (m.codigo ?? m.codigo_sef);
                  const alterado = nome !== m.nome || codigo !== (m.codigo ?? m.codigo_sef);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        {podeEditar ? (
                          <Input
                            value={codigo}
                            onChange={(e) =>
                              setRascunho((r) => ({
                                ...r,
                                [m.id]: { nome, codigo: e.target.value },
                              }))
                            }
                            className="h-8 text-xs"
                            maxLength={6}
                          />
                        ) : (
                          (m.codigo ?? m.codigo_sef)
                        )}
                      </TableCell>
                      <TableCell>
                        {podeEditar ? (
                          <Input
                            value={nome}
                            onChange={(e) =>
                              setRascunho((r) => ({
                                ...r,
                                [m.id]: { nome: e.target.value, codigo },
                              }))
                            }
                            className="h-8 text-xs"
                            maxLength={120}
                          />
                        ) : (
                          `${m.nome}/${m.uf}`
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {nomeMunicipioSef(normalizarCodigoSef(codigo)) ?? "—"}
                      </TableCell>
                      <TableCell>
                        {!nomeMunicipioSef(normalizarCodigoSef(codigo)) ? (
                          <Badge variant="outline">Código não encontrado</Badge>
                        ) : m.divergente && !alterado ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Divergente
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Conferido
                          </Badge>
                        )}
                      </TableCell>
                      {podeEditar && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {m.divergente && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => salvar(m, m.oficial!, codigo)}
                                disabled={salvandoId === m.id}
                              >
                                <Wand2 className="mr-1 h-3.5 w-3.5" />
                                Usar oficial
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => salvar(m, nome, codigo)}
                              disabled={!alterado || salvandoId === m.id}
                            >
                              {salvandoId === m.id && (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              )}
                              Salvar
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={podeEditar ? 5 : 4} className="py-10 text-center text-muted-foreground">
                      Nenhum cadastro encontrado.
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
