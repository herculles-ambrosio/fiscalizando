import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { criarUsuario, listarUsuarios, redefinirSenha } from "@/lib/admin.functions";
import { useMunicipios } from "@/hooks/useMunicipio";
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

export const Route = createFileRoute("/_authenticated/consultoria/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários e acessos | Apuração VAF" },
      {
        name: "description",
        content:
          "Crie contas da consultoria e das prefeituras, defina senhas provisórias e controle quem acessa cada município.",
      },
      { property: "og:title", content: "Usuários e acessos | Apuração VAF" },
      {
        property: "og:description",
        content: "Gestão de contas da consultoria e das prefeituras atendidas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Usuarios,
});

const PAPEIS = [
  { valor: "superadmin", rotulo: "Consultoria — superadmin" },
  { valor: "consultor", rotulo: "Consultoria — consultor" },
  { valor: "prefeitura_admin", rotulo: "Prefeitura — administrador" },
  { valor: "prefeitura_operador", rotulo: "Prefeitura — operador" },
] as const;

function senhaAleatoria() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (n) => alfabeto[n % alfabeto.length]).join("");
}

function Usuarios() {
  const listar = useServerFn(listarUsuarios);
  const criar = useServerFn(criarUsuario);
  const redefinir = useServerFn(redefinirSenha);
  const queryClient = useQueryClient();
  const { data: municipios } = useMunicipios();

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<string>("prefeitura_admin");
  const [municipioId, setMunicipioId] = useState<string>("");
  const [senha, setSenha] = useState(senhaAleatoria);
  const [salvando, setSalvando] = useState(false);
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);

  const ehConsultoria = papel === "superadmin" || papel === "consultor";

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listar({ data: undefined }),
  });

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await criar({
        data: {
          email: email.trim(),
          nome: nome.trim(),
          papel: papel as (typeof PAPEIS)[number]["valor"],
          municipio_id: ehConsultoria ? null : municipioId || null,
          senha,
        },
      });
      setCredencial({ email: email.trim(), senha });
      setAberto(false);
      setNome("");
      setEmail("");
      setSenha(senhaAleatoria());
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (erro) {
      toast.error("Não foi possível criar o usuário.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  async function novaSenha(userId: string, emailUsuario: string) {
    const nova = senhaAleatoria();
    try {
      await redefinir({ data: { userId, senha: nova } });
      setCredencial({ email: emailUsuario, senha: nova });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    } catch (erro) {
      toast.error("Não foi possível redefinir a senha.", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contas da consultoria e das prefeituras. A senha provisória aparece uma única vez.
          </p>
        </div>
        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={submeter} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={papel} onValueChange={setPapel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEIS.map((p) => (
                      <SelectItem key={p.valor} value={p.valor}>
                        {p.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!ehConsultoria && (
                <div className="space-y-2">
                  <Label>Prefeitura</Label>
                  <Select value={municipioId} onValueChange={setMunicipioId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o município" />
                    </SelectTrigger>
                    <SelectContent>
                      {(municipios ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}/{m.uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="senha">Senha provisória</Label>
                <div className="flex gap-2">
                  <Input
                    id="senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    minLength={10}
                    maxLength={72}
                    required
                  />
                  <Button type="button" variant="outline" onClick={() => setSenha(senhaAleatoria())}>
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O usuário será obrigado a trocar a senha no primeiro acesso.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={salvando || (!ehConsultoria && !municipioId)}>
                  {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {credencial && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <p className="font-medium">Credencial gerada — copie agora</p>
              <p className="text-muted-foreground">
                {credencial.email} · senha <span className="font-mono">{credencial.senha}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${credencial.email} / ${credencial.senha}`);
                  toast.success("Credencial copiada.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCredencial(null)}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Prefeitura</TableHead>
                  <TableHead className="text-right">Senha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(usuarios ?? []).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{PAPEIS.find((p) => p.valor === u.papel)?.rotulo ?? u.papel}</TableCell>
                    <TableCell>{u.municipio ?? "Consultoria"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => novaSenha(u.id, u.email)}>
                        <KeyRound className="mr-2 h-4 w-4" />
                        Redefinir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
