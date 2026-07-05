// /settings/roles — DEPRECATED. Migrado para /home/access (Controle de Acesso).
// Os perfis de acesso desta tela foram convertidos em papéis de trabalho oficiais.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/roles/")({
  beforeLoad: () => {
    throw redirect({ to: "/home/access", replace: true });
  },
  component: () => null,
});
