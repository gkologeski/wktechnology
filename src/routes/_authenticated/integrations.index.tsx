// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/integrations/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/integrations", replace: true });
  },
  component: () => null,
});
