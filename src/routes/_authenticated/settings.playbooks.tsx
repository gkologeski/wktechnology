import { createFileRoute, redirect } from "@tanstack/react-router";
import { PlaybooksPage } from "@/components/prospecting/pages/playbooks-page";

export const Route = createFileRoute("/_authenticated/settings/playbooks")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "playbooks" as const } });
  },
  component: PlaybooksPage,
});
