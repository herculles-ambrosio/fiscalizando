import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/comparacao")({
  beforeLoad: () => {
    throw redirect({ to: "/analises", search: { aba: "comparacao" } });
  },
});
