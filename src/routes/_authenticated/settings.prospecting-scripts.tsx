import { createFileRoute, redirect } from "@tanstack/react-router";
import { ScriptsPage } from "@/components/prospecting/pages/scripts-page";

export const Route = createFileRoute("/_authenticated/settings/prospecting-scripts")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "scripts" as const } });
  },
  component: ScriptsPage,
});
