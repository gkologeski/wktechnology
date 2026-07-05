// /settings/workspace-team — consolidado em /settings/teams. Mantido como redirect
// para não quebrar bookmarks/menus antigos.
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/workspace-team")({
  component: () => <Navigate to="/settings/teams" replace />,
});
