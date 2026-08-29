// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/my-bug-reports")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/my-tickets", replace: true });
  },
  component: () => null,
});
