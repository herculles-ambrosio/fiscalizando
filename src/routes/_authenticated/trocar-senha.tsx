import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  head: () => ({
    meta: [
      { title: "Trocar senha | Apuração VAF" },
      {
        name: "description",
        content: "Defina uma nova senha pessoal para acessar o sistema de apuração VAF.",
      },
      { property: "og:title", content: "Trocar senha | Apuração VAF" },
      { property: "og:description", content: "Defina sua senha pessoal de acesso ao sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrocarSenha,
});

function TrocarSenha() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 10) {
      toast.error("A senha deve ter ao menos 10 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setSalvando(false);
      toast.error("Não foi possível alterar a senha.", { description: error.message });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("perfis").update({ precisa_trocar_senha: false }).eq("id", userData.user.id);
    }
    await queryClient.invalidateQueries({ queryKey: ["perfil"] });
    setSalvando(false);
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Definir nova senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submeter} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={10}
                maxLength={72}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmacao">Confirmar senha</Label>
              <Input
                id="confirmacao"
                type="password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                minLength={10}
                maxLength={72}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
