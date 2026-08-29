// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/marketplace/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/marketplace", replace: true });
  },
  component: () => null,
});
