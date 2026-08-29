import { createFileRoute } from "@tanstack/react-router";
import { AdminSandboxPage } from "@/components/platform/pages/platform-sandbox-page";

export const Route = createFileRoute("/_authenticated/settings/platform/sandbox")({
  head: () => ({ meta: [{ title: "Sandbox da plataforma" }] }),
  component: AdminSandboxPage,
});
