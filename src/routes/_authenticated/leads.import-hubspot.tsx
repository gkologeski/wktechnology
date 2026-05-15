import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leads/import-hubspot")({
  component: () => <Navigate to="/integrations/$slug" params={{ slug: "hubspot" }} replace />,
});
