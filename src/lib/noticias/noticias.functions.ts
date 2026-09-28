import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Busca novidades agora (somente consultoria). */
export const buscarNoticiasAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: perfil } = await context.supabase
      .from("perfis")
      .select("papel")
      .eq("id", context.userId)
      .maybeSingle();
    if (!perfil || !["superadmin", "consultor"].includes(perfil.papel as string)) {
      throw new Error("Somente a consultoria pode buscar novidades.");
    }
    const { coletarNoticias } = await import("./coleta.server");
    return coletarNoticias();
  });
