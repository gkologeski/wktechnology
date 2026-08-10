import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProspectingPage } from "@/components/prospecting/pages/prospecting-page";

export const Route = createFileRoute("/_authenticated/settings/prospecting")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "prospecting" as const } });
  },
  component: ProspectingPage,
});
