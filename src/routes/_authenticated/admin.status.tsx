// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/status")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/platform/status", replace: true });
  },
  component: () => null,
});
