import { createFileRoute, redirect } from "@tanstack/react-router";

// O critério Esportes passou a viver dentro da área de Critérios.
export const Route = createFileRoute("/_authenticated/icms/esportes")({
  beforeLoad: () => {
    throw redirect({ to: "/icms/criterio/$slug", params: { slug: "esportes" } });
  },
});
