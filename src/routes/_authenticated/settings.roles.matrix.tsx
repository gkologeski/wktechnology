// /settings/roles/matrix — DEPRECATED. Redireciona para /home/access.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/roles/matrix")({
  beforeLoad: () => {
    throw redirect({ to: "/home/access", replace: true });
  },
  component: () => null,
});
