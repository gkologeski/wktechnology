// /settings/roles/$roleId — DEPRECATED. Redireciona para /home/access.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/roles/$roleId")({
  beforeLoad: () => {
    throw redirect({ to: "/home/access", replace: true });
  },
  component: () => null,
});
