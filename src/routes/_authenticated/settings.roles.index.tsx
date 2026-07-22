// /settings/roles — DEPRECATED. Migrado para /settings/permissions.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/roles/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/permissions", replace: true });
  },
  component: () => null,
});
