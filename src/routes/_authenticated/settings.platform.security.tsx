import { createFileRoute } from "@tanstack/react-router";
import { SecurityScansPage } from "@/components/platform/pages/platform-security-scans-page";

export const Route = createFileRoute("/_authenticated/settings/platform/security")({
  head: () => ({ meta: [{ title: "Segurança da plataforma" }] }),
  component: SecurityScansPage,
});
