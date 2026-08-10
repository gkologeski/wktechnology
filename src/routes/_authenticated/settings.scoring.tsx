import { createFileRoute, redirect } from "@tanstack/react-router";
import { ScoringPage } from "@/components/prospecting/pages/scoring-page";

export const Route = createFileRoute("/_authenticated/settings/scoring")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "scoring" as const } });
  },
  component: ScoringPage,
});
