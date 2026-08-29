import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsCatalog } from "@/components/integrations/pages/integrations-catalog-page";

export const Route = createFileRoute("/_authenticated/settings/integrations/")({
  head: () => ({ meta: [{ title: "Integrações" }] }),
  component: IntegrationsCatalog,
});
