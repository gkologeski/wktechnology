import { createFileRoute } from "@tanstack/react-router";
import { IntegrationDetail } from "@/components/integrations/pages/integration-detail-page";

export const Route = createFileRoute("/_authenticated/settings/integrations/$slug")({
  head: () => ({ meta: [{ title: "Integração" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { slug } = Route.useParams();
  return <IntegrationDetail slug={slug} />;
}
