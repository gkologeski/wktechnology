// Migrado para dentro de Configurações. Mantido como redirect para links antigos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/integrations/contaazul")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/integrations/contaazul", replace: true });
  },
  component: () => null,
});
