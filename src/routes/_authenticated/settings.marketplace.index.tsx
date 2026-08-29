import { createFileRoute } from "@tanstack/react-router";
import { MarketplacePage } from "@/components/marketplace/pages/marketplace-list-page";

export const Route = createFileRoute("/_authenticated/settings/marketplace/")({
  head: () => ({ meta: [{ title: "Marketplace" }] }),
  component: MarketplacePage,
});
