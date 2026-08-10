import { createFileRoute, redirect } from "@tanstack/react-router";
import { EnrichmentHistoryPage } from "@/components/prospecting/pages/enrichment-history-page";

export const Route = createFileRoute("/_authenticated/settings/enrichment")({
  beforeLoad: () => {
    throw redirect({ to: "/prospecting", search: { tab: "enrichment" as const } });
  },
  component: EnrichmentHistoryPage,
});
