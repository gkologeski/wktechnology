import { createFileRoute } from "@tanstack/react-router";
import { AdminQuotasPage } from "@/components/platform/pages/platform-quotas-page";

export const Route = createFileRoute("/_authenticated/settings/platform/quotas")({
  head: () => ({ meta: [{ title: "Quotas da plataforma" }] }),
  component: AdminQuotasPage,
});
