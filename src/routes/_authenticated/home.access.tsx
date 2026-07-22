// /home/access — DEPRECATED. Redireciona para /settings/permissions.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/home/access")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/permissions", replace: true });
  },
  component: () => null,
});
