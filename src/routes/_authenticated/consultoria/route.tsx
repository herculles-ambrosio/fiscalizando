import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/consultoria")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
    const { data: perfil } = await supabase
      .from("perfis")
      .select("papel")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!perfil || (perfil.papel !== "superadmin" && perfil.papel !== "consultor")) {
      throw redirect({ to: "/dashboard" });
    }
    return { papel: perfil.papel };
  },
  component: () => <Outlet />,
});
