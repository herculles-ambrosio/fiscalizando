import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/indice")({
  beforeLoad: () => {
    throw redirect({ to: "/analises", search: { aba: "indice" } });
  },
});
