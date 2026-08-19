import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/modelos")({
  beforeLoad: () => {
    throw redirect({ to: "/oficios", search: { aba: "modelos" } });
  },
});
