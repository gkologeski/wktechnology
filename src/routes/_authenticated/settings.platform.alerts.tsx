import { createFileRoute } from "@tanstack/react-router";
import { AdminAlertsPage } from "@/components/platform/pages/platform-alerts-page";

export const Route = createFileRoute("/_authenticated/settings/platform/alerts")({
  head: () => ({ meta: [{ title: "Alertas da plataforma" }] }),
  component: AdminAlertsPage,
});
