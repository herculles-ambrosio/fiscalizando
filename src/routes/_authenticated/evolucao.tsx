import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/evolucao")({
  beforeLoad: () => {
    throw redirect({ to: "/analises", search: { aba: "evolucao" } });
  },
});
