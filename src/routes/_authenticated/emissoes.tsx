import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/emissoes")({
  beforeLoad: () => {
    throw redirect({ to: "/oficios", search: { aba: "emitidos" } });
  },
});
