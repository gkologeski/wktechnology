// Importação de dados é configuração: migrado para /settings/import.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leads/import-hubspot")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/import", replace: true });
  },
  component: () => null,
});
