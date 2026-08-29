import { createFileRoute } from "@tanstack/react-router";
import { AdminStatusPage } from "@/components/platform/pages/platform-status-page";

export const Route = createFileRoute("/_authenticated/settings/platform/status")({
  head: () => ({ meta: [{ title: "Status da plataforma" }] }),
  component: AdminStatusPage,
});
