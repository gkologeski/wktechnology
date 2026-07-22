// /settings/roles/matrix — DEPRECATED. Redireciona para /settings/permissions.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/roles/matrix")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/permissions", replace: true });
  },
  component: () => null,
});
