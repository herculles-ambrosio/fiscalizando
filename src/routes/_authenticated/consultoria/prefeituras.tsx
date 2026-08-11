import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/usePerfil";
import { useMunicipioAtivo } from "@/hooks/useMunicipio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/consultoria/prefeituras")({
  head: () => ({
    meta: [
      { title: "Carteira de prefeituras | Apuração VAF" },
      {
        name: "description",
        content:
          "Carteira de prefeituras atendidas pela consultoria, com a situação da última apuração VAF de cada município.",
      },
      { property: "og:title", content: "Carteira de prefeituras | Apuração VAF" },
      {
        property: "og:description",
        content: "Acompanhe todas as prefeituras atendidas e a última apuração VAF de cada uma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Prefeituras,
});

type Linha = {
  id: string;
  nome: string;
  uf: string;
  codigo_sef: string;
  exercicio: number | null;
  omissos: number | null;
  zerados: number | null;
  discrepantes: number | null;
  status: string | null;
};

function Prefeituras() {
  const { data: perfil } = usePerfil();
  const { trocar } = useMunicipioAtivo();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("MG");
  const [codigo, setCodigo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["carteira"],
    queryFn: async (): Promise<Linha[]> => {
      const { data: municipios, error } = await supabase
        .from("municipios")
        .select("id, nome, uf, codigo_sef")
        .order("nome");
      if (error) throw error;

      const { data: cargas, error: erroCargas } = await supabase
        .from("cargas")
        .select(
          "municipio_id, exercicio, status, total_omissos, total_zerados, total_discrepantes, criado_em",
        )
        .order("criado_em", { ascending: false });
      if (erroCargas) throw erroCargas;

      const ultima = new Map<string, (typeof cargas)[number]>();
      for (const c of cargas ?? []) if (!ultima.has(c.municipio_id)) ultima.set(c.municipio_id, c);

      return (municipios ?? []).map((m) => {
        const c = ultima.get(m.id);
        return {
          ...m,
          exercicio: c?.exercicio ?? null,
          omissos: c?.total_omissos ?? null,
          zerados: c?.total_zerados ?? null,
          discrepantes: c?.total_discrepantes ?? null,
          status: c?.status ?? null,
        };
      });
    },
  });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase
      .from("municipios")
      .insert({ nome: nome.trim(), uf: uf.trim().toUpperCase(), codigo_sef: codigo.trim() });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível cadastrar a prefeitura.", { description: error.message });
      return;
    }
    toast.success("Prefeitura cadastrada.");
    setAberto(false);
    setNome("");
    setCodigo("");
    queryClient.invalidateQueries({ queryKey: ["carteira"] });
    queryClient.invalidateQueries({ queryKey: ["municipios"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Prefeituras</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Carteira atendida pela consultoria. Clique em uma linha para trabalhar naquele município.
          </p>
        </div>
        {perfil?.ehSuperadmin && (
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova prefeitura
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar prefeitura</DialogTitle>
              </DialogHeader>
              <form onSubmit={criar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Município</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="uf">UF</Label>
                    <Input id="uf" value={uf} onChange={(e) => setUf(e.target.value)} required maxLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código SEF</Label>
                    <Input
                      id="codigo"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      required
                      maxLength={20}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={salvando}>
                    {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
                  <TableHead>Município</TableHead>
                  <TableHead>Código SEF</TableHead>
                  <TableHead>Último exercício</TableHead>
                  <TableHead className="text-right">Omissos</TableHead>
                  <TableHead className="text-right">Zerados</TableHead>
                  <TableHead className="text-right">Discrepantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => {
                      trocar(m.id);
                      toast.success(`Prefeitura ativa: ${m.nome}/${m.uf}`);
                    }}
                  >
                    <TableCell className="font-medium">
                      {m.nome}/{m.uf}
                    </TableCell>
                    <TableCell>{m.codigo_sef}</TableCell>
                    <TableCell>{m.exercicio ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.omissos ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.zerados ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.discrepantes ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {(data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhuma prefeitura cadastrada.
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
