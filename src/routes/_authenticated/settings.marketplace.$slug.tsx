import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceDetail } from "@/components/marketplace/pages/marketplace-detail-page";

export const Route = createFileRoute("/_authenticated/settings/marketplace/$slug")({
  head: () => ({ meta: [{ title: "App do Marketplace" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <MarketplaceDetail slug={slug} />;
}
