import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAPEIS = ["superadmin", "consultor", "prefeitura_admin", "prefeitura_operador"] as const;

const criarSchema = z
  .object({
    email: z.string().trim().email().max(255),
    nome: z.string().trim().min(2).max(120),
    papel: z.enum(PAPEIS),
    municipio_id: z.string().uuid().nullable(),
    senha: z.string().min(10).max(72),
  })
  .refine(
    (v) =>
      (v.papel === "superadmin" || v.papel === "consultor") === (v.municipio_id === null),
    { message: "Usuário de prefeitura exige município; consultoria não pode ter município." },
  );

async function exigirSuperadmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("perfis").select("papel").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.papel !== "superadmin") throw new Error("Acesso restrito ao superadmin.");
}

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !criado.user) throw new Error(error?.message ?? "Falha ao criar usuário.");

    const { error: erroPerfil } = await supabaseAdmin.from("perfis").insert({
      id: criado.user.id,
      nome: data.nome,
      papel: data.papel,
      municipio_id: data.municipio_id,
      precisa_trocar_senha: true,
    });
    if (erroPerfil) {
      await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
      throw new Error(erroPerfil.message);
    }

    return { id: criado.user.id, email: data.email };
  });

export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), senha: z.string().min(10).max(72) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("perfis").update({ precisa_trocar_senha: true }).eq("id", data.userId);
    return { ok: true };
  });

export const listarUsuarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirSuperadmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: perfis, error } = await supabaseAdmin
      .from("perfis")
      .select("id, nome, papel, municipio_id, precisa_trocar_senha, criado_em, municipios(nome, uf)")
      .order("criado_em");
    if (error) throw new Error(error.message);

    const { data: usuarios } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emails = new Map((usuarios?.users ?? []).map((u) => [u.id, u.email ?? ""]));

    return (perfis ?? []).map((p) => ({
      id: p.id,
      nome: p.nome,
      papel: p.papel,
      email: emails.get(p.id) ?? "",
      precisa_trocar_senha: p.precisa_trocar_senha,
      municipio: p.municipios ? `${p.municipios.nome}/${p.municipios.uf}` : null,
    }));
  });
